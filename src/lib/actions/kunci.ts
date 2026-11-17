'use server';

import { dbGetAll, dbAppendRow, dbFindAndDeleteRow, dbUpdateRow, generateId, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';

import { getAcademicSessionAction } from '@/lib/actions/settings';

// Schema KUNCI_JAWABAN: [id_kunci, id_guru, id_mapel, id_kelas, judul_ujian, tipe_soal, pengaturan_poin, data_json, timestamp, segmen, tahun_ajaran, semester]

export async function getKunciListAction(guruId?: string) {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = String(session?.tahunAjaran || '').trim();
    const semester = String(session?.semester || '').trim().toUpperCase();

    let allKunci = await dbGetAll('KUNCI_JAWABAN');
    const allMapel = await dbGetAll('MAPEL', true);
    const allKelas = await dbGetAll('KELAS', true);
    const allUsers = await dbGetAll('USERS', true);
    const allTugas = await dbGetAll('TUGAS_GURU', true);

    // Filter by Active Session (case-insensitive, fallback if empty)
    if (tahunAjaran) {
      allKunci = allKunci.filter(k => {
        const kTahun = String(k.tahun_ajaran || '').trim();
        const kSem = String(k.semester || '').trim().toUpperCase();
        const matchTahun = !kTahun || kTahun.toLowerCase() === tahunAjaran.toLowerCase();
        const matchSem = !semester || !kSem || kSem === semester;
        return matchTahun && matchSem;
      });
    }

    const mapMapel: Record<string, string> = {};
    allMapel.forEach(m => mapMapel[m.id_mapel] = m.nama_mapel);
    const mapKelas: Record<string, string> = {};
    const mapJenjang: Record<string, string> = {};
    allKelas.forEach(k => {
      mapKelas[k.id_kelas] = k.nama_kelas;
      mapJenjang[k.id_kelas] = k.jenjang || 'SMA';
    });
    const mapUser: Record<string, string> = {};
    allUsers.forEach(u => mapUser[u.id_user] = u.nama);

    const effectiveGuruId = authSession.role === 'ADMIN'
      ? guruId
      : authSession.id;
    
    let filtered = effectiveGuruId
      ? allKunci.filter(k => String(k.id_guru) === String(effectiveGuruId))
      : allKunci;

    // Personal Guru Isolation (Even for filtered results, ensure only assigned tasks are visible if GURU)
    if (authSession.role === 'GURU') {
      const myTugas = allTugas.filter(t => String(t.id_user) === String(authSession.id));
      const myMapelIds = new Set(myTugas.map(t => t.id_mapel));
      const myKelasIds = new Set(myTugas.map(t => t.id_kelas));
      
      filtered = filtered.filter(k => myMapelIds.has(k.id_mapel) && myKelasIds.has(k.id_kelas));
    }

    const parsed = filtered.map(k => {
      let pengaturan_poin = {};
      let data_json = [];
      let segmen = [];

      try { pengaturan_poin = typeof k.pengaturan_poin === 'string' ? JSON.parse(k.pengaturan_poin) : k.pengaturan_poin; } catch{}
      try { data_json = typeof k.data_json === 'string' ? JSON.parse(k.data_json) : k.data_json; } catch{}
      try { segmen = typeof k.segmen === 'string' ? JSON.parse(k.segmen) : k.segmen; } catch{}
      
      return { 
        ...k, 
        pengaturan_poin, 
        data_json, 
        segmen,
        nama_mapel: mapMapel[k.id_mapel] || k.id_mapel,
        nama_kelas: mapKelas[k.id_kelas] || k.id_kelas || 'Semua Kelas',
        jenjang: mapJenjang[k.id_kelas] || 'SMA',
        nama_guru: mapUser[k.id_guru] || k.id_guru
      };
    });

    return { success: true, data: parsed.reverse() };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveKunciAction(dataKunci: any) {
  try {
    const authSession = await requireAuth();
    const guruId = authSession.id;
    const userRole = authSession.role;

    if (!dataKunci.id_mapel || !dataKunci.id_kelas || !dataKunci.judul_ujian) throw new Error('Mapel, Kelas, dan Judul Ujian wajib diisi.');
    if (!Array.isArray(dataKunci.data_json) || dataKunci.data_json.length === 0) {
      throw new Error("Kunci jawaban tidak boleh kosong.");
    }

    const isEdit = !!dataKunci.id_kunci;
    const id = dataKunci.id_kunci || generateId('KNC');
    const normalizedItems = (dataKunci.data_json || []).map((item: any, index: number) => {
      const tipe = item.tipe || dataKunci.tipe_soal || 'single_choice';
      const baseItem: Record<string, any> = {
        no: Number(item.no) || (index + 1),
        tipe,
        jawaban: item.jawaban,
        opsi: Array.isArray(item.opsi) ? item.opsi : []
      };

      if (tipe === 'multiple_true_false') {
        baseItem.jumlah_pernyataan = Math.max(2, Math.min(10, Number(item.jumlah_pernyataan) || 3));
      }

      if (tipe === 'matching') {
        baseItem.jumlah_pasang = Math.max(2, Math.min(5, Number(item.jumlah_pasang) || 3));
      }

      if (tipe === 'short_answer') {
        baseItem.panjang_jawaban = Math.max(3, Math.min(20, Number(item.panjang_jawaban) || 10));
      }

      return baseItem;
    });
    
    const { data: acadSession } = await getAcademicSessionAction();

    // Include Academic Session in Row Content
    const rowContent = [
      id,
      guruId,
      dataKunci.id_mapel,
      dataKunci.id_kelas,
      sanitizeInput(dataKunci.judul_ujian),
      dataKunci.tipe_soal,
      JSON.stringify(dataKunci.pengaturan_poin || {}),
      JSON.stringify(normalizedItems),
      new Date().toISOString(),
      JSON.stringify(dataKunci.segmen || []),
      acadSession?.tahunAjaran || '',
      acadSession?.semester || ''
    ];

    if (isEdit) {
      // Edit mode
      const allData = await dbGetAll('KUNCI_JAWABAN');
      const target = allData.find(k => k.id_kunci === id);
      if(!target) throw new Error("Kunci ujian tidak ditemukan.");
      if (target.id_guru !== guruId && userRole !== 'ADMIN') throw new Error("Akses ditolak. Bukan pemilik ujian ini.");
      
      const rowUpdate = [ ...rowContent ];
      rowUpdate[1] = target.id_guru || guruId;
      rowUpdate[10] = target.tahun_ajaran || acadSession?.tahunAjaran || '2026/2027';
      rowUpdate[11] = target.semester || acadSession?.semester || 'GANJIL';
      await dbUpdateRow('KUNCI_JAWABAN', id, rowUpdate);
      
      await logger.info('EDIT_TEST', `Diperbarui tes: ${dataKunci.judul_ujian}`, guruId);
      return { success: true, message: 'Kunci ujian berhasil diperbarui.' };
    } else {
      // Add mode
      await dbAppendRow('KUNCI_JAWABAN', rowContent);
      await logger.info('CREATE_TEST', `Dibuat tes baru: ${dataKunci.judul_ujian}`, guruId);
      return { success: true, message: 'Kunci ujian baru berhasil dibuat.' };
    }
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteKunciAction(idKunci: string) {
  try {
    const authSession = await requireAuth();
    const guruId = authSession.id;
    const userRole = authSession.role;
    // SECURITY: Cascading Check (Phase 9.2)
    const allHasil = await dbGetAll('HASIL');
    const hasScores = allHasil.some(h => String(h.id_kunci) === String(idKunci));
    
    if (hasScores) {
      throw new Error("PENGHAPUSAN DITOLAK: Kunci ini tidak bisa dihapus because sudah ada hasil scan yang tersimpan di Database. Sila hapus hasil scan terkait terlebih dahulu.");
    }

    const allKunci = await dbGetAll('KUNCI_JAWABAN');
    const target = allKunci.find(k => k.id_kunci === idKunci);
    if (!target) throw new Error('Kunci ujian tidak ditemukan.');
    if (target.id_guru !== guruId && userRole !== 'ADMIN') throw new Error('Akses ditolak. Bukan pemilik.');

    const deleted = await dbFindAndDeleteRow('KUNCI_JAWABAN', idKunci);
    if(!deleted) throw new Error("Gagal menghapus data dari DB");

    await logger.warn('DEL_TEST', `Dihapus Kunci ID: ${idKunci}`, guruId);
    return { success: true, message: 'Kunci ujian berhasil dihapus.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
