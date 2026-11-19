import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { SessionData, assertSessionSecretConfigured, sessionOptions } from '@/lib/session';
import { getBootstrapMode, getBootstrapUsers } from '@/lib/bootstrap-users';
import { dbGetAll, dbBatchAppendRows, dbAppendRow, isMySqlEnabled } from '@/lib/google-sheets';
import { ensureMySqlTables } from '@/lib/mysql';
import { google } from 'googleapis';
import path from 'path';
import bcrypt from 'bcryptjs';

// ============================================================
// POST /api/setup — Auto-Generate Database Schema
// Membuat semua sheet + header + seed default users
// Hanya perlu dijalankan SEKALI saat pertama kali setup
// ============================================================

const SCHEMA: Record<string, string[]> = {
  USERS: ['id_user', 'username', 'password_hash', 'role', 'nama', 'status', 'profile_url'],
  KELAS: ['id_kelas', 'nama_kelas', 'jenjang', 'tahun_ajaran', 'semester'],
  MAPEL: ['id_mapel', 'nama_mapel'],
  SISWA: ['id_siswa', 'nis', 'nama', 'id_kelas', 'tahun_ajaran', 'semester'],
  KUNCI_JAWABAN: ['id_kunci', 'id_guru', 'id_mapel', 'id_kelas', 'judul_ujian', 'tipe_soal', 'pengaturan_poin', 'data_json', 'timestamp', 'segmen', 'tahun_ajaran', 'semester'],
  HASIL: ['id_hasil', 'id_kunci', 'id_siswa', 'id_guru', 'skor', 'detail_json', 'timestamp', 'is_override', 'override_reason', 'tahun_ajaran', 'semester'],
  LOG: ['timestamp', 'level', 'action', 'message', 'userId'],
  SETTINGS: ['key', 'value'],
  TUGAS_GURU: ['id_tugas', 'id_user', 'id_mapel', 'id_kelas', 'tahun_ajaran', 'semester'],
  AI_FEEDBACK: ['id_feedback', 'id_hasil', 'id_guru', 'tipe_koreksi', 'detail_json', 'timestamp'],
  FILES: ['id', 'file_name', 'file_type', 'category', 'drive_file_id', 'url', 'created_at'],
  TAGIHAN: ['id_tagihan', 'id_siswa', 'tahun_ajaran', 'semester', 'kategori', 'periode_bulan', 'nama_tagihan', 'nominal', 'potongan', 'nominal_akhir', 'terbayar', 'status', 'jatuh_tempo', 'catatan', 'updated_at'],
  PEMBAYARAN: ['id_pembayaran', 'no_kwitansi', 'id_tagihan', 'id_siswa', 'tanggal_bayar', 'nominal_bayar', 'metode', 'status_transaksi', 'id_petugas', 'nama_petugas', 'catatan', 'timestamp'],
};

