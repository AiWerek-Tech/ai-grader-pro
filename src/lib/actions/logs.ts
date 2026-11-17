'use server';

import { dbGetAll } from '@/lib/google-sheets';

export async function getLogsAction() {
  try {
    const logs = await dbGetAll('LOG');
    // Membaca dari bawah ke atas agar log terbaru di atas
    const parsed = logs.reverse().slice(0, 500).map((l, i) => ({
      id: `log_${i}`,
      timestamp: l.timestamp || l.Timestamp || l[0],
      level: l.level || l.Level || l[1],
      action: l.action || l.Action || l[2],
      message: l.message || l.Message || l[3],
      userId: l.userId || l.UserId || l[4],
    }));
    return { success: true, data: parsed };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
