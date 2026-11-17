import { dbAppendRow, dbGetAll, dbDeleteRows } from './google-sheets';

const LOG_MAX_ROWS = 2000;
const LOG_PURGE_DAYS = 30;

export const logger = {
  async log(level: 'INFO' | 'WARN' | 'ERROR', action: string, message: string, userId: string = 'SYSTEM') {
    try {
      const ts = new Date().toISOString();
      const safeMessage = String(message || '').substring(0, 1000);
      
      // Simpan log ke Google Sheets
      await dbAppendRow('LOG', [ts, level, action, safeMessage, userId]);

      // Jalankan rotasi log secara asinkron di latar belakang (background)
      // Gunakan Math.random() agar tidak setiap log memicu pengecekan yang berat
      if (Math.random() < 0.1) {
        this.rotateLogs().catch(console.error);
      }

      // Console logging untuk dev environment
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[${ts}] ${level}: ${action} - ${safeMessage} (${userId})`);
      }
    } catch (e) {
      console.error('Logger failed:', e);
    }
  },

  async info(action: string, message: string, userId?: string) {
    await this.log('INFO', action, message, userId);
  },

  async warn(action: string, message: string, userId?: string) {
    await this.log('WARN', action, message, userId);
  },

  async error(action: string, message: string, userId?: string) {
    await this.log('ERROR', action, message, userId);
  },

  /**
   * rotateLogs()
   * Membersihkan log lama (> 30 hari) atau membatasi jumlah baris (max 2000).
   * Lebih cerdas dari versi GAS lama.
   */
  async rotateLogs() {
    try {
      const allLogs = await dbGetAll('LOG');
      if (allLogs.length < 500) return; // Terlalu sedikit untuk dirotasi

      const now = new Date();
      const cutoff = new Date(now.getTime() - (LOG_PURGE_DAYS * 24 * 60 * 60 * 1000));
      
      let deleteCount = 0;
      for (const log of allLogs) {
        const logDate = new Date(log.timestamp);
        if (isNaN(logDate.getTime()) || logDate < cutoff) {
          deleteCount++;
        } else {
          break; // Data log berurutan waktu, berhenti jika sudah mencapai batas
        }
      }

      // Jika masih terlalu banyak baris (over limit), paksa hapus baris terlama
      if (allLogs.length - deleteCount > LOG_MAX_ROWS) {
        deleteCount += (allLogs.length - deleteCount - LOG_MAX_ROWS);
      }

      if (deleteCount > 0) {
        await dbDeleteRows('LOG', 1, deleteCount); // Index 1 untuk skip header
        console.log(`[Logger] Rotasi log selesai. ${deleteCount} baris dibersihkan.`);
      }
    } catch (e) {
      console.error('Log rotation failed:', e);
    }
  }
};
