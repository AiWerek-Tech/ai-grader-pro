import { google } from 'googleapis';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? (path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS))
  : path.join(process.cwd(), 'supabase-auth-480321-4f0aeef2cb76.json');

const TABLES = {
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

const PRIMARY_KEYS = {
  USERS: 'id_user',
  KELAS: 'id_kelas',
  MAPEL: 'id_mapel',
  SISWA: 'id_siswa',
  KUNCI_JAWABAN: 'id_kunci',
  HASIL: 'id_hasil',
  LOG: null,
  SETTINGS: 'key',
  TUGAS_GURU: 'id_tugas',
  AI_FEEDBACK: 'id_feedback',
  FILES: 'id',
};

async function main() {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SPREADSHEET_ID tidak ditemukan di environment.');
  }
  if (!process.env.MYSQL_DATABASE || !process.env.MYSQL_USER) {
    throw new Error('MYSQL_DATABASE dan MYSQL_USER harus diisi di .env.local.');
  }

  console.log('1. Menghubungkan ke Google Sheets...');
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`2. Menghubungkan ke MySQL (${process.env.MYSQL_HOST || 'localhost'}/${process.env.MYSQL_DATABASE})...`);
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  // Pastikan skema tabel sudah terbuat
  const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await conn.query(schemaSql);
    console.log('   Skema tabel MySQL berhasil dipastikan.');
  }

  const report = [];

  for (const [tableName, cols] of Object.entries(TABLES)) {
    let rawRows = [];
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tableName}!A1:ZZ`,
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      report.push({ table: tableName, sheetRows: 0, mysqlRows: 0, status: `Skip (${e.message})` });
      continue;
    }

    if (rawRows.length < 2) {
      report.push({ table: tableName, sheetRows: 0, mysqlRows: 0, status: 'Kosong' });
      continue;
    }

    const headers = rawRows[0].map((h) => String(h || '').trim());
    const dataRows = rawRows.slice(1);
    const pk = PRIMARY_KEYS[tableName];

    const validRows = [];
    for (const rawRow of dataRows) {
      const rowMap = {};
      headers.forEach((h, idx) => {
        rowMap[h] = rawRow[idx] !== undefined ? rawRow[idx] : '';
      });

      const hasAnyValue = cols.some((c, idx) => {
        const val = rowMap[c] !== undefined ? rowMap[c] : rawRow[idx];
        return val !== undefined && String(val).trim() !== '';
      });
      if (!hasAnyValue) continue;

      if (pk) {
        const pkVal = rowMap[pk] !== undefined ? rowMap[pk] : rawRow[0];
        if (!pkVal || String(pkVal).trim() === '') continue;
      }

      validRows.push(
        cols.map((c, idx) => {
          const val = rowMap[c] !== undefined ? rowMap[c] : (rawRow[idx] !== undefined ? rawRow[idx] : '');
          return val === null || val === undefined ? '' : String(val);
        })
      );
    }

    if (validRows.length > 0) {
      if (tableName === 'LOG') {
        await conn.query('TRUNCATE TABLE `LOG`');
      }

      const colList = cols.map((c) => `\`${c}\``).join(', ');
      const chunkSize = 200;
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        const rowPlaceholders = `(${cols.map(() => '?').join(', ')})`;
        const allPlaceholders = chunk.map(() => rowPlaceholders).join(', ');

        if (pk) {
          const updateCols = cols
            .filter((c) => c !== pk)
            .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(', ');
          await conn.query(
            `INSERT INTO \`${tableName}\` (${colList}) VALUES ${allPlaceholders} ON DUPLICATE KEY UPDATE ${updateCols}`,
            chunk.flat()
          );
        } else {
          await conn.query(
            `INSERT INTO \`${tableName}\` (${colList}) VALUES ${allPlaceholders}`,
            chunk.flat()
          );
        }
      }
    }

    const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
    const mysqlCount = countRows[0]?.total ?? 0;
    report.push({
      table: tableName,
      sheetRows: validRows.length,
      mysqlRows: mysqlCount,
      status: mysqlCount >= validRows.length ? 'OK' : 'MISMATCH',
    });
  }

  await conn.end();
  console.log('\n=== HASIL MIGRASI GOOGLE SHEETS -> MYSQL ===');
  console.table(report);
}

main().catch((err) => {
  console.error('Migrasi gagal:', err);
  process.exit(1);
});
