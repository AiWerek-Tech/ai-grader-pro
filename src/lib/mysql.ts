import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface TableSchemaConfig {
  pk: string | null;
  columns: string[];
  ddl: string;
}

export const MYSQL_TABLE_SCHEMAS: Record<string, TableSchemaConfig> = {
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  MAPEL: {
    pk: 'id_mapel',
    columns: ['id_mapel', 'nama_mapel'],
    ddl: `CREATE TABLE IF NOT EXISTS \`MAPEL\` (
  \`id_mapel\` VARCHAR(64) NOT NULL,
  \`nama_mapel\` VARCHAR(255) NOT NULL,
  PRIMARY KEY (\`id_mapel\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  KUNCI_JAWABAN: {
    pk: 'id_kunci',
    columns: [
      'id_kunci',
      'id_guru',
      'id_mapel',
      'id_kelas',
      'judul_ujian',
      'tipe_soal',
      'pengaturan_poin',
      'data_json',
      'timestamp',
      'segmen',
      'tahun_ajaran',
      'semester',
    ],
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
  \`segmen\` VARCHAR(128) DEFAULT '',
  \`tahun_ajaran\` VARCHAR(32) DEFAULT '',
  \`semester\` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (\`id_kunci\`),
  INDEX \`idx_kunci_guru\` (\`id_guru\`),
  INDEX \`idx_kunci_kelas\` (\`id_kelas\`),
  INDEX \`idx_kunci_tahun_sem\` (\`tahun_ajaran\`, \`semester\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  HASIL: {
    pk: 'id_hasil',
    columns: [
      'id_hasil',
      'id_kunci',
      'id_siswa',
      'id_guru',
      'skor',
      'detail_json',
      'timestamp',
      'is_override',
      'override_reason',
      'tahun_ajaran',
      'semester',
    ],
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  SETTINGS: {
    pk: 'key',
    columns: ['key', 'value'],
    ddl: `CREATE TABLE IF NOT EXISTS \`SETTINGS\` (
  \`key\` VARCHAR(128) NOT NULL,
  \`value\` LONGTEXT,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
};

declare global {
  var __wmvaaMysqlPool: Pool | undefined;
  var __wmvaaMysqlTablesEnsured: boolean | undefined;
}

export function isMySqlEnabled(): boolean {
  const driver = (process.env.DB_DRIVER || '').trim().toLowerCase();
  if (driver === 'sheets') return false;
  if (driver === 'mysql') return true;
  return Boolean(process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
}

function getSchema(tableName: string): TableSchemaConfig {
  const schema = MYSQL_TABLE_SCHEMAS[tableName];
  if (!schema) {
    throw new Error(`Tabel "${tableName}" tidak terdaftar dalam skema MySQL.`);
  }
  return schema;
}

export function getMySqlPool(): Pool {
  if (!globalThis.__wmvaaMysqlPool) {
    const database = process.env.MYSQL_DATABASE || '';
    const user = process.env.MYSQL_USER || '';
    if (!database || !user) {
      throw new Error('Konfigurasi MYSQL_DATABASE dan MYSQL_USER belum diatur di environment.');
    }

    globalThis.__wmvaaMysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      user,
      password: process.env.MYSQL_PASSWORD || '',
      database,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      charset: 'utf8mb4',
    });
  }
  return globalThis.__wmvaaMysqlPool;
}

export async function ensureMySqlTables(): Promise<void> {
  if (globalThis.__wmvaaMysqlTablesEnsured) return;
  const pool = getMySqlPool();
  for (const schema of Object.values(MYSQL_TABLE_SCHEMAS)) {
    await pool.query(schema.ddl);
  }
  globalThis.__wmvaaMysqlTablesEnsured = true;
}

function toDbValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function normalizeRowValues(columns: string[], values: unknown[]): string[] {
  return columns.map((_, idx) => toDbValue(values[idx]));
}

export async function getMySqlTableNames(): Promise<string[]> {
  const pool = getMySqlPool();
  const [rows] = await pool.query<RowDataPacket[]>('SHOW TABLES');
  return rows.map((r) => String(Object.values(r)[0] || ''));
}

export async function mysqlGetAll(tableName: string): Promise<Record<string, string>[]> {
  const schema = getSchema(tableName);
  await ensureMySqlTables();
  const pool = getMySqlPool();

  const selectCols = schema.columns.map((c) => `\`${c}\``).join(', ');
  const orderBy = tableName === 'LOG' ? ' ORDER BY `log_seq` ASC' : '';
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT ${selectCols} FROM \`${tableName}\`${orderBy}`);

  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of schema.columns) {
      out[col] = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
    }
    return out;
  });
}

export async function mysqlAppendRow(tableName: string, values: unknown[]): Promise<boolean> {
  const schema = getSchema(tableName);
  await ensureMySqlTables();
  const pool = getMySqlPool();

  const colList = schema.columns.map((c) => `\`${c}\``).join(', ');
  const placeholders = schema.columns.map(() => '?').join(', ');
  const normalized = normalizeRowValues(schema.columns, values);

  if (schema.pk) {
    const updateCols = schema.columns
      .filter((c) => c !== schema.pk)
      .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
      .join(', ');
    await pool.query(
      `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateCols}`,
      normalized
    );
  } else {
    await pool.query(
      `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders})`,
      normalized
    );
  }
  return true;
}

