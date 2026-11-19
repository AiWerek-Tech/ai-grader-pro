'use server';

import { dbGetAll, dbAppendRow, dbBatchAppendRows, dbFindAndDeleteRow, dbUpdateRow, generateId } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { requireMenuAccess } from '@/lib/rbac-server';

import { getAcademicSessionAction } from '@/lib/actions/settings';

// Schema TUGAS_GURU: [id_tugas, id_user, id_mapel, id_kelas]

export async function getTugasAction() {
  try {
    await requireMenuAccess('tugas-mengajar', 'read');
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = String(session?.tahunAjaran || '').trim();
    const semester = String(session?.semester || '').trim().toUpperCase();

    const [tugas, users, mapel, kelas] = await Promise.all([
      dbGetAll('TUGAS_GURU'),
      dbGetAll('USERS'),
      dbGetAll('MAPEL'),
      dbGetAll('KELAS')
    ]);

    // Filter by session (case-insensitive, fallback if empty)
    const filteredTugas = tugas.filter(t => {
      const tTahun = String(t.tahun_ajaran || '').trim();
      const tSem = String(t.semester || '').trim().toUpperCase();
      const matchTahun = !tahunAjaran || !tTahun || tTahun.toLowerCase() === tahunAjaran.toLowerCase();
      const matchSem = !semester || !tSem || tSem === semester;
      return matchTahun && matchSem;
    });

    const data = filteredTugas.map(t => {
      const guru = users.find(u => u.id_user === t.id_user);
      const mpl = mapel.find(m => m.id_mapel === t.id_mapel);
      const kls = kelas.find(k => k.id_kelas === t.id_kelas);
      
      return {
        ...t,
        nama_guru: guru?.nama || 'Unknown',
        nama_mapel: mpl?.nama_mapel || 'Unknown',
        nama_kelas: kls?.nama_kelas || 'Unknown',
        jenjang: kls?.jenjang || 'SMA',
        profile_url: guru?.profile_url || ''
      };
    });

    return { success: true, data };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * Ambil tugas mengajar untuk guru tertentu saja (digunakan saat guru login).
 * Admin melihat semua, Guru hanya miliknya.
 */
export async function getTugasForGuruAction(guruId: string, _userRole: string = 'GURU') {
  try {
    void _userRole;
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = String(session?.tahunAjaran || '').trim();
    const semester = String(session?.semester || '').trim().toUpperCase();

    let tugas = await dbGetAll('TUGAS_GURU');
    const mapels = await dbGetAll('MAPEL');
    const kelasList = await dbGetAll('KELAS');

    if (tahunAjaran) {
      tugas = tugas.filter((t: any) => {
        const tTahun = String(t.tahun_ajaran || '').trim();
        const tSem = String(t.semester || '').trim().toUpperCase();
        const matchTahun = !tTahun || tTahun.toLowerCase() === tahunAjaran.toLowerCase();
        const matchSem = !semester || !tSem || tSem === semester;
        return matchTahun && matchSem;
      });
    }

    const mapMapel: Record<string, string> = {};
    mapels.forEach((m: any) => { mapMapel[m.id_mapel] = m.nama_mapel; });
    const mapKelas: Record<string, string> = {};
    kelasList.forEach((k: any) => { mapKelas[k.id_kelas] = k.nama_kelas; });

    let filtered = tugas;
    if (authSession.role !== 'ADMIN') {
      filtered = tugas.filter((t: any) => String(t.id_user) === String(authSession.id));
    } else if (guruId) {
      filtered = tugas.filter((t: any) => String(t.id_user) === String(guruId));
    }

    const enriched = filtered.map((t: any) => ({
      id_tugas: t.id_tugas,
      id_mapel: t.id_mapel,
      id_kelas: t.id_kelas,
      nama_mapel: mapMapel[t.id_mapel] || t.id_mapel,
      nama_kelas: mapKelas[t.id_kelas] || t.id_kelas,
    }));

    return { success: true, data: enriched };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveTugasAction(idGuru: string, idMapel: string, idKelas: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('tugas-mengajar', 'full');
    adminId = session.id; // Override adminId with session ID

    if (!idGuru || !idMapel || !idKelas) throw new Error('Guru, Mata Pelajaran, dan Kelas wajib dipilih.');

    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';
    const semester = acadSession?.semester || 'GANJIL';

    const existing = await dbGetAll('TUGAS_GURU');
    const isDuplicate = existing.some((t: any) =>
      String(t.id_user) === String(idGuru) &&
      String(t.id_mapel) === String(idMapel) &&
      String(t.id_kelas) === String(idKelas) &&
      (!t.tahun_ajaran || String(t.tahun_ajaran).trim().toLowerCase() === tahunAjaran.toLowerCase()) &&
      (!t.semester || String(t.semester).trim().toUpperCase() === semester)
    );
    if (isDuplicate) {
      throw new Error('Kombinasi Guru, Mata Pelajaran, dan Kelas tersebut sudah terdaftar pada semester aktif.');
    }

    const id = generateId('TGS');
    const row = [id, idGuru, idMapel, idKelas, tahunAjaran, semester];
    await dbAppendRow('TUGAS_GURU', row);
    await logger.info('ADD_TUGAS', `Tambah penugasan guru ${idGuru}`, adminId);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveTugasBatchAction(
  idGuru: string,
  idMapel: string,
  idKelasList: string[],
  adminId: string = 'SYSTEM'
) {
  try {
    const session = await requireMenuAccess('tugas-mengajar', 'full');
    adminId = session.id;

    if (!idGuru || !idMapel || !Array.isArray(idKelasList) || idKelasList.length === 0) {
      throw new Error('Pilih Guru, Mata Pelajaran, dan minimal 1 Kelas.');
    }

    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';
    const semester = acadSession?.semester || 'GANJIL';

    const existing = await dbGetAll('TUGAS_GURU');
    const rowsToAppend: (string | number | boolean)[][] = [];
    let skipped = 0;

    for (const idKelas of idKelasList) {
      const isDuplicate = existing.some((t: any) =>
        String(t.id_user) === String(idGuru) &&
        String(t.id_mapel) === String(idMapel) &&
        String(t.id_kelas) === String(idKelas) &&
        (!t.tahun_ajaran || String(t.tahun_ajaran).trim().toLowerCase() === tahunAjaran.toLowerCase()) &&
        (!t.semester || String(t.semester).trim().toUpperCase() === semester)
      );
      if (isDuplicate) {
        skipped++;
        continue;
      }
      const id = generateId('TGS');
      rowsToAppend.push([id, idGuru, idMapel, idKelas, tahunAjaran, semester]);
    }

    if (rowsToAppend.length === 0) {
      throw new Error('Semua kelas yang dipilih sudah ditugaskan untuk guru & mapel ini.');
    }

    await dbBatchAppendRows('TUGAS_GURU', rowsToAppend);
    await logger.info('ADD_TUGAS_BATCH', `Tambah ${rowsToAppend.length} penugasan guru ${idGuru}`, adminId);
    return {
      success: true,
      inserted: rowsToAppend.length,
      skipped,
      message: `${rowsToAppend.length} penugasan berhasil ditambahkan${skipped > 0 ? ` (${skipped} sudah ada)` : ''}.`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function updateTugasAction(idTugas: string, idGuru: string, idMapel: string, idKelas: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('tugas-mengajar', 'full');
    adminId = session.id; // Override adminId with session ID

    if (!idTugas || !idGuru || !idMapel || !idKelas) throw new Error('Data tidak lengkap.');

    // Validasi duplikat: cegah jika kombinasi guru+mapel+kelas sudah ada di ID lain
    const existing = await dbGetAll('TUGAS_GURU');
    const target = existing.find((t: any) => String(t.id_tugas) === String(idTugas));
    if (!target) throw new Error('Tugas tidak ditemukan.');

    const dup = existing.some((t: any) =>
      String(t.id_tugas) !== String(idTugas) &&
      String(t.id_user) === String(idGuru) &&
      String(t.id_mapel) === String(idMapel) &&
      String(t.id_kelas) === String(idKelas) &&
      t.tahun_ajaran === target.tahun_ajaran &&
      t.semester === target.semester
    );
    if (dup) throw new Error('Tugas Mengajar ini sudah ada pada guru tersebut. Tidak boleh duplikat.');

    const updatedRow = [idTugas, idGuru, idMapel, idKelas, target.tahun_ajaran || '', target.semester || ''];
    await dbUpdateRow('TUGAS_GURU', idTugas, updatedRow);

    await logger.info('UPD_TUGAS', `Update tugas: ${idTugas}`, adminId);
    return { success: true, message: 'Tugas mengajar berhasil diperbarui.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteTugasAction(idTugas: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('tugas-mengajar', 'full');
    adminId = session.id; // Override adminId with session ID
    const deleted = await dbFindAndDeleteRow('TUGAS_GURU', idTugas);
    if (!deleted) throw new Error('Tugas tidak ditemukan.');

    await logger.info('DEL_TUGAS', `Hapus tugas ID: ${idTugas}`, adminId);
    return { success: true, message: 'Tugas mengajar dihapus.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
