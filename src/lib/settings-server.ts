import { dbGetAll, dbReplaceSheetData, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';

/**
 * Internal server helper untuk menyimpan pembaruan ke tab SETTINGS.
 * Setiap Server Action pemanggil WAJIB memvalidasi izin (requireAdmin atau requireMenuAccess)
 * sebelum memanggil fungsi ini.
 */
export async function persistSettingsUpdates(
  updates: Record<string, string>,
  actorId: string = 'SYSTEM'
): Promise<{ success: true }> {
  const existing = await dbGetAll('SETTINGS', false);

  const oldTahun = existing.find((s) => s.key === 'tahun_ajaran')?.value;
  const oldSemester = existing.find((s) => s.key === 'semester')?.value;
  const newTahun = updates['tahun_ajaran'];
  const newSemester = updates['semester']
    ? String(updates['semester']).trim().toUpperCase()
    : undefined;

  const mergedMap = new Map<string, string>();
  for (const row of existing) {
    if (row.key) mergedMap.set(String(row.key), String(row.value ?? ''));
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!key) continue;
    const rawStr = String(value ?? '');
    let v = rawStr.startsWith('data:image/') ? rawStr.trim() : sanitizeInput(rawStr);
    if (key === 'semester' && v) v = v.toUpperCase();
    if (key === 'tahun_ajaran' && v) v = v.trim();
    mergedMap.set(key, v);
  }

  const newRows = Array.from(mergedMap.entries()).map(([k, v]) => [k, v]);
  await dbReplaceSheetData('SETTINGS', ['key', 'value'], newRows);

  if ((newTahun && newTahun !== oldTahun) || (newSemester && newSemester !== oldSemester)) {
    await logger.warn(
      'ACADEMIC_CHANGE',
      `Sesi akademik diubah ke: ${newTahun || oldTahun} - ${newSemester || oldSemester}`,
      actorId
    );
  }

  await logger.info(
    'UPD_SETTINGS',
    `Memperbarui ${Object.keys(updates).length} pengaturan sistem`,
    actorId
  );

  return { success: true };
}