// Default settings
const DEFAULT_SETTINGS = [
  ['nama_yayasan', 'YAYASAN PENDIDIKAN ADVENT PAPUA'],
  ['nama_sekolah_1', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'],
  ['nama_sekolah_2', 'SMP & SMA ADVENT SOGOKMO'],
  ['smp_nama_sekolah_1', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'],
  ['smp_nama_sekolah_2', 'SMP ADVENT SOGOKMO'],
  ['sma_nama_sekolah_1', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'],
  ['sma_nama_sekolah_2', 'SMA ADVENT SOGOKMO'],
  ['alamat_sekolah', 'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya'],
  ['tahun_ajaran', '2026/2027'],
  ['semester', 'GANJIL'],
  ['kurikulum', 'KURIKULUM MERDEKA (FASE D, E, F)'],
  ['ai_model', 'gemini-2.5-flash'],
];

const DEFAULT_TAHUN_AJARAN = '2026/2027';
const DEFAULT_SEMESTER = 'GANJIL';

// Default master data (Full Kurikulum Merdeka Kelas 7 SMP - 12 SMA)
const DEFAULT_KELAS = [
  { nama: 'KELAS VII', jenjang: 'SMP' },
  { nama: 'KELAS VIII', jenjang: 'SMP' },
  { nama: 'KELAS IX', jenjang: 'SMP' },
  { nama: 'KELAS X', jenjang: 'SMA' },
  { nama: 'KELAS XI', jenjang: 'SMA' },
  { nama: 'KELAS XII', jenjang: 'SMA' },
];

const DEFAULT_MAPEL = [
  'Pendidikan Agama Advent & Budi Pekerti',
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'Bahasa Inggris',
  'Ilmu Pengetahuan Alam (IPA)',
  'Ilmu Pengetahuan Sosial (IPS)',
  'Informatika',
  'Fisika',
  'Kimia',
  'Biologi',
  'Ekonomi',
  'Sosiologi',
  'Geografi',
  'PJOK',
  'Seni Budaya & Prakarya',
];

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function getSheetsClient() {
  const rawCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  const credentialsPath = path.isAbsolute(rawCreds)
    ? rawCreds
    : path.join(/* turbopackIgnore: true */ process.cwd(), rawCreds);
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureAdminSession() {
  const cookieStore = await cookies();
  assertSessionSecretConfigured();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.json({ success: false, message: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Forbidden: Endpoint setup hanya dapat dijalankan oleh admin.' }, { status: 403 });
  }

  return null;
}

function ensureSetupRuntimeEnabled() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RUNTIME_SETUP !== 'true') {
    return NextResponse.json(
      {
        success: false,
        message: 'Endpoint setup dinonaktifkan di production. Set ALLOW_RUNTIME_SETUP=true hanya saat onboarding awal.'
      },
      { status: 403 }
    );
  }

  return null;
}

export async function POST() {
  try {
    const runtimeGuard = ensureSetupRuntimeEnabled();
    if (runtimeGuard) return runtimeGuard;

    const authError = await ensureAdminSession();
    if (authError) return authError;

    if (isMySqlEnabled()) {
      const results: string[] = [];
      await ensureMySqlTables();
      results.push('✅ Semua 11 tabel MySQL telah dibuat/diverifikasi.');

      const existingUsers = await dbGetAll('USERS', false);
      let usersSeeded = 0;
      if (existingUsers.length === 0) {
        const bootstrapUsers = getBootstrapUsers();
        const userRows = bootstrapUsers.map(u => [
          generateId('USR'),
          u.username,
          bcrypt.hashSync(u.password, 10),
          u.role,
          u.nama,
          'Aktif',
          ''
        ]);
        await dbBatchAppendRows('USERS', userRows);
        usersSeeded = userRows.length;
        results.push(`✅ USERS: ${userRows.length} akun bootstrap di-seed (${getBootstrapMode()})`);
      }

      const existingSettings = await dbGetAll('SETTINGS', false);
      if (existingSettings.length === 0) {
        await dbBatchAppendRows('SETTINGS', DEFAULT_SETTINGS);
        results.push(`✅ SETTINGS: ${DEFAULT_SETTINGS.length} konfigurasi default ditulis`);
      }

      const existingKelas = await dbGetAll('KELAS', false);
      if (existingKelas.length === 0) {
        const kelasRows = DEFAULT_KELAS.map(k => [
          generateId('KLS'),
          k.nama,
          k.jenjang,
          DEFAULT_TAHUN_AJARAN,
          DEFAULT_SEMESTER
        ]);
        await dbBatchAppendRows('KELAS', kelasRows);
        results.push(`✅ KELAS: ${kelasRows.length} kelas default di-seed`);
      }

      const existingMapel = await dbGetAll('MAPEL', false);
      if (existingMapel.length === 0) {
        const mapelRows = DEFAULT_MAPEL.map(m => [generateId('MPL'), m]);
        await dbBatchAppendRows('MAPEL', mapelRows);
        results.push(`✅ MAPEL: ${mapelRows.length} mapel default di-seed`);
      }

      await dbAppendRow('LOG', [new Date().toISOString(), 'INFO', 'DB_SETUP', 'Database MySQL berhasil di-setup via /api/setup', 'SYSTEM']);
      results.push('📝 Log setup berhasil dicatat.');

      return NextResponse.json({
        success: true,
        message: '🎉 Database MySQL berhasil di-setup!',
        details: results,
        summary: {
          driver: 'mysql',
          total_tables: Object.keys(SCHEMA).length,
          users_seeded: usersSeeded,
        }
      });
    }

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

    if (!spreadsheetId) {
      return NextResponse.json({ success: false, message: 'GOOGLE_SPREADSHEET_ID belum diset di .env.local' }, { status: 400 });
    }

    const results: string[] = [];

    // ── STEP 1: Ambil daftar sheet yang sudah ada ──
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets?.map(s => s.properties?.title) || [];
    results.push(`📋 Sheet yang sudah ada: [${existingSheets.join(', ')}]`);

    // ── STEP 2: Buat sheet yang belum ada ──
    const sheetNames = Object.keys(SCHEMA);
    const sheetsToCreate = sheetNames.filter(name => !existingSheets.includes(name));

    if (sheetsToCreate.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: sheetsToCreate.map(title => ({
            addSheet: { properties: { title } }
          }))
        }
      });
      results.push(`✅ Membuat ${sheetsToCreate.length} sheet baru: [${sheetsToCreate.join(', ')}]`);
    } else {
      results.push(`ℹ️ Semua sheet sudah ada, skip pembuatan.`);
    }

    // ── STEP 3: Tulis header ke setiap sheet ──
    for (const [sheetName, headers] of Object.entries(SCHEMA)) {
      // Kita akan paksa tulis ulang header ini agar berlaku update schema terbaru (force header update = true)
      /* 
      try {
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:A1`,
        });
        if (existing.data.values && existing.data.values.length > 0 && existing.data.values[0][0]) {
          results.push(`⏭️ ${sheetName}: Header sudah ada, skip.`);
          continue;
        }
      } catch {
        // Sheet mungkin baru dibuat, lanjutkan
      }
      */

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
      results.push(`✅ ${sheetName}: Header berhasil ditulis (${headers.length} kolom)`);
    }

    // ── STEP 4: Seed default users ──
    const usersCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'USERS!A2:A2',
    });

    if (!usersCheck.data.values || usersCheck.data.values.length === 0) {
      const bootstrapUsers = getBootstrapUsers();
      const userRows = bootstrapUsers.map(u => {
        const id = generateId('USR');
        const hash = bcrypt.hashSync(u.password, 10);
        return [id, u.username, hash, u.role, u.nama, 'Aktif', ''];
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'USERS!A:A',
        valueInputOption: 'RAW',
        requestBody: { values: userRows },
      });
      results.push(`✅ USERS: ${userRows.length} akun bootstrap berhasil di-seed (${getBootstrapMode()})`);
    } else {
      results.push(`⏭️ USERS: Sudah ada data, skip seed.`);
    }

    // ── STEP 5: Seed default settings ──
    const settingsCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'SETTINGS!A2:A2',
    });

    if (!settingsCheck.data.values || settingsCheck.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'SETTINGS!A:A',
        valueInputOption: 'RAW',
        requestBody: { values: DEFAULT_SETTINGS },
      });
      results.push(`✅ SETTINGS: ${DEFAULT_SETTINGS.length} konfigurasi default berhasil ditulis`);
    } else {
      results.push(`⏭️ SETTINGS: Sudah ada data, skip.`);
    }

    // ── STEP 6: Seed default kelas ──
    const kelasCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'KELAS!A2:A2',
    });

    if (!kelasCheck.data.values || kelasCheck.data.values.length === 0) {
      const kelasRows = DEFAULT_KELAS.map(k => [
        generateId('KLS'),
        k.nama,
        k.jenjang,
        DEFAULT_TAHUN_AJARAN,
        DEFAULT_SEMESTER
      ]);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'KELAS!A:A',
        valueInputOption: 'RAW',
        requestBody: { values: kelasRows },
      });
      results.push(`✅ KELAS: ${kelasRows.length} kelas default berhasil di-seed`);
    } else {
      results.push(`⏭️ KELAS: Sudah ada data, skip.`);
    }

    // ── STEP 7: Seed default mapel ──
    const mapelCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'MAPEL!A2:A2',
    });

    if (!mapelCheck.data.values || mapelCheck.data.values.length === 0) {
      const mapelRows = DEFAULT_MAPEL.map(m => [generateId('MPL'), m]);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'MAPEL!A:A',
        valueInputOption: 'RAW',
        requestBody: { values: mapelRows },
      });
      results.push(`✅ MAPEL: ${mapelRows.length} mata pelajaran default berhasil di-seed`);
    } else {
      results.push(`⏭️ MAPEL: Sudah ada data, skip.`);
    }

    // ── STEP 8: Hapus Sheet1 default jika ada dan tidak terpakai ──
    if (existingSheets.includes('Sheet1')) {
      const sheet1 = meta.data.sheets?.find(s => s.properties?.title === 'Sheet1');
      if (sheet1?.properties?.sheetId !== undefined) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ deleteSheet: { sheetId: sheet1.properties.sheetId } }]
            }
          });
          results.push(`🗑️ Sheet1 (default kosong) berhasil dihapus.`);
        } catch {
          results.push(`ℹ️ Sheet1 tidak bisa dihapus (mungkin satu-satunya sheet).`);
        }
      }
    }

    // ── STEP 9: Log setup ──
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'LOG!A:A',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[timestamp, 'INFO', 'DB_SETUP', 'Database schema berhasil di-generate via /api/setup', 'SYSTEM']]
      },
    });
    results.push(`📝 Log setup berhasil dicatat.`);

    return NextResponse.json({
      success: true,
      message: '🎉 Database berhasil di-setup!',
      details: results,
      summary: {
        sheets_created: sheetsToCreate.length,
        total_sheets: sheetNames.length,
        users_seeded: (!usersCheck.data.values || usersCheck.data.values.length === 0) ? getBootstrapUsers().length : 0,
        settings_seeded: DEFAULT_SETTINGS.length,
        kelas_seeded: DEFAULT_KELAS.length,
        mapel_seeded: DEFAULT_MAPEL.length,
      }
    });

  } catch (e: any) {
    return NextResponse.json({
      success: false,
      message: 'Gagal setup database: ' + e.message,
    }, { status: 500 });
  }
}

// GET handler — info endpoint
export async function GET() {
  const runtimeGuard = ensureSetupRuntimeEnabled();
  if (runtimeGuard) return runtimeGuard;

  const authError = await ensureAdminSession();
  if (authError) return authError;

  return NextResponse.json({
    endpoint: '/api/setup',
    method: 'POST',
    description: 'Auto-generate database schema di Google Spreadsheet. Membuat semua sheet, header, dan seed data default.',
    warning: 'Endpoint ini aman dijalankan berkali-kali — hanya membuat yang belum ada.',
    sheets: Object.keys(SCHEMA),
    bootstrap_mode: getBootstrapMode(),
    bootstrap_user_count: getBootstrapUsers().length,
  });
}
