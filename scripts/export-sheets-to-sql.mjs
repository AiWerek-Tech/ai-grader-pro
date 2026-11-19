import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1WQfkX7hYj6a3yGbWZfWBepUZZTqGEF5aaMNHWgxXAjk';
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'supabase-auth-480321-4f0aeef2cb76.json');

const TABLE_SCHEMAS = {
  USERS: {
    pk: 'id_user',
    columns: ['id_user', 'username', 'password_hash', 'role', 'nama', 'status', 'profile_url'],
    ddl: `CREATE TABLE IF NOT EXISTS \`USERS\` (
  \`id_user\` VARCHAR(64) NOT NULL,
  \`username\` VARCHAR(100) NOT NULL,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`role\` VARCHAR(32) NOT NULL DEFAULT 'GURU',
  \`nama\` VARCHAR(255) NOT NULL,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'Aktif',
  \`profile_url\` TEXT,
  PRIMARY KEY (\`id_user\`),
  INDEX \`idx_users_username\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  KELAS: {
    pk: 'id_kelas',
    columns: ['id_kelas', 'nama_kelas', 'jenjang', 'tahun_ajaran', 'semester'],
    ddl: `CREATE TABLE IF NOT EXISTS \`KELAS\` (
  \`id_kelas\` VARCHAR(64) NOT NULL,
  \`nama_kelas\` VARCHAR(128) NOT NULL,
  \`jenjang\` VARCHAR(64) DEFAULT '',
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (\`id_kelas\`),
  INDEX \`idx_kelas_tahun_sem\` (\`tahun_ajaran\`, \`semester\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  MAPEL: {
    pk: 'id_mapel',
    columns: ['id_mapel', 'nama_mapel'],
    ddl: `CREATE TABLE IF NOT EXISTS \`MAPEL\` (
  \`id_mapel\` VARCHAR(64) NOT NULL,
  \`nama_mapel\` VARCHAR(255) NOT NULL,
  PRIMARY KEY (\`id_mapel\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  SISWA: {
    pk: 'id_siswa',
    columns: ['id_siswa', 'nis', 'nama', 'id_kelas', 'tahun_ajaran', 'semester'],
    ddl: `CREATE TABLE IF NOT EXISTS \`SISWA\` (
  \`id_siswa\` VARCHAR(64) NOT NULL,
  \`nis\` VARCHAR(64) NOT NULL,
  \`nama\` VARCHAR(255) NOT NULL,
  \`id_kelas\` VARCHAR(64) NOT NULL,
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (\`id_siswa\`),
  INDEX \`idx_siswa_nis\` (\`nis\`),
  INDEX \`idx_siswa_kelas\` (\`id_kelas\`),
  INDEX \`idx_siswa_tahun_sem\` (\`tahun_ajaran\`, \`semester\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  KUNCI_JAWABAN: {
    pk: 'id_kunci',
    columns: ['id_kunci', 'id_guru', 'id_mapel', 'id_kelas', 'judul_ujian', 'tipe_soal', 'pengaturan_poin', 'data_json', 'timestamp', 'segmen', 'tahun_ajaran', 'semester'],
    ddl: `CREATE TABLE IF NOT EXISTS \`KUNCI_JAWABAN\` (
  \`id_kunci\` VARCHAR(64) NOT NULL,
  \`id_guru\` VARCHAR(64) NOT NULL,
  \`id_mapel\` VARCHAR(64) DEFAULT '',
  \`id_kelas\` VARCHAR(64) DEFAULT '',
  \`judul_ujian\` VARCHAR(255) NOT NULL,
  \`tipe_soal\` VARCHAR(64) DEFAULT '',
  \`pengaturan_poin\` MEDIUMTEXT,
  \`data_json\` LONGTEXT,
  \`timestamp\` VARCHAR(64) DEFAULT '',
  \`segmen\` TEXT,
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (\`id_kunci\`),
  INDEX \`idx_kunci_guru\` (\`id_guru\`),
  INDEX \`idx_kunci_kelas\` (\`id_kelas\`),
  INDEX \`idx_kunci_tahun_sem\` (\`tahun_ajaran\`, \`semester\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  HASIL: {
    pk: 'id_hasil',
    columns: ['id_hasil', 'id_kunci', 'id_siswa', 'id_guru', 'skor', 'detail_json', 'timestamp', 'is_override', 'override_reason', 'tahun_ajaran', 'semester'],
    ddl: `CREATE TABLE IF NOT EXISTS \`HASIL\` (
  \`id_hasil\` VARCHAR(64) NOT NULL,
  \`id_kunci\` VARCHAR(64) NOT NULL,
  \`id_siswa\` VARCHAR(64) NOT NULL,
  \`id_guru\` VARCHAR(64) DEFAULT '',
  \`skor\` VARCHAR(32) DEFAULT '0',
  \`detail_json\` LONGTEXT,
  \`timestamp\` VARCHAR(64) DEFAULT '',
  \`is_override\` VARCHAR(32) DEFAULT '',
  \`override_reason\` TEXT,
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (\`id_hasil\`),
  INDEX \`idx_hasil_kunci\` (\`id_kunci\`),
  INDEX \`idx_hasil_siswa\` (\`id_siswa\`),
  INDEX \`idx_hasil_kunci_siswa\` (\`id_kunci\`, \`id_siswa\`),
  INDEX \`idx_hasil_guru\` (\`id_guru\`),
  INDEX \`idx_hasil_tahun_sem\` (\`tahun_ajaran\`, \`semester\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  LOG: {
    pk: null,
    columns: ['timestamp', 'level', 'action', 'message', 'userId'],
    ddl: `CREATE TABLE IF NOT EXISTS \`LOG\` (
  \`log_seq\` BIGINT NOT NULL AUTO_INCREMENT,
  \`timestamp\` VARCHAR(64) DEFAULT '',
  \`level\` VARCHAR(32) DEFAULT 'INFO',
  \`action\` VARCHAR(128) DEFAULT '',
  \`message\` TEXT,
  \`userId\` VARCHAR(64) DEFAULT 'SYSTEM',
  PRIMARY KEY (\`log_seq\`),
  INDEX \`idx_log_ts\` (\`timestamp\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  SETTINGS: {
    pk: 'key',
    columns: ['key', 'value'],
    ddl: `CREATE TABLE IF NOT EXISTS \`SETTINGS\` (
  \`key\` VARCHAR(128) NOT NULL,
  \`value\` LONGTEXT,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  TUGAS_GURU: {
    pk: 'id_tugas',
    columns: ['id_tugas', 'id_user', 'id_mapel', 'id_kelas', 'tahun_ajaran', 'semester'],
    ddl: `CREATE TABLE IF NOT EXISTS \`TUGAS_GURU\` (
  \`id_tugas\` VARCHAR(64) NOT NULL,
  \`id_user\` VARCHAR(64) NOT NULL,
  \`id_mapel\` VARCHAR(64) NOT NULL,
  \`id_kelas\` VARCHAR(64) NOT NULL,
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (\`id_tugas\`),
  INDEX \`idx_tugas_user\` (\`id_user\`),
  INDEX \`idx_tugas_kelas\` (\`id_kelas\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  AI_FEEDBACK: {
    pk: 'id_feedback',
    columns: ['id_feedback', 'id_hasil', 'id_guru', 'tipe_koreksi', 'detail_json', 'timestamp'],
    ddl: `CREATE TABLE IF NOT EXISTS \`AI_FEEDBACK\` (
  \`id_feedback\` VARCHAR(64) NOT NULL,
  \`id_hasil\` VARCHAR(64) NOT NULL,
  \`id_guru\` VARCHAR(64) DEFAULT '',
  \`tipe_koreksi\` VARCHAR(64) DEFAULT '',
  \`detail_json\` LONGTEXT,
  \`timestamp\` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (\`id_feedback\`),
  INDEX \`idx_feedback_hasil\` (\`id_hasil\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  FILES: {
    pk: 'id',
    columns: ['id', 'file_name', 'file_type', 'category', 'drive_file_id', 'url', 'created_at'],
    ddl: `CREATE TABLE IF NOT EXISTS \`FILES\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`file_name\` VARCHAR(255) DEFAULT '',
  \`file_type\` VARCHAR(128) DEFAULT '',
  \`category\` VARCHAR(128) DEFAULT '',
  \`drive_file_id\` VARCHAR(255) DEFAULT '',
  \`url\` TEXT,
  \`created_at\` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  TAGIHAN: {
    pk: 'id_tagihan',
    columns: ['id_tagihan', 'id_siswa', 'tahun_ajaran', 'semester', 'kategori', 'periode_bulan', 'nama_tagihan', 'nominal', 'potongan', 'nominal_akhir', 'terbayar', 'status', 'jatuh_tempo', 'catatan', 'updated_at'],
    ddl: `CREATE TABLE IF NOT EXISTS \`TAGIHAN\` (
  \`id_tagihan\` VARCHAR(64) NOT NULL,
  \`id_siswa\` VARCHAR(64) NOT NULL,
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  \`kategori\` VARCHAR(64) DEFAULT 'SPP',
  \`periode_bulan\` VARCHAR(32) DEFAULT '',
  \`nama_tagihan\` VARCHAR(160) NOT NULL,
  \`nominal\` BIGINT NOT NULL DEFAULT 0,
  \`potongan\` BIGINT NOT NULL DEFAULT 0,
  \`nominal_akhir\` BIGINT NOT NULL DEFAULT 0,
  \`terbayar\` BIGINT NOT NULL DEFAULT 0,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'BELUM_BAYAR',
  \`jatuh_tempo\` VARCHAR(32) DEFAULT '',
  \`catatan\` TEXT,
  \`updated_at\` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (\`id_tagihan\`),
  INDEX \`idx_tagihan_siswa\` (\`id_siswa\`),
  INDEX \`idx_tagihan_tahun_sem\` (\`tahun_ajaran\`, \`semester\`),
  INDEX \`idx_tagihan_periode\` (\`periode_bulan\`),
  INDEX \`idx_tagihan_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  },
  PEMBAYARAN: {
    pk: 'id_pembayaran',
    columns: ['id_pembayaran', 'no_kwitansi', 'id_tagihan', 'id_siswa', 'tanggal_bayar', 'nominal_bayar', 'metode', 'status_transaksi', 'id_petugas', 'nama_petugas', 'catatan', 'timestamp'],
    ddl: `CREATE TABLE IF NOT EXISTS \`PEMBAYARAN\` (
  \`id_pembayaran\` VARCHAR(64) NOT NULL,
  \`no_kwitansi\` VARCHAR(64) NOT NULL,
  \`id_tagihan\` VARCHAR(64) NOT NULL,
  \`id_siswa\` VARCHAR(64) NOT NULL,
  \`tanggal_bayar\` VARCHAR(32) DEFAULT '',
  \`nominal_bayar\` BIGINT NOT NULL DEFAULT 0,
  \`metode\` VARCHAR(32) DEFAULT 'TUNAI',
  \`status_transaksi\` VARCHAR(32) NOT NULL DEFAULT 'VALID',
  \`id_petugas\` VARCHAR(64) DEFAULT '',
  \`nama_petugas\` VARCHAR(128) DEFAULT '',
  \`catatan\` TEXT,
  \`timestamp\` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (\`id_pembayaran\`),
  INDEX \`idx_bayar_kwitansi\` (\`no_kwitansi\`),
  INDEX \`idx_bayar_tagihan\` (\`id_tagihan\`),
  INDEX \`idx_bayar_siswa\` (\`id_siswa\`),
  INDEX \`idx_bayar_tanggal\` (\`tanggal_bayar\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  }
};

function sqlEscape(val) {
  if (val === null || val === undefined) return "''";
  const str = String(val);
  return "'" + str
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\x1a/g, '\\Z') + "'";
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const outDir = path.join(process.cwd(), 'database');
  fs.mkdirSync(outDir, { recursive: true });

  const schemaParts = [
    '-- WMVAA AI Grader Pro - MySQL Schema',
    `-- Generated at: ${new Date().toISOString()}`,
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    ''
  ];

  const dataParts = [];
  const summary = [];

  for (const [tableName, config] of Object.entries(TABLE_SCHEMAS)) {
    schemaParts.push(`-- Table: ${tableName}`);
    schemaParts.push(config.ddl);
    schemaParts.push('');

    let rows = [];
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tableName}!A1:ZZ`,
      });
      rows = resp.data.values || [];
    } catch (e) {
      console.warn(`Warning: sheet ${tableName} tidak dapat dibaca (${e.message})`);
      summary.push({ table: tableName, rows: 0, note: 'Sheet tidak ada/kosong' });
      continue;
    }

    if (rows.length < 2) {
      summary.push({ table: tableName, rows: 0, note: 'Kosong (hanya header)' });
      continue;
    }

    const headers = rows[0].map(h => String(h || '').trim());
    const dataRows = rows.slice(1);
    const cols = config.columns;

    dataParts.push(`-- Data for table: ${tableName} (${dataRows.length} rows)`);
    if (tableName === 'LOG') {
      dataParts.push('TRUNCATE TABLE `LOG`;');
    }

    const colList = cols.map(c => `\`${c}\``).join(', ');
    const batchSize = 50;
    let validCount = 0;

    for (let i = 0; i < dataRows.length; i += batchSize) {
      const chunk = dataRows.slice(i, i + batchSize);
      const valueTuples = [];

      for (const rawRow of chunk) {
        // Map by header name if present, else by index
        const rowMap = {};
        headers.forEach((h, idx) => {
          rowMap[h] = rawRow[idx] !== undefined ? rawRow[idx] : '';
        });

        // Skip totally empty rows
        const hasAnyValue = cols.some((c, idx) => {
          const val = rowMap[c] !== undefined ? rowMap[c] : rawRow[idx];
          return val !== undefined && String(val).trim() !== '';
        });
        if (!hasAnyValue) continue;

        // If table has PK, ensure PK is non-empty
        if (config.pk) {
          const pkVal = rowMap[config.pk] !== undefined ? rowMap[config.pk] : rawRow[0];
          if (!pkVal || String(pkVal).trim() === '') continue;
        }

        const tupleVals = cols.map((c, idx) => {
          const val = rowMap[c] !== undefined ? rowMap[c] : (rawRow[idx] !== undefined ? rawRow[idx] : '');
          return sqlEscape(val);
        });
        valueTuples.push(`(${tupleVals.join(', ')})`);
        validCount++;
      }

      if (valueTuples.length > 0) {
        if (config.pk) {
          const updateCols = cols
            .filter(c => c !== config.pk)
            .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(', ');
          dataParts.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${valueTuples.join(',\n')}\nON DUPLICATE KEY UPDATE ${updateCols};\n`);
        } else {
          dataParts.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${valueTuples.join(',\n')};\n`);
        }
      }
    }

    summary.push({ table: tableName, rows: validCount, note: 'OK' });
  }

  const footer = ['SET FOREIGN_KEY_CHECKS = 1;', ''];

  const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedFile = path.join(outDir, `wmvaa_backup_${nowStamp}.sql`);
  const fullSql = [...schemaParts, ...dataParts, ...footer].join('\n');

  fs.writeFileSync(path.join(outDir, 'schema.sql'), [...schemaParts, ...footer].join('\n'), 'utf8');
  fs.writeFileSync(path.join(outDir, 'migration_full.sql'), fullSql, 'utf8');
  fs.writeFileSync(timestampedFile, fullSql, 'utf8');

  console.log('=== SUMMARY EXPORT GOOGLE SHEETS -> MYSQL SQL ===');
  console.table(summary);
  console.log('Generated (Schema):', path.join(outDir, 'schema.sql'));
  console.log('Generated (Latest):', path.join(outDir, 'migration_full.sql'));
  console.log('Generated (Timestamped Snapshot):', timestampedFile);
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
