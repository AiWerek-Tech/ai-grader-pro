'use server';

import {
  dbGetAll,
  dbAppendRow,
  dbBatchAppendRows,
  dbFindAndDeleteRow,
  dbUpdateRow,
  dbBatchUpdateRows,
  generateId,
  sanitizeInput,
} from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { checkUserMenuAccess, requireMenuAccess } from '@/lib/rbac-server';
import { getAcademicSessionAction } from '@/lib/actions/settings';

function resolveKelasId(rawInput: string, allKelas: any[], activeTahunAjaran?: string): string | null {
  const clean = String(rawInput || '').trim();
  if (!clean) return null;

  const sessionKelas = allKelas.filter(k => {
    const kTahun = String(k.tahun_ajaran || '').trim();
    return !activeTahunAjaran || !kTahun || kTahun.toLowerCase() === activeTahunAjaran.toLowerCase();
  });
  const pool = sessionKelas.length > 0 ? sessionKelas : allKelas;

  // 1. Exact id_kelas match
  const byId = pool.find(k => String(k.id_kelas).trim().toLowerCase() === clean.toLowerCase());
  if (byId) return byId.id_kelas;

  // 2. Exact nama_kelas match
  const byName = pool.find(k => String(k.nama_kelas || '').trim().toLowerCase() === clean.toLowerCase());
  if (byName) return byName.id_kelas;

  // 3. Normalized grade shorthand (e.g. "7", "VII", "Kelas 7", "Kelas VII" -> matches "KELAS VII")
  const norm = clean.toUpperCase().replace(/^KELAS\s+/i, '').trim();
  const romanMap: Record<string, string> = {
    '7': 'VII',
    '8': 'VIII',
    '9': 'IX',
    '10': 'X',
    '11': 'XI',
    '12': 'XII',
  };
  const targetRoman = romanMap[norm] || norm;

  const byRoman = pool.find(k => {
    const kNorm = String(k.nama_kelas || '').toUpperCase().replace(/^KELAS\s+/i, '').trim();
    return kNorm === targetRoman || kNorm === norm;
  });
  if (byRoman) return byRoman.id_kelas;

  return null;
}

