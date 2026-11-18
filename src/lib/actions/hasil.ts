'use server';

import { dbGetAll, dbAppendRow, dbFindAndDeleteRow, generateId, dbUpdateRow, dbBatchAppendRows, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { hitungSkorV3 } from '@/lib/ai/grader-engine';
import { getAcademicSessionAction } from '@/lib/actions/settings';

/**
 * saveBatchHasilScanAction (Ultra Advanced Audit Phase)
 * Menyimpan banyak hasil scan sekaligus dalam satu transaksi batch.
 * Sangat efisien untuk proses scanning massal satu kelas.
 */
export async function saveBatchHasilScanAction(
  payloads: { id_kunci: string, id_siswa: string, answers: any[], confidence_score?: number, need_review?: boolean }[], 
  guruId: string
) {
  try {
    const authSession = await requireAuth();
    guruId = authSession.id;
    if (!payloads || payloads.length === 0) return { success: true, message: 'Tidak ada data untuk disimpan.' };

    const allKunci = await dbGetAll('KUNCI_JAWABAN', true);
    const idKunciUnik = [...new Set(payloads.map(p => p.id_kunci))];
    const kunciMap: Record<string, any> = {};
    
    for (const idK of idKunciUnik) {
      const k = allKunci.find(item => item.id_kunci === idK);
      if (k) {
        let data_json = [];
        let pengaturan_poin = {};
        try { data_json = typeof k.data_json === 'string' ? JSON.parse(k.data_json) : k.data_json; } catch{}
        try { pengaturan_poin = typeof k.pengaturan_poin === 'string' ? JSON.parse(k.pengaturan_poin) : k.pengaturan_poin; } catch{}
        kunciMap[idK] = { ...k, data_json, pengaturan_poin };
      }
    }

    if (authSession.role !== 'ADMIN') {
      const unauthorizedKey = idKunciUnik.find(idK => {
        const key = kunciMap[idK];
        return !key || String(key.id_guru) !== String(authSession.id);
      });
      if (unauthorizedKey) {
        throw new Error('Akses ditolak. Anda hanya dapat menyimpan hasil untuk kunci jawaban milik Anda sendiri.');
      }
    }

    const { data: acadSession } = await getAcademicSessionAction();
    const existingHasil = await dbGetAll('HASIL', false);

    const ts = new Date().toISOString();
    const rowsToAppend: any[][] = [];
    const results = [];
    let updatedCount = 0;

    for (const p of payloads) {
      const kunci = kunciMap[p.id_kunci];
      if (!kunci) continue;

      const rawSkorDetail = hitungSkorV3(p.answers, kunci);
      const skorDetail = {
        ...rawSkorDetail,
        confidence_score: p.confidence_score,
        need_review: p.need_review
      };

      const existingRow = existingHasil.find(
        (r) => String(r.id_siswa) === String(p.id_siswa) && String(r.id_kunci) === String(p.id_kunci)
      );
      const effectiveSemester = String(kunci.semester || existingRow?.semester || acadSession?.semester || 'GANJIL').toUpperCase();
      const effectiveTahun = String(kunci.tahun_ajaran || existingRow?.tahun_ajaran || acadSession?.tahunAjaran || '');

      if (existingRow && existingRow.id_hasil) {
        const updatedRowData = [
          existingRow.id_hasil,
          p.id_kunci,
          p.id_siswa,
          guruId,
          skorDetail.skor,
          JSON.stringify(skorDetail),
          ts,
          existingRow.is_override || '',
          existingRow.override_reason || '',
          effectiveTahun,
          effectiveSemester
        ];
        await dbUpdateRow('HASIL', existingRow.id_hasil, updatedRowData);
        updatedCount++;
        results.push({ id_siswa: p.id_siswa, skor: skorDetail.skor, id_hasil: existingRow.id_hasil, updated: true });
      } else {
        const newId = generateId('HSL');
        rowsToAppend.push([
          newId,
          p.id_kunci,
          p.id_siswa,
          guruId,
          skorDetail.skor,
          JSON.stringify(skorDetail),
          ts,
          '',
          '',
          effectiveTahun,
          effectiveSemester
        ]);
        results.push({ id_siswa: p.id_siswa, skor: skorDetail.skor, id_hasil: newId, updated: false });
      }
    }

    if (rowsToAppend.length > 0) {
      await dbBatchAppendRows('HASIL', rowsToAppend);
    }

    await logger.info(
      'SAVE_BATCH_SCORE',
      `Simpan batch selesai: ${rowsToAppend.length} baru, ${updatedCount} diperbarui.`,
      guruId
    );

    return { 
      success: true, 
      data: results, 
      message: updatedCount > 0
        ? `Berhasil menyimpan ${results.length} nilai siswa (${rowsToAppend.length} baru, ${updatedCount} diperbarui).`
        : `Berhasil menyimpan ${results.length} nilai siswa.`
    };
  } catch (e: any) {
    await logger.error('SAVE_BATCH_ERR', e.message, guruId);
    return { success: false, message: e.message };
  }
}

export async function saveHasilScanAction(reqData: { 
  id_kunci: string, 
  id_siswa: string, 
  answers: any[], 
  forceOverwrite?: boolean,
  confidence_score?: number,
  need_review?: boolean
}, guruId: string) {
  try {
    const authSession = await requireAuth();
    guruId = authSession.id;

    if (!reqData.id_kunci || !reqData.id_siswa) {
      throw new Error("Pilih Siswa dan Tes terkait terlebih dahulu sebelum menyimpan.");
    }

    const allKunci = await dbGetAll('KUNCI_JAWABAN');
    const kunciTerpilih = allKunci.find(k => k.id_kunci === reqData.id_kunci);

    if (!kunciTerpilih) throw new Error("Kunci jawaban master tidak ditemukan di sistem.");
    if (authSession.role !== 'ADMIN' && String(kunciTerpilih.id_guru) !== String(authSession.id)) {
      throw new Error("Akses ditolak. Anda hanya dapat menyimpan nilai untuk kunci jawaban milik Anda sendiri.");
    }

    let data_json = [];
    let pengaturan_poin = {};
    try { data_json = typeof kunciTerpilih.data_json === 'string' ? JSON.parse(kunciTerpilih.data_json) : kunciTerpilih.data_json; } catch{}
    try { pengaturan_poin = typeof kunciTerpilih.pengaturan_poin === 'string' ? JSON.parse(kunciTerpilih.pengaturan_poin) : kunciTerpilih.pengaturan_poin; } catch{}

    kunciTerpilih.data_json = data_json || [];
    kunciTerpilih.pengaturan_poin = pengaturan_poin || {};

    const sheetHasil = await dbGetAll('HASIL');
    let existingRowIndex = -1;
    let existingId = null;

    for (let i = 0; i < sheetHasil.length; i++) {
        const row = sheetHasil[i];
        if (String(row.id_siswa) === String(reqData.id_siswa) && String(row.id_kunci) === String(reqData.id_kunci)) {
            existingRowIndex = i + 1;
            existingId = row.id_hasil;
            break;
        }
    }

    if (existingRowIndex > -1 && !reqData.forceOverwrite) {
      throw new Error('OVERWRITE_CONFIRM');
    }

    const rawSkorDetail = hitungSkorV3(reqData.answers, kunciTerpilih);
    const skorDetail = {
      ...rawSkorDetail,
      confidence_score: reqData.confidence_score,
      need_review: reqData.need_review
    };
    
    const ts = new Date().toISOString();
    const { data: session } = await getAcademicSessionAction();

    if (existingRowIndex > -1 && reqData.forceOverwrite && existingId) {
       const rowUpdate = [
          existingId,
          reqData.id_kunci,
          reqData.id_siswa,
          guruId,
          skorDetail.skor,
          JSON.stringify(skorDetail),
          ts,
          sheetHasil[existingRowIndex - 1].is_override || '',
          sheetHasil[existingRowIndex - 1].override_reason || '',
          session?.tahunAjaran || '',
          session?.semester || ''
       ];

       await dbUpdateRow('HASIL', existingId, rowUpdate);
       
       const mutatedScore: any = { ...skorDetail, id_hasil: existingId, guru_id: guruId };
       await logger.info('SAVE_SCORE_UPDATE', `Skor diperbarui (Timpah): ${mutatedScore.skor} u/ siswa: ${reqData.id_siswa}`, guruId);
       return { success: true, data: mutatedScore, message: `Nilai (${mutatedScore.skor}) sukses diperbarui (Ditimpah).` };
    }

    const newId = generateId('HSL');
    const newRow = [
       newId,
       reqData.id_kunci,
       reqData.id_siswa,
       guruId,
       skorDetail.skor,
       JSON.stringify(skorDetail),
       ts,
       '',
       '',
       session?.tahunAjaran || '',
       session?.semester || ''
    ];

    await dbAppendRow('HASIL', newRow);

    const createdScore: any = { ...skorDetail, id_hasil: newId, guru_id: guruId };
    await logger.info('SAVE_SCORE', `Skor ${createdScore.skor} disimpan baru untuk siswa ID: ${reqData.id_siswa}`, guruId);

    return { success: true, data: createdScore, message: `Nilai (${createdScore.skor}) berhasil disimpan ke Database.` };

  } catch(e: any) {
    if (e.message !== 'OVERWRITE_CONFIRM') {
       await logger.error('SAVE_SCORE_ERR', e.message, guruId);
    }
    return { success: false, message: e.message };
  }
}

export async function getHasilAction(
  guruId?: string,
  semesterMode: 'ACTIVE' | 'ALL' | 'GANJIL' | 'GENAP' = 'ALL'
) {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = session?.tahunAjaran;
    const semester = session?.semester;
    const kkmEksakta = session?.kkmEksakta || 65;
    const kkmNonEksakta = session?.kkmNonEksakta || 70;
    const keywordsEksakta = session?.mapelEksakta || [];

    const [rows, mapels, kunci] = await Promise.all([
      dbGetAll('HASIL'),
      dbGetAll('MAPEL'),
      dbGetAll('KUNCI_JAWABAN')
    ]);

    let filtered = rows;
    if (authSession.role === 'ADMIN') {
      if (guruId) filtered = filtered.filter(r => String(r.id_guru) === String(guruId));
    } else {
      // Personal Guru Isolation: only show scores owned by the logged-in teacher.
      filtered = filtered.filter(r => String(r.id_guru) === String(authSession.id));
    }

    const cleanTahun = String(tahunAjaran || '').trim();
    const cleanSem = String(semester || 'GANJIL').trim().toUpperCase();
    const targetSem =
      semesterMode === 'GANJIL' || semesterMode === 'GENAP'
        ? semesterMode
        : semesterMode === 'ACTIVE'
          ? cleanSem
          : null;

    filtered = filtered.filter(r => {
      const kInfo = kunci.find(k => k.id_kunci === r.id_kunci);
      const rTahun = String(r.tahun_ajaran || kInfo?.tahun_ajaran || '').trim();
      const rSem = String(r.semester || kInfo?.semester || '').trim().toUpperCase();
      const matchTahun = !cleanTahun || !rTahun || rTahun.toLowerCase() === cleanTahun.toLowerCase();
      const matchSem = !targetSem || !rSem || rSem === targetSem;
      return matchTahun && matchSem;
    });

    // Enrich with dynamic KKM logic & resolved semester
    const data = filtered.map(h => {
      const kInfo = kunci.find(k => k.id_kunci === h.id_kunci);
      const mInfo = mapels.find(m => m.id_mapel === kInfo?.id_mapel);
      const namaMapel = (mInfo?.nama_mapel || '').toLowerCase();

      const isEksakta = keywordsEksakta.some(kw => namaMapel.includes(kw));
      const kkmReferansi = isEksakta ? kkmEksakta : kkmNonEksakta;
      const isLulus = Number(h.skor) >= kkmReferansi;

      let detail = {};
      try { detail = typeof h.detail_json === 'string' ? JSON.parse(h.detail_json) : h.detail_json; } catch{}

      const resolvedSemester = String(h.semester || kInfo?.semester || cleanSem || 'GANJIL').trim().toUpperCase();

      return {
        ...h,
        semester: resolvedSemester,
        detail_json: detail,
        kkm_referensi: kkmReferansi,
        is_lulus: isLulus,
        is_eksakta: isEksakta,
        is_override: h.is_override === 'TRUE' || h.is_override === true,
      };
    });

    return { success: true, data: data.reverse(), activeSemester: cleanSem };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveHasilAction(data: any) {
  try {
    const authSession = await requireAuth();
    data.id_guru = authSession.id;
    const { data: acadSession } = await getAcademicSessionAction();
    const tahunAjaran = acadSession?.tahunAjaran;
    const semester = acadSession?.semester;

    const id = generateId('HSL');
    const row = [
       id,
       data.id_kunci,
       data.id_siswa,
       data.id_guru,
      data.skor,
      JSON.stringify(data.detail_json),
      new Date().toISOString(),
      data.is_override || false,
      data.override_reason || '',
      tahunAjaran || '',
      semester || ''
    ];
    
    await dbAppendRow('HASIL', row);
    return { success: true, id };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// Mekanisme Human-in-the-Loop Override
export async function overrideHasilAction(idHasil: string, newScore: number, reason: string) {
  try {
    const authSession = await requireAuth();
    const guruId = authSession.id;
    const userRole = authSession.role;
    if (newScore < 0 || newScore > 100) throw new Error("Skor override harus antara 0 dan 100");
    if (!reason || reason.trim().length <= 5) throw new Error("Alasan override mutlak dibutuhkan (minimal 5 karakter) untuk keperluan Audit Trail.");

    const allHasil = await dbGetAll('HASIL');
    const target = allHasil.find(h => h.id_hasil === idHasil);
    
    if (!target) throw new Error("Data skor matriks tidak ditemukan.");
    if (target.id_guru !== guruId && userRole !== 'ADMIN') throw new Error("Akses ditolak. Bukan skor dari kelas Anda.");

    // Update Array: [id_hasil(0), id_kunci(1), id_siswa(2), id_guru(3), skor(4), detail_json(5), timestamp(6), is_override(7), override_reason(8), tahun_ajaran(9), semester(10)]
    const updatedRow = [
      target.id_hasil,
      target.id_kunci,
      target.id_siswa,
      target.id_guru,
      newScore,
      target.detail_json,
      target.timestamp,
      'TRUE',
      sanitizeInput(reason),
      target.tahun_ajaran || '',
      target.semester || ''
    ];

    await dbUpdateRow('HASIL', idHasil, updatedRow);
    await logger.warn('OVERRIDE_NILAI', `Override manual pada ID Hsl: ${idHasil}. Skor baru: ${newScore}. Alasan: ${reason}`, guruId);

    return { success: true, message: `Nilai berhasil di-override (TIMPA_MANUAL) ke: ${newScore}` };
  } catch(e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * updateHasilAnswersAction
 * Mengoreksi jawaban siswa per butir soal langsung dari menu Hasil & Skor,
 * menghitung ulang skor otomatis menggunakan hitungSkorV3, dan menyimpan ke DB.
 */
export async function updateHasilAnswersAction(
  idHasil: string,
  updatedAnswers: Array<{ no: number; ans: any; poin_manual?: number; ai_feedback?: string }>,
  reason: string = 'Koreksi jawaban per-butir soal oleh Guru'
) {
  try {
    const authSession = await requireAuth();
    const guruId = authSession.id;
    const userRole = authSession.role;

    const [allHasil, allKunci] = await Promise.all([
      dbGetAll('HASIL', false),
      dbGetAll('KUNCI_JAWABAN', true),
    ]);

    const target = allHasil.find((h) => String(h.id_hasil) === String(idHasil));
    if (!target) throw new Error('Data hasil ujian tidak ditemukan.');
    if (String(target.id_guru) !== String(guruId) && userRole !== 'ADMIN') {
      throw new Error('Akses ditolak. Bukan data hasil ujian milik kelas Anda.');
    }

    const rawKunci = allKunci.find((k) => String(k.id_kunci) === String(target.id_kunci));
    if (!rawKunci) throw new Error('Kunci jawaban master tidak ditemukan.');

    let data_json = [];
    let pengaturan_poin = {};
    try { data_json = typeof rawKunci.data_json === 'string' ? JSON.parse(rawKunci.data_json) : rawKunci.data_json; } catch {}
    try { pengaturan_poin = typeof rawKunci.pengaturan_poin === 'string' ? JSON.parse(rawKunci.pengaturan_poin) : rawKunci.pengaturan_poin; } catch {}

    const kunciObj = { ...rawKunci, data_json: data_json || [], pengaturan_poin: pengaturan_poin || {} };
    const recalc = hitungSkorV3(updatedAnswers, kunciObj);

    let prevDet: any = {};
    try { prevDet = typeof target.detail_json === 'string' ? JSON.parse(target.detail_json) : (target.detail_json || {}); } catch {}

    const newDetailJson = {
      ...recalc,
      confidence_score: prevDet.confidence_score ?? 1,
      need_review: false,
    };

    const updatedRow = [
      target.id_hasil,
      target.id_kunci,
      target.id_siswa,
      target.id_guru,
      recalc.skor,
      JSON.stringify(newDetailJson),
      new Date().toISOString(),
      'TRUE',
      sanitizeInput(reason || 'Koreksi jawaban per-butir soal oleh Guru'),
      target.tahun_ajaran || '',
      target.semester || '',
    ];

    await dbUpdateRow('HASIL', idHasil, updatedRow);
    await logger.info(
      'EDIT_BUTIR_HASIL',
      `Koreksi butir soal ID Hsl: ${idHasil}. Skor baru: ${recalc.skor} (${recalc.benar}B/${recalc.salah}S/${recalc.tidak_dijawab}K)`,
      guruId
    );

    return {
      success: true,
      data: {
        skor: recalc.skor,
        detail_json: newDetailJson,
      },
      message: `Jawaban per-butir berhasil diperbarui! Skor baru: ${recalc.skor}`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteHasilAction(idHasil: string) {
  try {
    const authSession = await requireAuth();
    const allHasil = await dbGetAll('HASIL');
    const target = allHasil.find(h => String(h.id_hasil) === String(idHasil));
    if (!target) throw new Error('Data hasil scan tidak ditemukan.');

    if (authSession.role !== 'ADMIN' && String(target.id_guru) !== String(authSession.id)) {
      throw new Error('Akses ditolak. Anda hanya dapat menghapus hasil scan milik Anda sendiri.');
    }

    const deleted = await dbFindAndDeleteRow('HASIL', idHasil);
    if (!deleted) throw new Error('Gagal menghapus hasil scan dari database.');

    await logger.warn('DEL_HASIL', `Hapus hasil scan ID: ${idHasil}`, authSession.id);
    return { success: true, message: 'Hasil scan berhasil dihapus.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteHasilBatchAction(ids: string[]) {
  try {
    const authSession = await requireAuth();
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('Tidak ada item yang dipilih.');

    let deletedCount = 0;
    for (const id of ids) {
      const res = await deleteHasilAction(id);
      if (res.success) deletedCount++;
    }

    await logger.warn('DEL_HASIL_BATCH', `Hapus ${deletedCount} hasil scan secara massal`, authSession.id);
    return {
      success: true,
      deletedCount,
      message: `${deletedCount} hasil scan berhasil dihapus.`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
