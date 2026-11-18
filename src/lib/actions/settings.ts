'use server';

import { dbGetAll, dbReplaceSheetData, clearSheetCache } from '@/lib/google-sheets';
import { MYSQL_TABLE_SCHEMAS } from '@/lib/mysql';
import { logger } from '@/lib/logger';
import { getCurrentUser, requireAdmin } from '@/lib/session-server';
import { persistSettingsUpdates } from '@/lib/settings-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Schema SETTINGS: key-value pairs (col A = key, col B = value)

const DEFAULT_V6_SYSTEM_PROMPT =
  "Role: SISTEM KOREKSI LJK (Lembar Jawaban Komputer) ULTRA-AKURAT - WMVAA AI Grader Enterprise Vision Engine V6.\n" +
  "Task: Mengekstraksi identitas siswa dan seluruh jawaban soal secara presisi dari citra LJK fisik.\n\n" +
  "=== PROTOKOL PENALARAN VISUAL & TATA LETAK LJK V6 ===\n" +
  "1. ORIENTASI & KALIBRASI SPASIAL:\n" +
  "   - Deteksi 4 Fiducial Marker (kotak hitam konsentris) di keempat sudut lembar kertas sebagai patokan batas dokumen.\n" +
  "   - Kompensasikan kemiringan sudut (skew/rotation), perspektif kamera ponsel, atau bayangan tangan secara visual.\n\n" +
  "2. BLOK IDENTITAS PESERTA (KIRI ATAS) & QR ANCHOR (KANAN ATAS):\n" +
  "   - Baca kolom 'NAMA PESERTA': Transkrip nama lengkap siswa.\n" +
  "   - Baca 'NIS / NO. PESERTA' di kotak identitas ATAU pada label 'NIS:' di bawah QR Code kanan atas.\n\n" +
  "3. ATURAN ELIMINASI VISUAL BULATAN (ANTI-JEBAKAN HURUF TERTUTUP TINTA):\n" +
  "   - Setiap bulatan yang dipilih siswa dihitamkan penuh (●) atau diberi tanda silang (X) sehingga huruf di dalamnya TERTUTUP.\n" +
  "   - Sementara bulatan lain yang TIDAK dipilih pada baris yang sama tetap putih bersih (○) dengan huruf tercetak terlihat jelas di dalamnya.\n" +
  "   - Hitung jumlah bulatan kosong di sebelah KIRI ('left_empty') dan KANAN ('right_empty') dari bulatan yang dihitamkan, catat huruf yang masih terlihat ('unfilled_letters_visible'), lalu tentukan huruf jawaban ('filled_letter' atau '?' jika kosong).\n\n" +
  "4. ATURAN KOTAK ISIAN SINGKAT (ISN) & ZONA URAIAN / ESAI:\n" +
  "   - Untuk soal Isian Singkat (ISN), baca tulisan tangan (angka, pecahan, simbol matematika, atau kata) di dalam kotak persegi panjang terbuka dan masukkan ke 'filled_letter'.\n" +
  "   - Untuk soal Uraian/Esai di bagian bawah 'JAWABAN URAIAN / ESAI', transkripsikan jawaban tulisan tangan siswa secara utuh ke 'filled_letter'.\n\n" +
  "=== ATURAN FORMAT OUTPUT JSON (MURNI TANPA MARKDOWN/BACKTICK) ===\n" +
  "{\n" +
  "  \"name\": \"NAMA SISWA LENGKAP\",\n" +
  "  \"nis\": \"388\",\n" +
  "  \"id_siswa\": \"\",\n" +
  "  \"confidence\": 98,\n" +
  "  \"answers\": [\n" +
  "    { \"no\": 1, \"left_empty\": 0, \"right_empty\": 3, \"unfilled_letters_visible\": [\"B\", \"C\", \"D\"], \"filled_letter\": \"A\" }\n" +
  "  ]\n" +
  "}\n" +
  "Pastikan 'answers' memuat tepat {{totalSoal}} item bernomor 1 s/d {{totalSoal}}.\n" +
  "{{questionBlueprint}}";

const ALLOWED_BACKUP_SHEETS = [
  'USERS',
  'KELAS',
  'MAPEL',
  'SISWA',
  'KUNCI_JAWABAN',
  'HASIL',
  'SETTINGS',
  'TUGAS_GURU',
  'AI_FEEDBACK',
  'FILES',
  'LOG',
] as const;

