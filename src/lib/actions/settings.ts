'use server';

import { dbGetAll, dbReplaceSheetData, sanitizeInput, getSheets, spreadsheetId, clearSheetCache } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/lib/session-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Schema SETTINGS: key-value pairs (col A = key, col B = value)

export async function getSettingsAction() {
  try {
    const rows = await dbGetAll('SETTINGS');
    const settings: Record<string, string> = {};
    rows.forEach(r => {
      const key = r.key;
      const val = r.value;
      if (key) settings[key] = val;
    });

    if (!settings['tahun_ajaran']) settings['tahun_ajaran'] = '2026/2027';
    if (!settings['semester']) settings['semester'] = 'GANJIL';
    else settings['semester'] = String(settings['semester']).trim().toUpperCase();

    // Default System Instruction (The Brain)
    if (!settings['ai_system_prompt']) {
      settings['ai_system_prompt'] = 
        "Role: SISTEM KOREKSI LJK (Lembar Jawaban Komputer) ULTRA-AKURAT - WMVAA AI Grader Enterprise Vision Engine.\n" +
        "Task: Mengekstraksi identitas siswa dan seluruh jawaban soal secara presisi dari citra LJK fisik.\n\n" +
        "=== PROTOKOL PENALARAN VISUAL & TATA LETAK LJK ===\n" +
        "1. ORIENTASI & KALIBRASI SPASIAL:\n" +
        "   - Deteksi 4 Fiducial Marker (kotak hitam pekat) di setiap sudut lembar kertas sebagai patokan batas dokumen.\n" +
        "   - Kompensasikan kemiringan sudut (skew/rotation), bayangan, atau lipatan kertas secara visual.\n\n" +
        "2. BLOK IDENTITAS PESERTA (KIRI ATAS):\n" +
        "   - Baca kolom 'NAMA PESERTA': Transkrip nama lengkap siswa (baik teks tercetak maupun tulisan tangan kapital).\n" +
        "   - Baca 'KELAS' dan 'MAPEL' untuk memperkuat verifikasi identitas.\n" +
        "   - Periksa ANCHOR ID / QR Code di sudut kanan bawah untuk mengekstrak identitas NIS atau ID Siswa jika tersedia.\n\n" +
        "3. AREA JAWABAN (ADAPTIF 1, 2, ATAU 3 KOLOM VERTIKAL):\n" +
        "   - Soal tersusun berurutan dari nomor 1 sampai nomor {{totalSoal}}.\n" +
        "   - Periksa marking secara ketat pada setiap nomor soal sesuai format AKM:\n" +
        "     * [PG_TUNGGAL] (A-E atau A-D): Ekstrak SATU huruf yang paling tegas terisi (hitam pekat atau silang tegas X).\n" +
        "     * [BENAR_SALAH] (B/S): Ekstrak satu huruf 'B' atau 'S'.\n" +
        "     * [PG_KOMPLEKS] (Multi-pilihan): Ekstrak seluruh opsi yang terisi, gabungkan berurutan (contoh: 'AC', 'ABD').\n" +
        "     * [MTF] (Pernyataan Majemuk B/S): Baca setiap baris pernyataan, pisahkan dengan koma (contoh: 'B,S,B').\n" +
        "     * [MENJODOHKAN]: Baca pasangan garis atau label (contoh: '1-B, 2-A, 3-C').\n" +
        "     * [ISIAN_SINGKAT]: Transkrip huruf/angka di dalam kotak karakter.\n" +
        "     * [URAIAN]: Baca teks narasi jawaban secara utuh.\n" +
        "   - ATURAN VALIDASI ARSIRAN:\n" +
        "     * SAH: Bulatan terisi hitam pekat ATAU bertanda silang tegas (X).\n" +
        "     * BATAL: Bulatan yang memiliki coretan horizontal ganda (==) dianggap dibatalkan peserta -> ABAIKAN.\n" +
        "     * KOSONG: Jika nomor soal tidak memiliki arsiran sah sama sekali -> isi '?'.\n\n" +
        "=== ATURAN FORMAT OUTPUT JSON (MURNI TANPA MARKDOWN/BACKTICK) ===\n" +
        "Kembalikan HANYA objek JSON valid berikut:\n" +
        "{\n" +
        "  \"name\": \"NAMA SISWA LENGKAP\",\n" +
        "  \"nis\": \"NIS JIKA TERTERA\",\n" +
        "  \"id_siswa\": \"\",\n" +
        "  \"answers\": [\n" +
        "    { \"no\": 1, \"ans\": \"A\" },\n" +
        "    { \"no\": 2, \"ans\": \"B\" }\n" +
        "  ],\n" +
        "  \"confidence\": 98\n" +
        "}\n" +
        "PENTING:\n" +
        "- Array 'answers' harus berisi TEPAT {{totalSoal}} item bernomor 1 sampai {{totalSoal}}.\n" +
        "- Nilai 'confidence' berupa angka 0-100 yang menyatakan tingkat keyakinan keterbacaan visual.\n" +
        "{{questionBlueprint}}";
    }

    return { success: true, data: settings };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * getSchoolBrandingAction (Fase 17: Branding)
 * Mengambil informasi branding sekolah (Logo & Nama) untuk UI.
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
        logoKiri: s[prefix + 'logo_kiri_url'] || s['logo_kiri_url'] || '/logo/logo_advent.png',
        logoKanan: s[prefix + 'logo_kanan_url'] || s['logo_kanan_url'] || '/logo/tut_wuri.png',
        tahunAjaran: s['tahun_ajaran'] || '2026/2027',
        kkm: parseInt(s[prefix + 'kkm'] || s['kkm'] || '75'),
        kepalaNama: s[prefix + 'kepala_nama'] || '',
        kepalaNip: s[prefix + 'kepala_nip'] || '',
        panitiaNama: s[prefix + 'panitia_nama'] || '',
        panitiaNip: s[prefix + 'panitia_nip'] || ''
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil parameter sesi akademik yang sedang aktif (Tahun Ajaran & Semester)
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
        mapelEksakta: (settings['mapel_eksakta_keywords'] || 'IPA, Matematika, Fisika, Kimia, Biologi, Informatika').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        minConfidence: Number(settings['min_confidence'] || 60),
        autoSync: settings['auto_sync'] === 'true'
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * Menentukan nilai KKM untuk sebuah mapel berdasarkan referensi Mapel Eksakta.
 */
export async function getKkmForMapelAction(mapelName: string) {
  try {
    const res = await getSettingsAction();
    if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat pengaturan.');
    const s = res.data;
    
    const eksaktaStr = s['mapel_eksakta_keywords'] || 'IPA, Matematika, Fisika, Kimia, Biologi';
    const eksaktaArr = eksaktaStr.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    
    const isEksakta = eksaktaArr.some(k => mapelName.toLowerCase().includes(k));
    
    const kkm = isEksakta 
      ? parseInt(s['kkm_eksakta'] || '65') 
      : parseInt(s['kkm_non_eksakta'] || '70');
      
    return { success: true, kkm, isEksakta };
  } catch (e: any) {
    return { success: false, kkm: 70, isEksakta: false, message: e.message };
  }
}

/**
 * checkAIStatusAction
 * Melakukan ping sederhana ke Gemini API untuk mengecek apakah API Key valid dan terhubung.
 */
export async function checkAIStatusAction() {
  let modelName = 'gemini-2.5-flash';
  try {
    await requireAdmin();
    const res = await getSettingsAction();
    if (res.success && res.data) {
      modelName = res.data['ai_model'] || modelName;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { success: false, message: 'API Key tidak ditemukan di environment (.env)' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = Array.from(new Set([
      modelName,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-1.5-flash'
    ]));

    const failures: string[] = [];

    for (const candidate of candidateModels) {
      try {
        const apiVersion = 'v1beta';

        const model = genAI.getGenerativeModel({ model: candidate }, { apiVersion });
        const result = await model.generateContent('Katakan saja kata: PONG');
        const response = await result.response;
        const text = response.text();

        if (text.toUpperCase().includes('PONG')) {
          const fallbackNote = candidate === modelName ? ` (${candidate})` : ` (melalui fallback ${candidate})`;
          return { success: true, message: `Terhubung ke AI dengan sukses${fallbackNote}!` };
        }

        failures.push(`${candidate}: respon tidak sesuai`);
      } catch (candidateError: any) {
        failures.push(`${candidate}: ${candidateError.message}`);
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
    let msg = e.message;
    if (msg.includes('429')) {
      const advice = modelName.includes('3.1-pro') || modelName.includes('2.0-flash') 
        ? 'Silakan ganti ke model "Gemini 3 Flash" yang saat ini terverifikasi aktif di akun Anda.' 
        : 'Silakan tunggu beberapa menit atau coba gunakan model lain.';
      return { 
        success: false, 
        message: `Kuota Terlampaui (429): Batas penggunaan model ${modelName} telah tercapai. ${advice}` 
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
    adminId = session.id; // Override adminId with session ID
    const existing = await dbGetAll('SETTINGS');
    
    // Check if we need to migrate old data if academic session changes
    const oldTahun = existing.find(s => s.key === 'tahun_ajaran')?.value;
    const oldSemester = existing.find(s => s.key === 'semester')?.value;
    const newTahun = updates['tahun_ajaran'];
    const newSemester = updates['semester'] ? String(updates['semester']).trim().toUpperCase() : undefined;

    const mergedMap = new Map<string, string>();
    for (const row of existing) {
      if (row.key) mergedMap.set(String(row.key), String(row.value ?? ''));
    }

    for (const [key, value] of Object.entries(updates)) {
      if (!key) continue;
      let v = sanitizeInput(String(value || ''));
      if (key === 'semester' && v) v = v.toUpperCase();
      if (key === 'tahun_ajaran' && v) v = v.trim();
      mergedMap.set(key, v);
    }

    const newRows = Array.from(mergedMap.entries()).map(([k, v]) => [k, v]);
    await dbReplaceSheetData('SETTINGS', ['key', 'value'], newRows);

    // If session changed, we might want to log it specifically
    if ((newTahun && newTahun !== oldTahun) || (newSemester && newSemester !== oldSemester)) {
      await logger.warn('ACADEMIC_CHANGE', `Sesi akademik diubah ke: ${newTahun} - ${newSemester}`, adminId);
    }

    await logger.info('UPD_SETTINGS', `Memperbarui ${Object.keys(updates).length} pengaturan sistem`, adminId);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * backupDatabaseAction (Fase 17: Disaster Recovery)
 * Mengunduh seluruh data sheet ke dalam format JSON terkompresi.
 */
export async function backupDatabaseAction(adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id; // Override adminId with session ID
    const sheets = ['USERS', 'KELAS', 'MAPEL', 'SISWA', 'KUNCI_JAWABAN', 'HASIL', 'SETTINGS', 'TUGAS_GURU', 'AI_FEEDBACK'];
    const backupData: Record<string, any[]> = {};

    for (const sheetName of sheets) {
      backupData[sheetName] = await dbGetAll(sheetName);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `WMVAA_BACKUP_${timestamp}.json`;

    await logger.info('DB_BACKUP', `Backup database berhasil dibuat oleh Admin.`, adminId);

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
 * restoreDatabaseAction (Fase 17: Disaster Recovery)
 * Mengembalikan data dari file JSON backup.
 * PERINGATAN: Tindakan ini bersifat destruktif (menimpa data saat ini).
 */
export async function restoreDatabaseAction(backupData: Record<string, any[]>, adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id; // Override adminId with session ID
    const sheets = getSheets();

    for (const [sheetName, rows] of Object.entries(backupData)) {
      if (rows.length === 0) continue;

      // 1. Bersihkan sheet (kecuali header)
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A2:ZZ`,
      });

      // 2. Siapkan data (convert object back to array based on keys)
      const headers = Object.keys(rows[0]);
      const dataRows = rows.map((r: any) => headers.map(h => r[h]));

      // 3. Tulis data baru
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values: dataRows },
      });
    }

    await logger.warn('DB_RESTORE', `Database berhasil dipulihkan dari file backup.`, adminId);
    return { success: true, message: 'Database berhasil dipulihkan.' };
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
    const allHasil = await dbGetAll('HASIL');
    const allMapel = await dbGetAll('MAPEL');

    // 1. Statistik Dasar
    const totalUjian = allHasil.length;
    const avgSkor = totalUjian > 0 
      ? (allHasil.reduce((sum, h) => sum + parseFloat(h.skor || 0), 0) / totalUjian).toFixed(2)
      : 0;

    // 2. Performa per Mapel
    const mapelStats: Record<string, { total: number, sum: number, avg: number, name: string }> = {};
    allMapel.forEach(m => {
      mapelStats[m.id_mapel] = { total: 0, sum: 0, avg: 0, name: m.nama_mapel };
    });

    // We need to fetch KUNCI to relate HASIL to MAPEL
    const allKunci = await dbGetAll('KUNCI_JAWABAN');
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
        totalGuru: (await dbGetAll('USERS')).filter(u => u.role === 'GURU').length,
        totalSiswa: (await dbGetAll('SISWA')).length
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