export async function mysqlBatchAppendRows(tableName: string, rows: unknown[][]): Promise<boolean> {
  if (!rows || rows.length === 0) return true;
  const schema = getSchema(tableName);
  await ensureMySqlTables();
  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const colList = schema.columns.map((c) => `\`${c}\``).join(', ');
    const updateCols = schema.pk
      ? schema.columns
          .filter((c) => c !== schema.pk)
          .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
          .join(', ')
      : '';

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((r) => normalizeRowValues(schema.columns, r));
      const rowPlaceholders = `(${schema.columns.map(() => '?').join(', ')})`;
      const allPlaceholders = chunk.map(() => rowPlaceholders).join(', ');
      const flatParams = chunk.flat();

      if (schema.pk && updateCols) {
        await conn.query(
          `INSERT INTO \`${tableName}\` (${colList}) VALUES ${allPlaceholders} ON DUPLICATE KEY UPDATE ${updateCols}`,
          flatParams
        );
      } else {
        await conn.query(
          `INSERT INTO \`${tableName}\` (${colList}) VALUES ${allPlaceholders}`,
          flatParams
        );
      }
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function mysqlUpdateRow(
  tableName: string,
  targetId: string,
  newValues: unknown[]
): Promise<boolean> {
  const schema = getSchema(tableName);
  if (!schema.pk) {
    throw new Error(`Tabel "${tableName}" tidak memiliki primary key untuk update.`);
  }
  await ensureMySqlTables();
  const pool = getMySqlPool();

  const normalized = normalizeRowValues(schema.columns, newValues);
  const setClauses = schema.columns.map((c) => `\`${c}\` = ?`).join(', ');
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE \`${tableName}\` SET ${setClauses} WHERE \`${schema.pk}\` = ?`,
    [...normalized, String(targetId)]
  );

  return result.affectedRows > 0;
}

export async function mysqlBatchUpdateRows(
  tableName: string,
  updates: { id: string; values: unknown[] }[]
): Promise<boolean> {
  if (!updates || updates.length === 0) return true;
  const schema = getSchema(tableName);
  if (!schema.pk) {
    throw new Error(`Tabel "${tableName}" tidak memiliki primary key untuk batch update.`);
  }
  await ensureMySqlTables();
  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const setClauses = schema.columns.map((c) => `\`${c}\` = ?`).join(', ');
    const sql = `UPDATE \`${tableName}\` SET ${setClauses} WHERE \`${schema.pk}\` = ?`;

    for (const update of updates) {
      const normalized = normalizeRowValues(schema.columns, update.values);
      await conn.query(sql, [...normalized, String(update.id)]);
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function mysqlFindAndDeleteRow(tableName: string, targetId: string): Promise<boolean> {
  const schema = getSchema(tableName);
  if (!schema.pk) {
    throw new Error(`Tabel "${tableName}" tidak memiliki primary key untuk penghapusan.`);
  }
  await ensureMySqlTables();
  const pool = getMySqlPool();

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM \`${tableName}\` WHERE \`${schema.pk}\` = ?`,
    [String(targetId)]
  );
  return result.affectedRows > 0;
}

export async function mysqlDeleteRows(
  tableName: string,
  _startIndex: number,
  count: number
): Promise<boolean> {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return true;
  getSchema(tableName);
  await ensureMySqlTables();
  const pool = getMySqlPool();

  if (tableName === 'LOG') {
    await pool.query(`DELETE FROM \`LOG\` ORDER BY \`log_seq\` ASC LIMIT ?`, [safeCount]);
    return true;
  }

  await pool.query(`DELETE FROM \`${tableName}\` LIMIT ?`, [safeCount]);
  return true;
}

export async function mysqlReplaceTableData(
  tableName: string,
  headers: string[],
  rows: (string | number | boolean)[][]
): Promise<boolean> {
  const schema = getSchema(tableName);
  await ensureMySqlTables();
  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM \`${tableName}\``);

    if (rows && rows.length > 0) {
      // Map each incoming row by matching header names (gracefully ignores legacy extra columns like password_plain)
      const headerIdxMap = new Map<string, number>();
      headers.forEach((h, idx) => headerIdxMap.set(String(h).trim(), idx));

      const mappedRows = rows.map((row) =>
        schema.columns.map((col, colIdx) => {
          const idx = headerIdxMap.has(col) ? headerIdxMap.get(col)! : colIdx;
          return toDbValue(row[idx]);
        })
      );

      const colList = schema.columns.map((c) => `\`${c}\``).join(', ');
      const chunkSize = 500;
      for (let i = 0; i < mappedRows.length; i += chunkSize) {
        const chunk = mappedRows.slice(i, i + chunkSize);
        const rowPlaceholders = `(${schema.columns.map(() => '?').join(', ')})`;
        const allPlaceholders = chunk.map(() => rowPlaceholders).join(', ');
        await conn.query(
          `INSERT INTO \`${tableName}\` (${colList}) VALUES ${allPlaceholders}`,
          chunk.flat()
        );
      }
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
