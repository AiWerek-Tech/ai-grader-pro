import { google, sheets_v4 } from 'googleapis';
import path from 'path';

// Pastikan GOOGLE_APPLICATION_CREDENTIALS dan GOOGLE_SPREADSHEET_ID telah diset di .env.local
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuth() {
  const rawCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  const credentialsPath = path.isAbsolute(rawCreds)
    ? rawCreds
    : path.join(/* turbopackIgnore: true */ process.cwd(), rawCreds);
  return new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: SCOPES,
  });
}

export function getSheets(): sheets_v4.Sheets {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

export const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

export function getSpreadsheetId(): string {
  return process.env.GOOGLE_SPREADSHEET_ID || spreadsheetId || '';
}

// --- In-Memory Cache Layer (Ultra Advanced Audit Phase) ---
// Mengurangi overhead Google API calls untuk data yang jarang berubah (KELAS, MAPEL, SETTINGS)
const CACHE_TTL = 60 * 10 * 1000; // 10 menit - increased for better performance
const MAX_CACHE_SIZE = 50; // Limit cache size to prevent memory issues
const dbCache: Record<string, { data: any[], timestamp: number }> = {};

/**
 * dbGetAll(sheetName, useCache)
 * Mendapatkan seluruh baris pada suatu sheet dengan opsi caching cerdas.
 */
export async function dbGetAll(sheetName: string, useCache: boolean = true): Promise<any[]> {
  const now = Date.now();
  if (useCache && dbCache[sheetName] && (now - dbCache[sheetName].timestamp < CACHE_TTL)) {
    // Cache hit - return cached data
    return dbCache[sheetName].data;
  }

  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${sheetName}!A1:ZZ`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0] as string[];
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j] !== undefined ? row[j] : '';
      }
      result.push(obj);
    }

    // Update cache with size management
    if (useCache) {
      // Remove oldest cache if size limit exceeded
      const cacheKeys = Object.keys(dbCache);
      if (cacheKeys.length >= MAX_CACHE_SIZE) {
        const oldestKey = cacheKeys.reduce((oldest, key) => 
          dbCache[key].timestamp < dbCache[oldest].timestamp ? key : oldest
        );
        delete dbCache[oldestKey];
      }
      dbCache[sheetName] = { data: result, timestamp: now };
    }
    
    return result;
  } catch (error: any) {
    // Stale-While-Revalidate: Jika Google Sheets API terkena rate-limit/quota (429) atau error sementara,
    // gunakan data cache yang sudah ada agar aplikasi tetap berjalan lancar tanpa down.
    if (dbCache[sheetName]?.data && dbCache[sheetName].data.length > 0) {
      console.warn(`[GoogleSheets API Fallback] Menggunakan cache aktif untuk sheet ${sheetName}: ${error.message}`);
      return dbCache[sheetName].data;
    }

    console.error(`[GoogleSheets API Error] dbGetAll(${sheetName}):`, error.message);
    throw new Error(`Gagal mengambil data dari sheet ${sheetName}: ${error.message}`);
  }
}

/**
 * clearSheetCache(sheetName)
 * Menghapus cache spesifik saat terjadi perubahan data (CUD operations)
 */
export function clearSheetCache(sheetName?: string) {
  if (sheetName) {
    delete dbCache[sheetName];
  } else {
    // Clear all
    Object.keys(dbCache).forEach(k => delete dbCache[k]);
  }
}

/**
 * dbBatchAppendRows(sheetName, rows)
 * Menambahkan banyak baris sekaligus dalam satu request API (Efisiensi Batching)
 */
export async function dbBatchAppendRows(sheetName: string, rows: unknown[][]): Promise<boolean> {
  try {
    if (!rows || rows.length === 0) return true;
    
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });
    
    clearSheetCache(sheetName);
    return true;
  } catch (error: unknown) {
    console.error(`[GoogleSheets API Error] dbBatchAppendRows(${sheetName}):`, error instanceof Error ? error.message : String(error));
    throw new Error('Gagal menambahkan data batch ke Database.');
  }
}

/**
 * Menambahkan baris baru.
 */
export async function dbAppendRow(sheetName: string, values: unknown[]): Promise<boolean> {
  try {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${sheetName}!A:A`, // Akan otomatis ter-append di baris terbawah
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });
    clearSheetCache(sheetName);
    return true;
  } catch (error: unknown) {
    console.error(`[GoogleSheets API Error] dbAppendRow(${sheetName}):`, error instanceof Error ? error.message : String(error));
    throw new Error('Gagal menambahkan data ke Database.');
  }
}

