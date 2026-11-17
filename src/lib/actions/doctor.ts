'use server';

import { dbGetAll, clearSheetCache } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { google } from 'googleapis';
import path from 'path';
import { getAcademicSessionAction, checkAIStatusAction } from '@/lib/actions/settings';
import { requireAdmin } from '@/lib/session-server';

/**
 * System Doctor — adaptasi apiAdminRunSystemDoctor & apiAdminHealSystem dari GAS.
 * Diagnosa integritas database dan pulihkan sheet yang hilang secara otomatis.
 */

// ─── Doctor Check: AI Connectivity ────────────────────────────
async function doctorCheckAIConnectivity(): Promise<any> {
  try {
    const res = await checkAIStatusAction();
    return {
      name: 'Konektivitas AI Engine (Gemini API)',
      status: res.success ? 'HEALTHY' : 'ERROR',
      message: res.message,
      details: { success: res.success }
    };
  } catch (e: any) {
    return {
      name: 'Konektivitas AI Engine (Gemini API)',
      status: 'ERROR',
      message: 'Gagal melakukan pengecekan: ' + e.message,
      details: { success: false }
    };
  }
}

const REQUIRED_SHEETS = [
  'USERS',
  'KELAS',
  'MAPEL',
  'SISWA',
  'KUNCI_JAWABAN',
  'HASIL',
  'LOG',
  'SETTINGS',
  'TUGAS_GURU',
  'AI_FEEDBACK',
  'FILES'
];

// SCHEMA DEFINITION for Migration (Fase 2.1)
const SCHEMA_MAP: Record<string, string[]> = {
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
};

const LEGACY_USERS_HEADERS = ['id_user', 'username', 'password_hash', 'role', 'nama', 'status', 'profile_url', 'profile_url'];

function isLegacyUsersSchema(headers: string[]) {
  return LEGACY_USERS_HEADERS.every((header, index) => headers[index] === header);
}

function looksLikeUserStatus(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'aktif' || normalized === 'non-aktif';
}

function normalizeLegacyUsersRow(row: string[]) {
  const status = looksLikeUserStatus(row[6]) ? row[6] : looksLikeUserStatus(row[5]) ? row[5] : 'Aktif';
  const profileUrl = row[7] || (looksLikeUserStatus(row[6]) ? '' : row[6] || '');

  return [
    row[0] || '',
    row[1] || '',
    row[2] || '',
    row[3] || '',
    row[4] || '',
    status,
    profileUrl
  ];
}

function normalizeRowForSchema(
  sheetName: string,
  currentHeaders: string[],
  row: string[],
  targetHeaders: string[],
  tahunAktif: string,
  semesterAktif: string
) {
  if (sheetName === 'USERS' && isLegacyUsersSchema(currentHeaders)) {
    return normalizeLegacyUsersRow(row);
  }

  const currentRow: Record<string, string> = {};
  currentHeaders.forEach((header, index) => {
    currentRow[header] = row[index] !== undefined ? String(row[index]) : '';
  });

  return targetHeaders.map((header) => {
    if (header === 'tahun_ajaran') return currentRow[header] || tahunAktif;
    if (header === 'semester') return currentRow[header] || semesterAktif;
    if (header === 'userId') return currentRow.userId || currentRow.user_id || '';
    return currentRow[header] ?? '';
  });
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

// ─── Doctor Check: Integritas Sheet ────────────────────────────
async function doctorCheckIntegrity(): Promise<any> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = (meta.data.sheets || []).map(s => s.properties?.title || '');

  const missing = REQUIRED_SHEETS.filter(name => !existingSheets.includes(name));

  return {
    name: 'Integritas Struktur Database',
    status: missing.length === 0 ? 'HEALTHY' : 'WARNING',
    message: missing.length === 0
      ? `Semua ${REQUIRED_SHEETS.length} sheet terdeteksi lengkap.`
      : `Sheet berikut HILANG: ${missing.join(', ')}`,
    details: { total: REQUIRED_SHEETS.length, existing: existingSheets.length, missing }
  };
}

// ─── Doctor Check: Orphan Data ─────────────────────────────────
async function doctorCheckOrphans(): Promise<any> {
  const hasil = await dbGetAll('HASIL');
  const kunci = await dbGetAll('KUNCI_JAWABAN');
  const siswa = await dbGetAll('SISWA');

  const kunciIds = new Set(kunci.map((k: any) => k.id_kunci));
  const siswaIds = new Set(siswa.map((s: any) => s.id_siswa));

  const orphanKunci = hasil.filter((h: any) => h.id_kunci && !kunciIds.has(h.id_kunci));
  const orphanSiswa = hasil.filter((h: any) => h.id_siswa && !siswaIds.has(h.id_siswa));

  const total = orphanKunci.length + orphanSiswa.length;

  return {
    name: 'Deteksi Orphan Data (Yatim Piatu Referensial)',
    status: total === 0 ? 'HEALTHY' : 'WARNING',
    message: total === 0
      ? 'Tidak ada rekaman mengarah ke entitas yang sudah dihapus.'
      : `Ditemukan ${total} rekaman yatim piatu (${orphanKunci.length} kunci hilang, ${orphanSiswa.length} siswa hilang).`,
    details: { orphanKunci: orphanKunci.length, orphanSiswa: orphanSiswa.length }
  };
}