export async function getSettingsAction(includeSecrets: boolean = false) {
  try {
    const [rows, currentUser] = await Promise.all([
      dbGetAll('SETTINGS'),
      getCurrentUser().catch(() => null),
    ]);

    const settings: Record<string, string> = {};
    rows.forEach(r => {
      const key = r.key;
      const val = r.value;
      if (key) settings[key] = val;
    });

    // Default Akademik & KKM
    if (!settings['tahun_ajaran']) settings['tahun_ajaran'] = '2026/2027';
    if (!settings['semester']) settings['semester'] = 'GANJIL';
    else settings['semester'] = String(settings['semester']).trim().toUpperCase();

    if (!settings['kkm_eksakta']) settings['kkm_eksakta'] = '70';
    if (!settings['kkm_non_eksakta']) settings['kkm_non_eksakta'] = '75';
    if (!settings['mapel_eksakta_keywords']) {
      settings['mapel_eksakta_keywords'] = 'IPA, Matematika, Fisika, Kimia, Biologi, Informatika';
    }
    if (!settings['min_confidence']) settings['min_confidence'] = '60';
    if (!settings['ljk_essay_layout_default']) settings['ljk_essay_layout_default'] = 'integrated';
    if (!settings['tampilkan_ttd_panitia']) settings['tampilkan_ttd_panitia'] = 'false';

    // Default Identitas Yayasan, Lokasi & Pemisahan Unit SMP / SMA
    if (!settings['nama_yayasan']) settings['nama_yayasan'] = 'YAYASAN PENDIDIKAN ADVENT PAPUA';
    if (!settings['alamat_sekolah']) {
      settings['alamat_sekolah'] = 'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';
    }
    if (!settings['kota_sekolah']) settings['kota_sekolah'] = 'Wamena';

    if (!settings['smp_nama_sekolah_1']) {
      settings['smp_nama_sekolah_1'] = settings['nama_sekolah_1'] || 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
    }
    if (!settings['smp_nama_sekolah_2']) {
      settings['smp_nama_sekolah_2'] = 'SMP ADVENT SOGOKMO';
    }
    if (!settings['smp_logo_kiri_url']) {
      settings['smp_logo_kiri_url'] = settings['logo_kiri_url'] || '/logo/logo_advent.png';
    }
    if (!settings['smp_logo_kanan_url']) {
      settings['smp_logo_kanan_url'] = settings['logo_kanan_url'] || '/logo/tut_wuri.png';
    }

    if (!settings['sma_nama_sekolah_1']) {
      settings['sma_nama_sekolah_1'] = settings['nama_sekolah_1'] || 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
    }
    if (!settings['sma_nama_sekolah_2']) {
      settings['sma_nama_sekolah_2'] = 'SMA ADVENT SOGOKMO';
    }
    if (!settings['sma_logo_kiri_url']) {
      settings['sma_logo_kiri_url'] = settings['logo_kiri_url'] || '/logo/logo_advent.png';
    }
    if (!settings['sma_logo_kanan_url']) {
      settings['sma_logo_kanan_url'] = settings['logo_kanan_url'] || '/logo/tut_wuri.png';
    }

    // Default AI Engine
    if (!settings['ai_model']) settings['ai_model'] = 'gemini-3-flash-preview';
    if (!settings['ai_temperature']) settings['ai_temperature'] = '0.1';
    if (!settings['ai_system_prompt']) {
      settings['ai_system_prompt'] = DEFAULT_V6_SYSTEM_PROMPT;
    }

    // Sembunyikan API keys cadangan jika dipanggil dari client oleh non-ADMIN
    if (!includeSecrets && currentUser?.role !== 'ADMIN') {
      delete settings['ai_api_keys_pool'];
    }

    return { success: true, data: settings };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * getSchoolBrandingAction (Fase 17: Branding)
 * Mengambil informasi branding sekolah (Logo, Nama, Kepala Sekolah, & Ketua Panitia) sesuai jenjang unit (SMP / SMA).
 */
export async function getSchoolBrandingAction(jenjang: 'SMP' | 'SMA' = 'SMA') {
  try {
    const res = await getSettingsAction();
    if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat pengaturan.');
    
    const s = res.data;
    const prefix = jenjang.toLowerCase() + '_';
    
    return {
      success: true,
      data: {
        yayasan: s['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA',
        sekolah1: s[prefix + 'nama_sekolah_1'] || s['nama_sekolah_1'] || 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY',
        sekolah2: s[prefix + 'nama_sekolah_2'] || s['nama_sekolah_2'] || (jenjang === 'SMP' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO'),
        alamat: s['alamat_sekolah'] || 'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya',
        kota: s[prefix + 'kota'] || s['kota_sekolah'] || 'Wamena',
        logoKiri: s[prefix + 'logo_kiri_url'] || s['logo_kiri_url'] || '/logo/logo_advent.png',
        logoKanan: s[prefix + 'logo_kanan_url'] || s['logo_kanan_url'] || '/logo/tut_wuri.png',
        tahunAjaran: s['tahun_ajaran'] || '2026/2027',
        kkm: parseInt(s[prefix + 'kkm'] || s['kkm_non_eksakta'] || '75', 10),
        kepalaNama: s[prefix + 'kepala_nama'] || '',
        kepalaNip: s[prefix + 'kepala_nip'] || '',
        panitiaNama: s[prefix + 'panitia_nama'] || '',
        panitiaNip: s[prefix + 'panitia_nip'] || '',
        tampilkanTtdPanitia: s['tampilkan_ttd_panitia'] === 'true',
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil parameter sesi akademik yang sedang aktif (Tahun Ajaran, Semester, KKM, & Konfigurasi Scanner)
 */
export async function getAcademicSessionAction() {
  try {
    const res = await getSettingsAction();
    if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat pengaturan.');
    const settings = res.data;
    
    return {
      success: true,
      data: {
        tahunAjaran: String(settings['tahun_ajaran'] || '2026/2027').trim(),
        semester: String(settings['semester'] || 'GANJIL').trim().toUpperCase(),
        kkmEksakta: Number(settings['kkm_eksakta'] || 70),
        kkmNonEksakta: Number(settings['kkm_non_eksakta'] || 75),
        mapelEksakta: (settings['mapel_eksakta_keywords'] || 'IPA, Matematika, Fisika, Kimia, Biologi, Informatika')
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean),
        minConfidence: Number(settings['min_confidence'] || 60),
        autoSync: settings['auto_sync'] === 'true',
        essayLayoutDefault: (settings['ljk_essay_layout_default'] === 'separate' ? 'separate' : 'integrated') as 'integrated' | 'separate',
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * Menentukan nilai KKM untuk sebuah mapel berdasarkan referensi Mapel Eksakta yang konsisten.
 */
export async function getKkmForMapelAction(mapelName: string) {
  try {
    const sessionRes = await getAcademicSessionAction();
    if (!sessionRes.success || !sessionRes.data) {
      throw new Error(sessionRes.message || 'Gagal memuat pengaturan sesi akademik.');
    }
    const { kkmEksakta, kkmNonEksakta, mapelEksakta } = sessionRes.data;
    const normalizedMapel = String(mapelName || '').toLowerCase();
    const isEksakta = mapelEksakta.some(k => normalizedMapel.includes(k));
    const kkm = isEksakta ? kkmEksakta : kkmNonEksakta;

    return { success: true, kkm, isEksakta };
  } catch (e: any) {
    return { success: false, kkm: 75, isEksakta: false, message: e.message };
  }
}

/**
 * checkAIStatusAction
 * Melakukan ping ke Gemini API menggunakan pool API Key (Settings + .env) untuk memverifikasi konektivitas.
 */
export async function checkAIStatusAction() {
  let modelName = 'gemini-3-flash-preview';
  try {
    await requireAdmin();
    const res = await getSettingsAction(true);
    const settings = res.success && res.data ? res.data : {};
    if (settings['ai_model']) {
      modelName = settings['ai_model'];
    }

    const rawKeys: string[] = [];
    if (settings['ai_api_keys_pool']) {
      rawKeys.push(...settings['ai_api_keys_pool'].split(/[\n,;]+/));
    }
    if (process.env.GEMINI_API_KEYS) {
      rawKeys.push(...process.env.GEMINI_API_KEYS.split(/[\n,;]+/));
    }
    if (process.env.GEMINI_API_KEY) {
      rawKeys.push(process.env.GEMINI_API_KEY);
    }
    const apiKeys = Array.from(new Set(rawKeys.map(k => k.trim()).filter(k => k.length >= 20)));

    if (apiKeys.length === 0) {
      return { success: false, message: 'API Key belum ditemukan di .env maupun di Pool API Key Cadangan.' };
    }

    const candidateModels = Array.from(new Set([
      modelName,
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ]));

    const failures: string[] = [];

    for (const apiKey of apiKeys) {
      const genAI = new GoogleGenerativeAI(apiKey);
      for (const candidate of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: candidate }, { apiVersion: 'v1beta' });
          const result = await model.generateContent('Katakan saja kata: PONG');
          const response = await result.response;
          const text = response.text();

          if (text.toUpperCase().includes('PONG')) {
            const fallbackNote = candidate === modelName ? ` (${candidate})` : ` (melalui fallback ${candidate})`;
            const poolNote = apiKeys.length > 1 ? ` · ${apiKeys.length} API Key siap di pool` : '';
            return { success: true, message: `Terhubung ke AI dengan sukses${fallbackNote}${poolNote}!` };
          }

          failures.push(`${candidate}: respon tidak sesuai`);
        } catch (candidateError: any) {
          failures.push(`${candidate}: ${candidateError.message}`);
        }
      }
    }

    const lastFailure = failures[failures.length - 1] || 'unknown error';
    let msg = lastFailure;
    if (msg.includes('API_KEY_INVALID')) msg = 'API Key Google Gemini tidak valid.';
    if (msg.toLowerCase().includes('model not found')) msg = 'Model AI yang dipilih tidak didukung atau tidak tersedia.';
    if (msg.includes('429')) {
      msg = `Kuota model aktif sedang penuh. Fallback yang diuji: ${candidateModels.join(', ')}.`;
    }

    return { success: false, message: 'Gagal terhubung ke AI: ' + msg };
  } catch (e: any) {
    let msg = e.message || 'Unknown error';
    if (msg.includes('429')) {
      return {
        success: false,
        message: `Kuota Terlampaui (429) pada model ${modelName}. Silakan tambahkan API Key cadangan atau gunakan Gemini 3 Flash / 2.5 Flash.`,
      };
    }
    if (msg.includes('API_KEY_INVALID')) msg = 'API Key Google Gemini tidak valid.';
    if (msg.includes('model not found')) msg = 'Model AI yang dipilih tidak didukung atau tidak tersedia.';
    return { success: false, message: 'Gagal terhubung ke AI: ' + msg };
  }
}

export async function saveSettingsAction(updates: Record<string, string>, adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id;
    await persistSettingsUpdates(updates, adminId);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * backupDatabaseAction (Fase 17: Disaster Recovery)
 * Mengunduh seluruh 11 tabel sheet ke dalam format JSON terstruktur.
 */
export async function backupDatabaseAction(adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id;
    const backupData: Record<string, any[]> = {};

    for (const sheetName of ALLOWED_BACKUP_SHEETS) {
      backupData[sheetName] = await dbGetAll(sheetName, false);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `WMVAA_BACKUP_${timestamp}.json`;

    await logger.info('DB_BACKUP', `Backup database penuh (${ALLOWED_BACKUP_SHEETS.length} sheet) berhasil dibuat oleh Admin.`, adminId);

    return {
      success: true,
      data: backupData,
      filename,
      message: 'Backup database berhasil diekspor.'
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * exportDatabaseToSqlAction
 * Mengenerate seluruh isi 11 tabel aktif ke script SQL standar (.sql)
 * Siap diimport langsung ke phpMyAdmin MySQL cPanel kapan pun data berubah.
 */
export async function exportDatabaseToSqlAction(adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id;

    const parts: string[] = [
      '-- WMVAA AI Grader Pro - MySQL Database Export',
      `-- Exported At: ${new Date().toISOString()}`,
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      ''
    ];

    for (const [tableName, schema] of Object.entries(MYSQL_TABLE_SCHEMAS)) {
      parts.push(`-- Table: ${tableName}`);
      parts.push(schema.ddl);
      parts.push('');

      const rows = await dbGetAll(tableName, false);
      if (!rows || rows.length === 0) continue;

      const cols = schema.columns;
      const colList = cols.map(c => `\`${c}\``).join(', ');
      const updateCols = schema.pk
        ? cols.filter(c => c !== schema.pk).map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')
        : '';

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const tuples = chunk.map(r => {
          const vals = cols.map(c => {
            const v = r[c];
            if (v === null || v === undefined) return "''";
            const s = String(v)
              .replace(/\\/g, '\\\\')
              .replace(/\0/g, '\\0')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/'/g, "\\'")
              .replace(/"/g, '\\"')
              .replace(/\x1a/g, '\\Z');
            return `'${s}'`;
          });
          return `(${vals.join(', ')})`;
        });

        if (schema.pk && updateCols) {
          parts.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${tuples.join(',\n')}\nON DUPLICATE KEY UPDATE ${updateCols};\n`);
        } else {
          parts.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${tuples.join(',\n')};\n`);
        }
      }
    }

    parts.push('SET FOREIGN_KEY_CHECKS = 1;', '');
    const sqlContent = parts.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `WMVAA_DATABASE_${timestamp}.sql`;

    await logger.info('DB_SQL_EXPORT', `Export script SQL (.sql) berhasil diunduh oleh Admin.`, adminId);

    return {
      success: true,
      sql: sqlContent,
      filename,
      message: 'Script SQL berhasil dibuat.'
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * restoreDatabaseAction (Fase 17: Disaster Recovery)
 * Mengembalikan data dari file JSON backup dan membersihkan cache memori RAM secara penuh.
 */
export async function restoreDatabaseAction(backupData: Record<string, any[]>, adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id;
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Format data backup tidak valid.');
    }

    const allowedSet = new Set<string>(ALLOWED_BACKUP_SHEETS);
    let restoredSheetsCount = 0;

    for (const [sheetName, rows] of Object.entries(backupData)) {
      if (!allowedSet.has(sheetName)) continue;
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const headers = Object.keys(rows[0]);
      if (headers.length === 0) continue;
      const dataRows = rows.map((r: any) => headers.map(h => (r[h] === undefined || r[h] === null ? '' : r[h])));

      await dbReplaceSheetData(sheetName, headers, dataRows);
      restoredSheetsCount++;
    }

    // Bersihkan seluruh cache agar perubahan langsung terlihat di semua halaman
    clearSheetCache();

    await logger.warn('DB_RESTORE', `Database berhasil dipulihkan (${restoredSheetsCount} tabel) dari file backup.`, adminId);
    return { success: true, message: `Database berhasil dipulihkan (${restoredSheetsCount} tabel).` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * getGlobalAnalyticsAction (Fase 17: Global Analytics)
 * Agregasi data makro untuk dashboard pimpinan.
 */
export async function getGlobalAnalyticsAction() {
  try {
    await requireAdmin();
    const [allHasil, allMapel, allKunci, allUsers, allSiswa] = await Promise.all([
      dbGetAll('HASIL'),
      dbGetAll('MAPEL'),
      dbGetAll('KUNCI_JAWABAN'),
      dbGetAll('USERS'),
      dbGetAll('SISWA'),
    ]);

    const totalUjian = allHasil.length;
    const avgSkor = totalUjian > 0 
      ? (allHasil.reduce((sum, h) => sum + parseFloat(h.skor || 0), 0) / totalUjian).toFixed(2)
      : 0;

    const mapelStats: Record<string, { total: number, sum: number, avg: number, name: string }> = {};
    allMapel.forEach(m => {
      mapelStats[m.id_mapel] = { total: 0, sum: 0, avg: 0, name: m.nama_mapel };
    });

    const kunciMap: Record<string, any> = {};
    allKunci.forEach(k => kunciMap[k.id_kunci] = k);

    allHasil.forEach(h => {
      const kunci = kunciMap[h.id_kunci];
      if (kunci && mapelStats[kunci.id_mapel]) {
        mapelStats[kunci.id_mapel].total++;
        mapelStats[kunci.id_mapel].sum += parseFloat(h.skor || 0);
      }
    });

    const performanceMapel = Object.values(mapelStats)
      .filter(s => s.total > 0)
      .map(s => ({ name: s.name, avg: (s.sum / s.total).toFixed(2), count: s.total }))
      .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));

    return {
      success: true,
      data: {
        summary: { totalUjian, avgSkor },
        performanceMapel,
        totalGuru: allUsers.filter(u => u.role === 'GURU').length,
        totalSiswa: allSiswa.length
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