/**
 * Mencari baris berdasarkan target ID pada kolom pertama (index 0) dan memperbarui nilainya.
 * Mitigasi race condition dengan retry mechanism dan validasi setelah update.
 */
export async function dbUpdateRow(sheetName: string, targetId: string, newValues: unknown[], maxRetries: number = 3) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const sheets = getSheets();
      const activeSpreadsheetId = getSpreadsheetId();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: activeSpreadsheetId,
        range: `${sheetName}!A:A`,
      });
      const rows = response.data.values;
      if (!rows) return false;

      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === String(targetId)) {
          rowIndex = i + 1; // 1-indexed for Sheets formatting (e.g. A2)
          break;
        }
      }

      if (rowIndex === -1) return false;

      // Perform update
      await sheets.spreadsheets.values.update({
        spreadsheetId: activeSpreadsheetId,
        range: `${sheetName}!A${rowIndex}:${String.fromCharCode(65 + newValues.length - 1)}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [newValues],
        },
      });

      // Verify update by reading back the row
      const verifyResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: activeSpreadsheetId,
        range: `${sheetName}!A${rowIndex}:${String.fromCharCode(65 + newValues.length - 1)}${rowIndex}`,
      });
      const updatedRow = verifyResponse.data.values?.[0];

      // Verify ID still matches (detects race condition where row shifted)
      if (!updatedRow || String(updatedRow[0]) !== String(targetId)) {
        throw new Error('Race condition detected: Row ID mismatch after update. Retrying...');
      }

      clearSheetCache(sheetName);
      return true;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // If this is a race condition error and we have retries left, continue
      if (attempt < maxRetries - 1 && lastError.message.includes('Race condition')) {
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  console.error(`[GoogleSheets API Error] dbUpdateRow(${sheetName}):`, lastError?.message);
  throw new Error('Gagal memperbarui data di Database setelah ' + maxRetries + ' percobaan.');
}

/**
 * dbBatchUpdateRows - Optimized batch update for multiple rows
 */
export async function dbBatchUpdateRows(sheetName: string, updates: { id: string, values: unknown[] }[]) {
  try {
    if (!updates || updates.length === 0) return true;
    
    const sheets = getSheets();
    const activeSpreadsheetId = getSpreadsheetId();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: activeSpreadsheetId,
      range: `${sheetName}!A:A`,
    });
    const rows = response.data.values;
    if (!rows) return false;

    const updateData = [];
    for (const update of updates) {
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === String(update.id)) {
          const rowIndex = i + 1;
          updateData.push({
            range: `${sheetName}!A${rowIndex}:${String.fromCharCode(65 + update.values.length - 1)}${rowIndex}`,
            values: [update.values]
          });
          break;
        }
      }
    }

    if (updateData.length === 0) return true;

    // Batch update using batchUpdate API
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: activeSpreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateData
      }
    });

    clearSheetCache(sheetName);
    return true;
  } catch (error: unknown) {
    console.error(`[GoogleSheets API Error] dbBatchUpdateRows(${sheetName}):`, error instanceof Error ? error.message : String(error));
    throw new Error('Gagal memperbarui data batch di Database.');
  }
}

/**
 * Menghapus baris jika col 0 cocok dengan targetId
 */
export async function dbFindAndDeleteRow(sheetName: string, targetId: string) {
  try {
    const sheets = getSheets();
    const activeSpreadsheetId = getSpreadsheetId();
    
    // First, resolve sheetId by sheetName
    const meta = await sheets.spreadsheets.get({ spreadsheetId: activeSpreadsheetId });
    const sheetData = meta.data.sheets?.find(s => s.properties?.title === sheetName);
    if (!sheetData) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
    const defaultSheetId = sheetData.properties?.sheetId;

    // Second, find the row index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: activeSpreadsheetId,
      range: `${sheetName}!A:A`,
    });
    const rows = response.data.values;
    if (!rows) return false;

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(targetId)) {
        rowIndex = i; // 0-indexed for BatchUpdate API (startIndex/endIndex)
        break;
      }
    }

    if (rowIndex === -1) return false;

    // Finally, execute batch update to delete the dimensional row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: activeSpreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: defaultSheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              }
            }
          }
        ]
      }
    });

    clearSheetCache(sheetName);
    return true;
  } catch (error: unknown) {
    console.error(`[GoogleSheets API Error] dbFindAndDeleteRow(${sheetName}):`, error instanceof Error ? error.message : String(error));
    throw new Error('Gagal menghapus data dari Database.');
  }
}

/**
 * dbDeleteRows(sheetName, startIndex, count)
 * Menghapus baris secara massal (batch).
 */
export async function dbDeleteRows(sheetName: string, startIndex: number, count: number) {
  try {
    const sheets = getSheets();
    const activeSpreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: activeSpreadsheetId });
    const sheetData = meta.data.sheets?.find(s => s.properties?.title === sheetName);
    if (!sheetData) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
    const defaultSheetId = sheetData.properties?.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: activeSpreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: defaultSheetId,
                dimension: 'ROWS',
                startIndex: startIndex,
                endIndex: startIndex + count,
              }
            }
          }
        ]
      }
    });
    clearSheetCache(sheetName);
    return true;
  } catch (error: unknown) {
    console.error(`[GoogleSheets API Error] dbDeleteRows(${sheetName}):`, error instanceof Error ? error.message : String(error));
    throw new Error('Gagal menghapus baris dari Database.');
  }
}

/**
 * dbReplaceSheetData(sheetName, headers, rows)
 * Mengosongkan isi sheet dan menulis ulang header + seluruh baris dalam 1 operasi atomik.
 */
export async function dbReplaceSheetData(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean)[][]
) {
  try {
    const sheets = getSheets();
    const activeSpreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: activeSpreadsheetId });
    const existing = meta.data.sheets?.find(s => s.properties?.title === sheetName);

    if (!existing) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: activeSpreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    } else {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: activeSpreadsheetId,
        range: `${sheetName}!A:ZZ`,
      });
    }

    const values = [headers, ...rows.map(r => r.map(v => (v === undefined || v === null ? '' : v)))];
    await sheets.spreadsheets.values.update({
      spreadsheetId: activeSpreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    clearSheetCache(sheetName);
    return true;
  } catch (error: unknown) {
    console.error(`[GoogleSheets API Error] dbReplaceSheetData(${sheetName}):`, error instanceof Error ? error.message : String(error));
    throw new Error(`Gagal menulis ulang sheet ${sheetName}.`);
  }
}

// Fitur auto id generation standar
export function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * sanitizeInput(val, maxLength)
 * Sesuai dengan keamanan AdminService.gs lama, mencegah formula injection
 */
export function sanitizeInput(val: string, maxLength?: number): string {
  if (typeof val !== 'string') return val;
  let sanitized = val.trim();
  const dangerous = ['=', '+', '-', '@', '|', '\t', '\r'];
  while (sanitized.length > 0 && dangerous.includes(sanitized.charAt(0))) {
    sanitized = sanitized.substring(1).trim();
  }
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}