export async function getSiswaAction(
  kelasId?: string,
  scope: 'PERSONAL' | 'DELEGATED_ALL' = 'PERSONAL'
) {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = String(session?.tahunAjaran || '').trim();

    const [semuaSiswaRaw, semuaKelas] = await Promise.all([
      dbGetAll('SISWA'),
      dbGetAll('KELAS'),
    ]);

    const kelasLookup = new Map<string, any>();
    semuaKelas.forEach(k => kelasLookup.set(String(k.id_kelas), k));

    // Filter by Active Academic Year (case-insensitive; include rows with empty tahun_ajaran)
    const semuaSiswa = semuaSiswaRaw.filter(s => {
      const sTahun = String(s.tahun_ajaran || '').trim();
      return !tahunAjaran || !sTahun || sTahun.toLowerCase() === tahunAjaran.toLowerCase();
    });

    let filtered = kelasId ? semuaSiswa.filter(s => String(s.id_kelas) === String(kelasId)) : semuaSiswa;

    // Cek apakah guru memiliki hak akses delegasi penuh atas daftar seluruh siswa sekolah
    let hasDelegatedAllAccess = false;
    if (authSession.role === 'GURU' && scope === 'DELEGATED_ALL') {
      const [canSiswa, canKelas, canKartu, canDaftarHadir] = await Promise.all([
        checkUserMenuAccess(authSession, 'siswa', 'read'),
        checkUserMenuAccess(authSession, 'kelas-mapel', 'read'),
        checkUserMenuAccess(authSession, 'kartu-peserta', 'read'),
        checkUserMenuAccess(authSession, 'daftar-hadir', 'read'),
      ]);
      hasDelegatedAllAccess = canSiswa || canKelas || canKartu || canDaftarHadir;
    }

    // Guru Specific Filter (Personal Guru Isolation hanya jika bukan akses delegasi)
    if (authSession.role === 'GURU' && !hasDelegatedAllAccess) {
      const tugas = await dbGetAll('TUGAS_GURU', true);
      const myTugas = tugas.filter(t => {
        const matchUser = String(t.id_user) === String(authSession.id);
        const tTahun = String(t.tahun_ajaran || '').trim();
        const matchTahun = !tahunAjaran || !tTahun || tTahun.toLowerCase() === tahunAjaran.toLowerCase();
        return matchUser && matchTahun;
      });
      const myKelasIds = new Set(myTugas.map(t => t.id_kelas));
      filtered = filtered.filter(s => myKelasIds.has(s.id_kelas));
    }

    const enriched = filtered.map(s => {
      const kls = kelasLookup.get(String(s.id_kelas));
      return {
        ...s,
        nama_kelas: kls?.nama_kelas || s.id_kelas,
        jenjang: kls?.jenjang || 'SMA',
      };
    });

    return { success: true, data: enriched };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function addSiswaAction(nis: string, nama: string, kelasId: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('siswa', 'full');
    adminId = session.id; // Override adminId with session ID

    if (!nis || !nama || !kelasId) throw new Error('NIS, Nama, dan Kelas wajib diisi.');
    const sanNis = sanitizeInput(String(nis).trim());
    const sanNama = sanitizeInput(nama.trim());

    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';
    const semester = acadSession?.semester || 'GANJIL';

    const [existing, allKelas] = await Promise.all([
      dbGetAll('SISWA'),
      dbGetAll('KELAS'),
    ]);

    const resolvedKelasId = resolveKelasId(kelasId, allKelas, tahunAjaran) || kelasId;

    if (existing.some(s =>
      String(s.nis).trim().toLowerCase() === sanNis.toLowerCase() &&
      (!s.tahun_ajaran || String(s.tahun_ajaran).trim().toLowerCase() === tahunAjaran.toLowerCase())
    )) {
      throw new Error(`NIS "${sanNis}" sudah terdaftar pada Tahun Ajaran ${tahunAjaran}.`);
    }

    const newId = generateId('SIS');
    await dbAppendRow('SISWA', [newId, sanNis, sanNama, resolvedKelasId, tahunAjaran, semester]);
    await logger.info('ADD_SISWA', `Tambah siswa: ${sanNama} (${sanNis})`, adminId);
    
    return { success: true, message: 'Siswa berhasil ditambahkan.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function editSiswaAction(idSiswa: string, nis: string, nama: string, kelasId: string, adminId: string = 'SYSTEM') {
    try {
        const session = await requireMenuAccess('siswa', 'full');
        adminId = session.id; // Override adminId with session ID

        if (!idSiswa || !nis || !nama || !kelasId) throw new Error('Semua field wajib diisi.');
        const sanNis = sanitizeInput(String(nis).trim());
        const sanNama = sanitizeInput(nama.trim());

        const { data: acadSession } = await getAcademicSessionAction();
        const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';

        const allSiswa = await dbGetAll('SISWA');
        const duplicate = allSiswa.some(s =>
          String(s.nis).trim().toLowerCase() === sanNis.toLowerCase() &&
          String(s.id_siswa) !== String(idSiswa) &&
          (!s.tahun_ajaran || String(s.tahun_ajaran).trim().toLowerCase() === tahunAjaran.toLowerCase())
        );
        
        if(duplicate) {
            throw new Error(`NIS "${sanNis}" sudah terdaftar pada siswa lain.`);
        }

        const target = allSiswa.find(s => String(s.id_siswa) === String(idSiswa));
        if(!target) throw new Error("Siswa tidak ditemukan");
        
        const updatedRow = [target.id_siswa, sanNis, sanNama, kelasId, target.tahun_ajaran || tahunAjaran, target.semester || acadSession?.semester || 'GANJIL'];
        await dbUpdateRow('SISWA', idSiswa, updatedRow);

        await logger.info('EDIT_SISWA', `Memperbarui siswa: ${sanNama}`, adminId);
        return { success: true, message: 'Siswa berhasil diperbarui.' };

    } catch(e:any) {
        return { success: false, message: e.message };
    }
}

export async function bulkAddSiswaAction(rows: { nis: string, nama: string, id_kelas: string }[], adminId: string = 'SYSTEM') {
  return importSiswaBatchAction(rows, adminId);
}

export async function deleteSiswaBatchAction(ids: string[], adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('siswa', 'full');
    adminId = session.id; // Override adminId with session ID
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      const res = await deleteSiswaAction(id, adminId);
      if (res.success) deletedCount++;
      else errorCount++;
    }
    
    return { success: true, message: `Berhasil menghapus ${deletedCount} siswa. ${errorCount > 0 ? `${errorCount} gagal (mungkin karena memiliki riwayat nilai).` : ''}` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteSiswaAction(idSiswa: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('siswa', 'full');
    adminId = session.id; // Override adminId with session ID

    // SECURITY: Cascading Anti-Orphan Check (Fase 9.1)
    const allHasil = await dbGetAll('HASIL');
    const hasScores = allHasil.some(h => String(h.id_siswa) === String(idSiswa));
    
    if (hasScores) {
      throw new Error("PENGHAPUSAN DITOLAK: Siswa ini memiliki Riwayat Nilai di Database. Untuk menjaga integritas laporan, siswa ini tidak bisa dihapus. Silakan hubungi tim IT jika benar-benar perlu menghapus data historis.");
    }

    const deleted = await dbFindAndDeleteRow('SISWA', idSiswa);
    if (!deleted) throw new Error('Siswa tidak ditemukan.');

    await logger.warn('DEL_SISWA', `Hapus siswa ID: ${idSiswa}`, adminId);
    return { success: true, message: 'Siswa berhasil dihapus permanen.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * cleanDuplicateSiswaAction (Adaptasi Utils_Cleanup.gs)
 * Menghapus data siswa duplikat berdasarkan NIS.
 */
export async function cleanDuplicateSiswaAction(adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('siswa', 'full');
    adminId = session.id; // Override adminId with session ID
    const allSiswa = await dbGetAll('SISWA');
    if (allSiswa.length === 0) return { success: true, message: 'Tidak ada data siswa.' };

    const seenNIS = new Set();
    const duplicateIds: string[] = [];

    for (const s of allSiswa) {
      const nis = String(s.nis || '').trim().toLowerCase();
      if (!nis) continue;

      if (seenNIS.has(nis)) {
        duplicateIds.push(s.id_siswa);
      } else {
        seenNIS.add(nis);
      }
    }

    if (duplicateIds.length === 0) {
      return { success: true, message: 'Tidak ditemukan data siswa duplikat.' };
    }

    // Hapus satu per satu (atau batch jika library mendukung)
    for (const id of duplicateIds) {
      await dbFindAndDeleteRow('SISWA', id);
    }

    await logger.info('CLEAN_SISWA', `Berhasil menghapus ${duplicateIds.length} data siswa duplikat.`, adminId);
    return { success: true, message: `Selesai! ${duplicateIds.length} data duplikat berhasil dihapus.` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * bulkAssignKelasAction — Batch update id_kelas untuk banyak siswa sekaligus.
 * Dipakai oleh fitur Rombel Manager di halaman Kelas & Mapel dan Naik Kelas di halaman Siswa.
 */
export async function bulkAssignKelasAction(
  siswaIds: string[],
  targetKelasId: string
): Promise<{ success: boolean; updated: number; errors: string[]; message: string }> {
  try {
    const session = await requireAuth();
    const [canSiswaFull, canKelasFull] = await Promise.all([
      checkUserMenuAccess(session, 'siswa', 'full'),
      checkUserMenuAccess(session, 'kelas-mapel', 'full'),
    ]);
    if (!canSiswaFull && !canKelasFull) {
      throw new Error('Forbidden: Mode Read-Only atau Anda tidak memiliki akses penuh untuk memindahkan rombel siswa.');
    }
    const adminId = session.id;

    if (!targetKelasId || !siswaIds || siswaIds.length === 0) {
      throw new Error('Data tidak lengkap: siswaIds dan targetKelasId wajib diisi.');
    }

    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';
    const semester = acadSession?.semester || 'GANJIL';

    const allSiswa = await dbGetAll('SISWA');
    const errors: string[] = [];
    const batchUpdates: { id: string; values: (string | number | boolean)[] }[] = [];

    for (const id of siswaIds) {
      const target = allSiswa.find((s) => String(s.id_siswa) === String(id));
      if (!target) { errors.push(`ID ${id} tidak ditemukan`); continue; }
      batchUpdates.push({
        id: String(target.id_siswa),
        values: [
          target.id_siswa,
          target.nis,
          target.nama,
          targetKelasId,
          target.tahun_ajaran || tahunAjaran,
          target.semester || semester,
        ],
      });
    }

    if (batchUpdates.length > 0) {
      await dbBatchUpdateRows('SISWA', batchUpdates);
    }

    await logger.info(
      'BULK_ASSIGN_KELAS',
      `Pindahkan ${batchUpdates.length} siswa → kelas ${targetKelasId}`,
      adminId
    );

    return {
      success: true,
      updated: batchUpdates.length,
      errors,
      message: `${batchUpdates.length} siswa berhasil dipindahkan ke kelas tujuan.${errors.length > 0 ? ` ${errors.length} gagal.` : ''}`,
    };
  } catch (e: any) {
    return { success: false, updated: 0, errors: [e.message], message: e.message };
  }
}

/**
 * Turbo Import Siswa: Menginsert data dalam skala massal via Google Sheets batchUpdate
 */
export async function importSiswaBatchAction(arrSiswa: { nis: string, nama: string, id_kelas: string }[], adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('siswa', 'full');
    adminId = session.id; // Override adminId with session ID

    if (!Array.isArray(arrSiswa) || arrSiswa.length === 0) throw new Error('Data import kosong.');

    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';
    const semester = acadSession?.semester || 'GANJIL';

    const sheetName = 'SISWA';
    const [existing, allKelas] = await Promise.all([
      dbGetAll(sheetName),
      dbGetAll('KELAS'),
    ]);

    const existNIS = new Set(
      existing
        .filter(s => !s.tahun_ajaran || String(s.tahun_ajaran).trim().toLowerCase() === tahunAjaran.toLowerCase())
        .map(s => String(s.nis || '').trim().toLowerCase())
    );

    const errors: any[] = [];
    const fileNIS = new Set();
    const newRowsBatch: any[][] = [];

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < arrSiswa.length; i++) {
      const row = arrSiswa[i];
      const nis = sanitizeInput(String(row.nis || '').trim());
      const nama = sanitizeInput(String(row.nama || '').trim());
      const rawKelas = String(row.id_kelas || '').trim();
      const resolvedKelasId = resolveKelasId(rawKelas, allKelas, tahunAjaran);
      const nisKey = nis.toLowerCase();

      if (!nis) { errors.push({ row: i+1, nis, nama, msg: 'NIS kosong' }); skipped++; continue; }
      if (!nama) { errors.push({ row: i+1, nis, nama, msg: 'Nama kosong' }); skipped++; continue; }
      if (!resolvedKelasId) { errors.push({ row: i+1, nis, nama, msg: `Kelas "${rawKelas}" tidak ditemukan` }); skipped++; continue; }
      if (existNIS.has(nisKey)) { errors.push({ row: i+1, nis, nama, msg: 'NIS duplikat di Database' }); skipped++; continue; }
      if (fileNIS.has(nisKey)) { errors.push({ row: i+1, nis, nama, msg: 'NIS duplikat di dalam file import' }); skipped++; continue; }

      const newId = generateId('SIS');
      newRowsBatch.push([newId, nis, nama, resolvedKelasId, tahunAjaran, semester]);
      
      existNIS.add(nisKey);
      fileNIS.add(nisKey);
      inserted++;
    }

    if (newRowsBatch.length > 0) {
      await dbBatchAppendRows(sheetName, newRowsBatch);
    }

    await logger.info('IMPORT_SISWA', `Berhasil import ${inserted} siswa secara massal`, adminId);
    return {
      success: true,
      message: `${inserted} siswa berhasil diimport. ${skipped > 0 ? `${skipped} baris dilewati.` : ''}`,
      inserted, skipped, errors
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
