'use server';

import { dbGetAll, dbAppendRow, dbFindAndDeleteRow, dbUpdateRow, generateId, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { checkUserMenuAccess, requireMenuAccess } from '@/lib/rbac-server';

// Schema KELAS: [id_kelas, nama_kelas, jenjang]
// Schema MAPEL: [id_mapel, nama_mapel]

import { getAcademicSessionAction } from '@/lib/actions/settings';

function getGradeSortOrder(namaKelas: string): number {
  const n = String(namaKelas || '').toUpperCase().trim();
  if (/\b(VII|7)\b/.test(n) && !/\bVIII\b/.test(n)) return 7;
  if (/\b(VIII|8)\b/.test(n)) return 8;
  if (/\b(IX|9)\b/.test(n)) return 9;
  if (/\b(X|10)\b/.test(n) && !/\b(XI|XII)\b/.test(n)) return 10;
  if (/\b(XI|11)\b/.test(n) && !/\bXII\b/.test(n)) return 11;
  if (/\b(XII|12)\b/.test(n)) return 12;
  return 99;
}

export async function getMasterData(scope: 'PERSONAL' | 'DELEGATED_ALL' = 'PERSONAL') {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = String(session?.tahunAjaran || '').trim();

    const [kelas, mapel, siswa, kunci, tugas] = await Promise.all([
      dbGetAll('KELAS'),
      dbGetAll('MAPEL'),
      dbGetAll('SISWA'),
      dbGetAll('KUNCI_JAWABAN'),
      dbGetAll('TUGAS_GURU')
    ]);

    // Filter data based on academic session (case-insensitive, fallback if empty)
    let filteredKelas = kelas.filter(k => {
      const kTahun = String(k.tahun_ajaran || '').trim();
      return !tahunAjaran || !kTahun || kTahun.toLowerCase() === tahunAjaran.toLowerCase();
    });
    let filteredMapel = [...mapel];

    let hasDelegatedAllAccess = false;
    if (authSession.role === 'GURU' && scope === 'DELEGATED_ALL') {
      const [canKelas, canSiswa, canTugas, canKartu, canDaftarHadir] = await Promise.all([
        checkUserMenuAccess(authSession, 'kelas-mapel', 'read'),
        checkUserMenuAccess(authSession, 'siswa', 'read'),
        checkUserMenuAccess(authSession, 'tugas-mengajar', 'read'),
        checkUserMenuAccess(authSession, 'kartu-peserta', 'read'),
        checkUserMenuAccess(authSession, 'daftar-hadir', 'read'),
      ]);
      hasDelegatedAllAccess = canKelas || canSiswa || canTugas || canKartu || canDaftarHadir;
    }

    // Guru Specific Filter (Personal Guru Isolation hanya jika bukan akses delegasi)
    if (authSession.role === 'GURU' && !hasDelegatedAllAccess) {
      const myTugas = tugas.filter(t => {
        const matchUser = String(t.id_user) === String(authSession.id);
        const tTahun = String(t.tahun_ajaran || '').trim();
        const matchTahun = !tahunAjaran || !tTahun || tTahun.toLowerCase() === tahunAjaran.toLowerCase();
        return matchUser && matchTahun;
      });
      const myKelasIds = new Set(myTugas.map(t => t.id_kelas));
      const myMapelIds = new Set(myTugas.map(t => t.id_mapel));

      filteredKelas = filteredKelas.filter(k => myKelasIds.has(k.id_kelas));
      filteredMapel = filteredMapel.filter(m => myMapelIds.has(m.id_mapel));
    }

    const activeSiswa = siswa.filter(s => {
      const sTahun = String(s.tahun_ajaran || '').trim();
      return !tahunAjaran || !sTahun || sTahun.toLowerCase() === tahunAjaran.toLowerCase();
    });

    const klsMap: Record<string, number> = {};
    activeSiswa.forEach(s => {
      klsMap[s.id_kelas] = (klsMap[s.id_kelas] || 0) + 1;
    });

    const mplMap: Record<string, number> = {};
    kunci.forEach(k => {
      mplMap[k.id_mapel] = (mplMap[k.id_mapel] || 0) + 1;
    });

    filteredKelas.sort((a, b) => {
      const orderDiff = getGradeSortOrder(a.nama_kelas) - getGradeSortOrder(b.nama_kelas);
      if (orderDiff !== 0) return orderDiff;
      return String(a.nama_kelas || '').localeCompare(String(b.nama_kelas || ''));
    });

    return {
      success: true,
      data: {
        kelas: filteredKelas.map(k => ({
          ...k,
          jumlah_siswa: klsMap[k.id_kelas] || 0
        })),
        mapel: filteredMapel.map(m => ({
          ...m,
          jumlah_kunci: mplMap[m.id_mapel] || 0
        }))
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveMasterAction(type: 'KELAS' | 'MAPEL', nama: string, jenjang?: string, adminId: string = 'SYSTEM') {
  try {
    const authSession = await requireMenuAccess('kelas-mapel', 'full');
    adminId = authSession.id; // Override adminId with session ID

    if (!nama || nama.trim().length < 2) throw new Error('Nama minimal 2 karakter.');
    const cleanNama = sanitizeInput(nama.trim());
    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran || '2026/2027';
    const semester = acadSession?.semester || 'GANJIL';

    if (type === 'KELAS') {
      const existingKelas = await dbGetAll('KELAS');
      const isDup = existingKelas.some(k =>
        String(k.nama_kelas || '').trim().toLowerCase() === cleanNama.toLowerCase() &&
        (!k.tahun_ajaran || String(k.tahun_ajaran).trim().toLowerCase() === tahunAjaran.toLowerCase())
      );
      if (isDup) throw new Error(`Kelas "${cleanNama}" sudah ada pada Tahun Ajaran ${tahunAjaran}.`);

      const id = generateId('KLS');
      const resolvedJenjang = ['SMP', 'SMA'].includes(String(jenjang).toUpperCase())
        ? String(jenjang).toUpperCase()
        : (/^(KELAS\s+)?(VII|VIII|IX|7|8|9)\b/i.test(cleanNama) ? 'SMP' : 'SMA');
      await dbAppendRow('KELAS', [id, cleanNama, resolvedJenjang, tahunAjaran, semester]);
    } else {
      const existingMapel = await dbGetAll('MAPEL');
      const isDup = existingMapel.some(m =>
        String(m.nama_mapel || '').trim().toLowerCase() === cleanNama.toLowerCase()
      );
      if (isDup) throw new Error(`Mata Pelajaran "${cleanNama}" sudah terdaftar.`);

      const id = generateId('MPL');
      await dbAppendRow('MAPEL', [id, cleanNama]);
    }
    
    await logger.info('ADD_MASTER', `Menambah master ${type}: ${cleanNama}`, adminId);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function updateMasterAction(type: 'KELAS' | 'MAPEL', id: string, newName: string, jenjang?: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('kelas-mapel', 'full');
    adminId = session.id; // Override adminId with session ID

    if (!newName || newName.trim().length < 2) throw new Error('Nama minimal 2 karakter.');
    const nama = sanitizeInput(newName);
    const sheetName = type === 'KELAS' ? 'KELAS' : 'MAPEL';
    
    // Check if exists
    const all = await dbGetAll(sheetName);
    const target = type === 'KELAS' ? all.find(x => x.id_kelas === id) : all.find(x => x.id_mapel === id);
    if (!target) throw new Error(`${type} tidak ditemukan.`);

    let updatedRow: any[] = [];
    if (type === 'KELAS') {
      const jenjangVal = ['SMP', 'SMA'].includes(String(jenjang).toUpperCase()) ? String(jenjang).toUpperCase() : 'SMA';
      updatedRow = [target.id_kelas, nama, jenjangVal, target.tahun_ajaran || '', target.semester || ''];
    } else {
      updatedRow = [target.id_mapel, nama];
    }

    await dbUpdateRow(sheetName, id, updatedRow);
    await logger.info('UPD_MASTER', `Update ${type} ${id} → ${nama}`, adminId);
    return { success: true, message: `${type} berhasil diperbarui.` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteMasterAction(type: 'KELAS' | 'MAPEL', id: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('kelas-mapel', 'full');
    adminId = session.id; // Override adminId with session ID
    if (type === 'KELAS') {
      const allSiswa = await dbGetAll('SISWA');
      const inUse = allSiswa.some(s => String(s.id_kelas) === String(id));
      if (inUse) throw new Error('Kelas tidak bisa dihapus karena masih memiliki data Siswa terkait.');
    } else {
      const allKunci = await dbGetAll('KUNCI_JAWABAN');
      const inUse = allKunci.some(k => String(k.id_mapel) === String(id));
      if (inUse) throw new Error('Mata Pelajaran tidak bisa dihapus karena masih memiliki Master Kunci Jawaban terkait.');
    }

    const sheetName = type === 'KELAS' ? 'KELAS' : 'MAPEL';
    const deleted = await dbFindAndDeleteRow(sheetName, id);
    if (!deleted) throw new Error('Item tidak ditemukan.');
    
    await logger.warn('DEL_MASTER', `Hapus ${type}: ${id}`, adminId);
    return { success: true, message: 'Berhasil dihapus.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