// ─── Doctor Check: Anomali Statistik ───────────────────────────
async function doctorCheckAnomalies(): Promise<any> {
  const hasil = await dbGetAll('HASIL');

  if (hasil.length < 10) {
    return {
      name: 'Anomali Statistik Skor',
      status: 'HEALTHY',
      message: `Data hasil baru ${hasil.length} rekaman. Belum cukup sampel untuk analisis anomali yang andal.`,
      details: { total: hasil.length, extreme: 0, pct: 0, minSample: 10 }
    };
  }

  let suspicious = 0;
  hasil.forEach((h: any) => {
    const skor = parseInt(h.skor, 10);
    if (skor === 0 || skor === 100) suspicious++;
  });

  const pct = hasil.length > 0 ? Math.round((suspicious / hasil.length) * 100) : 0;

  return {
    name: 'Anomali Statistik Skor',
    status: pct > 50 ? 'WARNING' : 'HEALTHY',
    message: pct > 50
      ? `${pct}% skor bernilai 0 atau 100 — kemungkinan kesalahan pemindaian AI atau kecurangan.`
      : `Distribusi skor tampak normal (${suspicious}/${hasil.length} bernilai ekstrem).`,
    details: { total: hasil.length, extreme: suspicious, pct }
  };
}

// ─── Doctor Check: Volume Log ──────────────────────────────────
async function doctorCheckLogVolume(): Promise<any> {
  const logs = await dbGetAll('LOG');

  return {
    name: 'Volume Audit Log',
    status: logs.length > 5000 ? 'WARNING' : 'HEALTHY',
    message: logs.length > 5000
      ? `Sheet LOG memiliki ${logs.length} baris — pertimbangkan rotasi otomatis untuk menjaga performa.`
      : `${logs.length} catatan log terdokumentasi dengan baik.`,
    details: { total: logs.length }
  };
}

// ─── Gabungkan semua pengecekan ────────────────────────────────
export async function runSystemDoctorAction(adminId: string = 'SYSTEM') {
  try {
    const session = await requireAdmin();
    adminId = session.id;
    const diagnostics = await Promise.all([
      doctorCheckIntegrity(),
      doctorCheckAIConnectivity(),
      doctorCheckOrphans(),
      doctorCheckAnomalies(),
      doctorCheckLogVolume()
    ]);

    await logger.info('SYSTEM_DOCTOR', 'Audit Diagnostik Sistem dijalankan.', adminId);
    return { success: true, data: diagnostics };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// ─── Auto-Heal: Buat sheet yang hilang & Migrasi Arsitektur ───
export async function healSystemAction(adminId: string = 'SYSTEM') {
  try {
    const sessionUser = await requireAdmin();
    adminId = sessionUser.id;
    const { data: session } = await getAcademicSessionAction();
    const tahunAktif = session?.tahunAjaran || '2025/2026';
    const semesterAktif = session?.semester || 'GANJIL';

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = new Set((meta.data.sheets || []).map(s => s.properties?.title || ''));

    const missing = REQUIRED_SHEETS.filter(name => !existingSheets.has(name));
    const heallog: string[] = [];

    // 1. Pulihkan Sheet yang Hilang
    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: { properties: { title } }
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });

      missing.forEach((s) => {
        existingSheets.add(s);
        heallog.push(`Membangun ulang sheet: ${s}`);
      });
    }

    // 2. Normalisasi schema + migrasi sesi akademik
    const sheetsToMigrate = Object.keys(SCHEMA_MAP);
    
    for (const sName of sheetsToMigrate) {
      if (!existingSheets.has(sName)) continue;

      const headers = SCHEMA_MAP[sName];
      const rawResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sName}!A1:ZZ`,
      });
      const rawRows = rawResponse.data.values || [];
      const currentHeaders = rawRows[0] || [];
      const dataRows = rawRows.slice(1);

      const headerMatches = headers.length === currentHeaders.length &&
        headers.every((header, index) => currentHeaders[index] === header);

      const legacyUsersSchema = sName === 'USERS' && isLegacyUsersSchema(currentHeaders);
      let needsSessionBackfill = false;
      const normalizedRows = dataRows.map((row) => {
        const currentRow: Record<string, string> = {};
        currentHeaders.forEach((header, index) => {
          currentRow[header] = row[index] !== undefined ? String(row[index]) : '';
        });

        if ((headers.includes('tahun_ajaran') && !currentRow.tahun_ajaran) ||
            (headers.includes('semester') && !currentRow.semester)) {
          needsSessionBackfill = true;
        }

        return normalizeRowForSchema(sName, currentHeaders, row, headers, tahunAktif, semesterAktif);
      });

      const needsRewrite = !headerMatches || needsSessionBackfill || legacyUsersSchema;

      if (needsRewrite) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sName}!A1:ZZ`,
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers, ...normalizedRows],
          },
        });
        if (legacyUsersSchema) {
          heallog.push(`Normalisasi schema ${sName}: kolom password-plain legacy dibuang dan ${normalizedRows.length} baris dipulihkan.`);
        } else {
          heallog.push(`Normalisasi schema ${sName}: header dan ${normalizedRows.length} baris data diselaraskan.`);
        }
      }
    }

    clearSheetCache();
    await logger.info('SYSTEM_HEAL', `Auto-Heal & Migration: ${heallog.length} tindakan dilakukan.`, adminId);

    return {
      success: true,
      message: heallog.length > 0
        ? heallog.join('\n')
        : 'Sistem dalam keadaan prima. Tidak ada tindakan penyembuhan atau migrasi yang diperlukan.'
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
