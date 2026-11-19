'use server';

import {
  AiExtractInputFile,
  AiExtractMode,
  extractTextFromDocxBuffer,
  formatAiExtractError,
  runAiKeyExtraction,
} from '@/lib/ai/kunci-extractor';
import {
  dbAppendRow,
  dbBatchAppendRows,
  dbBatchUpdateRows,
  dbFindAndDeleteRow,
  dbGetAll,
  dbUpdateRow,
  generateId,
  sanitizeInput,
} from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { getAcademicSessionAction, getSettingsAction } from '@/lib/actions/settings';
import { hitungSkorV3 } from '@/lib/ai/grader-engine';
import { buildMatchingSingleOptions, getTipeMeta, MATCHING_SINGLE_LETTERS } from '@/lib/constants/tipe-soal';

// Schema KUNCI_JAWABAN: [id_kunci, id_guru, id_mapel, id_kelas, judul_ujian, tipe_soal, pengaturan_poin, data_json, timestamp, segmen, tahun_ajaran, semester]

function normalizeKunciItemsAndPoin(dataKunci: any) {
  const rawPoinMap = dataKunci.pengaturan_poin || {};
  const normalizedPoinMap: Record<string, any> = {};
  if (rawPoinMap.benar !== undefined) normalizedPoinMap.benar = Number(rawPoinMap.benar) || 1;
  if (rawPoinMap.salah !== undefined) {
    const ps = Number(rawPoinMap.salah);
    normalizedPoinMap.salah = Number.isFinite(ps) && ps < 0 ? Math.round(ps * 100) / 100 : 0;
  }
  if (rawPoinMap.kompleks_mode === 'parsial' || rawPoinMap.kompleks_mode === 'mutlak') {
    normalizedPoinMap.kompleks_mode = rawPoinMap.kompleks_mode;
  }
  if (typeof rawPoinMap.bobot_mode === 'string' && rawPoinMap.bobot_mode) {
    normalizedPoinMap.bobot_mode = rawPoinMap.bobot_mode;
  }
  if (rawPoinMap.bobot_persen && typeof rawPoinMap.bobot_persen === 'object') {
    normalizedPoinMap.bobot_persen = rawPoinMap.bobot_persen;
  }
  if (typeof rawPoinMap.jenis_asesmen === 'string' && rawPoinMap.jenis_asesmen.trim()) {
    normalizedPoinMap.jenis_asesmen = rawPoinMap.jenis_asesmen.trim();
  }

  const normalizedItems = (dataKunci.data_json || []).map((item: any, index: number) => {
    const no = Number(item.no) || index + 1;
    const meta = getTipeMeta(item.tipe || dataKunci.tipe_soal || 'single_choice');
    const tipe = meta.kode;
    const perlakuan =
      item.perlakuan === 'bonus' || item.perlakuan === 'anulir' ? item.perlakuan : undefined;

    const rawPoin = item.poin ?? rawPoinMap[String(no)];
    const parsedPoin = Number(rawPoin);
    const poin =
      perlakuan === 'anulir'
        ? 0
        : Number.isFinite(parsedPoin) && parsedPoin >= 0.05
          ? Math.round(parsedPoin * 100) / 100
          : 1;
    normalizedPoinMap[String(no)] = poin;

    const baseItem: Record<string, any> = {
      no,
      tipe,
      jawaban:
        typeof item.jawaban === 'string' && (tipe === 'short_answer' || tipe === 'essay')
          ? item.jawaban.trim()
          : item.jawaban,
      opsi: Array.isArray(item.opsi) && item.opsi.length > 0 ? item.opsi : [...meta.opsi],
      poin,
    };

    if (perlakuan) baseItem.perlakuan = perlakuan;

    if (tipe === 'multiple_true_false') {
      baseItem.jumlah_pernyataan = Math.max(2, Math.min(10, Number(item.jumlah_pernyataan) || 3));
    }
    if (tipe === 'matching') {
      baseItem.jumlah_pasang = Math.max(2, Math.min(5, Number(item.jumlah_pasang) || 3));
    }
    if (tipe === 'matching_single') {
      const validSet = new Set<string>(MATCHING_SINGLE_LETTERS);
      const rawOpsi = Array.isArray(item.opsi)
        ? item.opsi.map((o: any) => String(o || '').trim().toUpperCase()).filter((o: string) => validSet.has(o))
        : [];
      const opsiCount = rawOpsi.length >= 5 ? Math.min(MATCHING_SINGLE_LETTERS.length, rawOpsi.length) : 10;
      const resolvedOpsi = buildMatchingSingleOptions(opsiCount);
      baseItem.opsi = resolvedOpsi;
      const rawAns = String(item.jawaban ?? '').trim().toUpperCase().replace(/[^A-L]/g, '').charAt(0);
      baseItem.jawaban = resolvedOpsi.includes(rawAns) ? rawAns : '';
    }
    if (tipe === 'short_answer') {
      baseItem.panjang_jawaban = Math.max(3, Math.min(20, Number(item.panjang_jawaban) || 10));
    }

    return baseItem;
  });

  return { normalizedItems, normalizedPoinMap };
}

export async function getKunciListAction(
  guruId?: string,
  semesterMode: 'ACTIVE' | 'ALL' | 'GANJIL' | 'GENAP' = 'ACTIVE'
) {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = String(session?.tahunAjaran || '').trim();
    const activeSemester = String(session?.semester || '').trim().toUpperCase() || 'GANJIL';

    const [rawKunci, allMapel, allKelas, allUsers, allTugas, allHasil] = await Promise.all([
      dbGetAll('KUNCI_JAWABAN'),
      dbGetAll('MAPEL', true),
      dbGetAll('KELAS', true),
      dbGetAll('USERS', true),
      dbGetAll('TUGAS_GURU', true),
      dbGetAll('HASIL', true),
    ]);

    let allKunci = rawKunci;

    // Filter by Active Tahun Ajaran + Semester sesuai mode (ACTIVE/ALL/GANJIL/GENAP)
    const targetSem =
      semesterMode === 'GANJIL' || semesterMode === 'GENAP'
        ? semesterMode
        : semesterMode === 'ACTIVE'
          ? activeSemester
          : '';

    allKunci = allKunci.filter((k) => {
      const kTahun = String(k.tahun_ajaran || '').trim();
      const kSem = String(k.semester || '').trim().toUpperCase();
      const matchTahun = !tahunAjaran || !kTahun || kTahun.toLowerCase() === tahunAjaran.toLowerCase();
      const matchSem = !targetSem || !kSem || kSem === targetSem;
      return matchTahun && matchSem;
    });

    const hasilCountMap: Record<string, number> = {};
    allHasil.forEach((h) => {
      const kid = String(h.id_kunci || '');
      if (kid) hasilCountMap[kid] = (hasilCountMap[kid] || 0) + 1;
    });

    const mapMapel: Record<string, string> = {};
    allMapel.forEach((m) => {
      mapMapel[m.id_mapel] = m.nama_mapel;
    });
    const mapKelas: Record<string, string> = {};
    const mapJenjang: Record<string, string> = {};
    allKelas.forEach((k) => {
      mapKelas[k.id_kelas] = k.nama_kelas;
      mapJenjang[k.id_kelas] = k.jenjang || 'SMA';
    });
    const mapUser: Record<string, string> = {};
    allUsers.forEach((u) => {
      mapUser[u.id_user] = u.nama;
    });

    const effectiveGuruId = authSession.role === 'ADMIN' ? guruId : authSession.id;

    let filtered = effectiveGuruId
      ? allKunci.filter((k) => String(k.id_guru) === String(effectiveGuruId))
      : allKunci;

    // Personal Guru Isolation
    if (authSession.role === 'GURU') {
      const myTugas = allTugas.filter((t) => String(t.id_user) === String(authSession.id));
      const myMapelIds = new Set(myTugas.map((t) => t.id_mapel));
      const myKelasIds = new Set(myTugas.map((t) => t.id_kelas));

      filtered = filtered.filter((k) => myMapelIds.has(k.id_mapel) && myKelasIds.has(k.id_kelas));
    }

    const parsed = filtered.map((k) => {
      let pengaturan_poin = {};
      let data_json = [];
      let segmen = [];

      try {
        pengaturan_poin =
          typeof k.pengaturan_poin === 'string' ? JSON.parse(k.pengaturan_poin) : k.pengaturan_poin;
      } catch {}
      try {
        data_json = typeof k.data_json === 'string' ? JSON.parse(k.data_json) : k.data_json;
      } catch {}
      try {
        segmen = typeof k.segmen === 'string' ? JSON.parse(k.segmen) : k.segmen;
      } catch {}

      return {
        ...k,
        pengaturan_poin,
        data_json,
        segmen,
        nama_mapel: mapMapel[k.id_mapel] || k.id_mapel,
        nama_kelas: mapKelas[k.id_kelas] || k.id_kelas || 'Semua Kelas',
        jenjang: mapJenjang[k.id_kelas] || 'SMA',
        nama_guru: mapUser[k.id_guru] || k.id_guru,
        hasil_count: hasilCountMap[String(k.id_kunci)] || 0,
      };
    });

    return { success: true, data: parsed.reverse(), activeSemester };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function saveKunciAction(dataKunci: any) {
  try {
    const authSession = await requireAuth();
    const guruId = authSession.id;
    const userRole = authSession.role;

    const trimmedJudul = String(dataKunci.judul_ujian || '').trim();
    const targetKelasIds: string[] =
      Array.isArray(dataKunci.target_kelas_ids) && dataKunci.target_kelas_ids.length > 0
        ? Array.from(
            new Set<string>(
              dataKunci.target_kelas_ids.map((v: any) => String(v || '').trim()).filter(Boolean)
            )
          )
        : dataKunci.id_kelas
          ? [String(dataKunci.id_kelas).trim()]
          : [];

    if (!dataKunci.id_mapel || targetKelasIds.length === 0 || !trimmedJudul) {
      throw new Error('Mapel, Kelas, dan Judul Ujian wajib diisi.');
    }
    if (!Array.isArray(dataKunci.data_json) || dataKunci.data_json.length === 0) {
      throw new Error('Kunci jawaban tidak boleh kosong.');
    }

    const isEdit = !!dataKunci.id_kunci;
    const { normalizedItems, normalizedPoinMap } = normalizeKunciItemsAndPoin(dataKunci);
    const { data: acadSession } = await getAcademicSessionAction();
    const nowIso = new Date().toISOString();
    const serializedPoin = JSON.stringify(normalizedPoinMap);
    const serializedItems = JSON.stringify(normalizedItems);
    const serializedSegmen = JSON.stringify(dataKunci.segmen || []);
    const tahunStr = acadSession?.tahunAjaran || '';
    const explicitSem = String(dataKunci.semester || '').trim().toUpperCase();
    const validExplicitSem = explicitSem === 'GANJIL' || explicitSem === 'GENAP' ? explicitSem : '';
    const semStr = validExplicitSem || acadSession?.semester || 'GANJIL';

    if (isEdit) {
      const id = String(dataKunci.id_kunci);
      const allData = await dbGetAll('KUNCI_JAWABAN');
      const target = allData.find((k) => k.id_kunci === id);
      if (!target) throw new Error('Kunci ujian tidak ditemukan.');
      if (target.id_guru !== guruId && userRole !== 'ADMIN') {
        throw new Error('Akses ditolak. Bukan pemilik ujian ini.');
      }

      const rowUpdate = [
        id,
        target.id_guru || guruId,
        dataKunci.id_mapel,
        targetKelasIds[0],
        sanitizeInput(trimmedJudul),
        dataKunci.tipe_soal,
        serializedPoin,
        serializedItems,
        nowIso,
        serializedSegmen,
        target.tahun_ajaran || tahunStr,
        validExplicitSem || target.semester || semStr,
      ];
      await dbUpdateRow('KUNCI_JAWABAN', id, rowUpdate);

      await logger.info('EDIT_TEST', `Diperbarui tes: ${trimmedJudul}`, guruId);
      return { success: true, id_kunci: id, message: 'Kunci ujian berhasil diperbarui.' };
    }

    // Add mode: dukung simpan 1 kelas atau duplikat ke banyak kelas sekaligus
    if (targetKelasIds.length > 1) {
      const createdIds: string[] = [];
      const rows = targetKelasIds.map((kelasId) => {
        const nextId = generateId('KNC');
        createdIds.push(nextId);
        return [
          nextId,
          guruId,
          dataKunci.id_mapel,
          kelasId,
          sanitizeInput(trimmedJudul),
          dataKunci.tipe_soal,
          serializedPoin,
          serializedItems,
          nowIso,
          serializedSegmen,
          tahunStr,
          semStr,
        ];
      });

      await dbBatchAppendRows('KUNCI_JAWABAN', rows);
      await logger.info(
        'CREATE_TEST_BATCH',
        `Dibuat tes massal (${targetKelasIds.length} kelas): ${trimmedJudul}`,
        guruId
      );
      return {
        success: true,
        id_kunci: createdIds[0],
        created_ids: createdIds,
        message: `Berhasil membuat kunci ujian untuk ${targetKelasIds.length} kelas sekaligus.`,
      };
    }

    const id = generateId('KNC');
    const rowContent = [
      id,
      guruId,
      dataKunci.id_mapel,
      targetKelasIds[0],
      sanitizeInput(trimmedJudul),
      dataKunci.tipe_soal,
      serializedPoin,
      serializedItems,
      nowIso,
      serializedSegmen,
      tahunStr,
      semStr,
    ];
    await dbAppendRow('KUNCI_JAWABAN', rowContent);
    await logger.info('CREATE_TEST', `Dibuat tes baru: ${trimmedJudul}`, guruId);
    return { success: true, id_kunci: id, message: 'Kunci ujian baru berhasil dibuat.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteKunciAction(idKunci: string) {
  try {
    const authSession = await requireAuth();
    const guruId = authSession.id;
    const userRole = authSession.role;

    const allHasil = await dbGetAll('HASIL');
    const hasScores = allHasil.some((h) => String(h.id_kunci) === String(idKunci));
    if (hasScores) {
      throw new Error(
        'PENGHAPUSAN DITOLAK: Kunci ini tidak bisa dihapus karena sudah ada hasil scan yang tersimpan di Database. Silakan hapus hasil scan terkait terlebih dahulu.'
      );
    }

    const allKunci = await dbGetAll('KUNCI_JAWABAN');
    const target = allKunci.find((k) => k.id_kunci === idKunci);
    if (!target) throw new Error('Kunci ujian tidak ditemukan.');
    if (target.id_guru !== guruId && userRole !== 'ADMIN') {
      throw new Error('Akses ditolak. Bukan pemilik.');
    }

    const deleted = await dbFindAndDeleteRow('KUNCI_JAWABAN', idKunci);
    if (!deleted) throw new Error('Gagal menghapus data dari DB');

    await logger.warn('DEL_TEST', `Dihapus Kunci ID: ${idKunci}`, guruId);
    return { success: true, message: 'Kunci ujian berhasil dihapus.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/** Hitung ulang seluruh nilai siswa tersimpan di HASIL untuk suatu id_kunci mengikuti kunci & pembobotan terbaru. */
export async function regradeKunciHasilAction(idKunci: string) {
  try {
    const authSession = await requireAuth();
    const [allKunci, allHasil] = await Promise.all([
      dbGetAll('KUNCI_JAWABAN', false),
      dbGetAll('HASIL', false),
    ]);

    const rawKunci = allKunci.find((k) => String(k.id_kunci) === String(idKunci));
    if (!rawKunci) throw new Error('Kunci ujian tidak ditemukan.');
    if (String(rawKunci.id_guru) !== String(authSession.id) && authSession.role !== 'ADMIN') {
      throw new Error('Akses ditolak. Bukan pemilik ujian ini.');
    }

    let data_json: any[] = [];
    let pengaturan_poin: Record<string, any> = {};
    try {
      data_json = typeof rawKunci.data_json === 'string' ? JSON.parse(rawKunci.data_json) : rawKunci.data_json;
    } catch {}
    try {
      pengaturan_poin =
        typeof rawKunci.pengaturan_poin === 'string'
          ? JSON.parse(rawKunci.pengaturan_poin)
          : rawKunci.pengaturan_poin;
    } catch {}

    const kunciObj = {
      ...rawKunci,
      data_json: Array.isArray(data_json) ? data_json : [],
      pengaturan_poin: pengaturan_poin || {},
    };

    const targetHasil = allHasil.filter((h) => String(h.id_kunci) === String(idKunci));
    if (targetHasil.length === 0) {
      return { success: true, updatedCount: 0, message: 'Belum ada hasil siswa untuk dihitung ulang.' };
    }

    const updates: { id: string; values: unknown[] }[] = [];
    let skippedManualOverride = 0;
    const nowIso = new Date().toISOString();

    for (const h of targetHasil) {
      const reasonStr = String(h.override_reason || '');
      const hasManualTotalOverride =
        String(h.is_override || '').toUpperCase() === 'TRUE' &&
        reasonStr &&
        !reasonStr.includes('Koreksi jawaban') &&
        !reasonStr.includes('Regrade');

      if (hasManualTotalOverride) {
        skippedManualOverride++;
        continue;
      }

      let prevDet: any = {};
      try {
        prevDet = typeof h.detail_json === 'string' ? JSON.parse(h.detail_json) : h.detail_json || {};
      } catch {}

      const prevDetailRows = Array.isArray(prevDet?.detail) ? prevDet.detail : [];
      const reconstructedAnswers = prevDetailRows.map((d: any) => ({
        no: Number(d.no),
        ans: d.jawaban,
        ...(d.poin_manual !== undefined && !d.is_auto_essay && d.perlakuan !== 'bonus'
          ? { poin_manual: d.poin_manual }
          : {}),
        ...(d.ai_feedback && d.perlakuan !== 'bonus' ? { ai_feedback: d.ai_feedback } : {}),
      }));

      const recalc = hitungSkorV3(reconstructedAnswers, kunciObj);
      const nextDetailJson = {
        ...recalc,
        confidence_score: prevDet?.confidence_score,
        need_review: prevDet?.need_review,
      };

      updates.push({
        id: String(h.id_hasil),
        values: [
          h.id_hasil,
          h.id_kunci,
          h.id_siswa,
          h.id_guru,
          recalc.skor,
          JSON.stringify(nextDetailJson),
          nowIso,
          h.is_override || '',
          h.override_reason || '',
          h.tahun_ajaran || '',
          h.semester || '',
        ],
      });
    }

    if (updates.length > 0) {
      await dbBatchUpdateRows('HASIL', updates);
    }

    await logger.info(
      'REGRADE_KUNCI',
      `Hitung ulang ${updates.length} hasil siswa pada Kunci ID: ${idKunci}`,
      authSession.id
    );

    const skippedNote =
      skippedManualOverride > 0 ? ` (${skippedManualOverride} nilai override manual dipertahankan)` : '';
    return {
      success: true,
      updatedCount: updates.length,
      message: `${updates.length} nilai siswa berhasil dihitung ulang sesuai bobot baru${skippedNote}.`,
    };
  } catch (e: any) {
    return { success: false, message: e.message || 'Gagal menghitung ulang nilai siswa.' };
  }
}

/** Ekstrak soal & kunci jawaban terstruktur (8 tipe AKM) dari teks, Word (.docx), PDF, atau multi-foto via Gemini AI. */
export async function extractKunciWithAIAction(payload: {
  rawText?: string;
  imageBase64?: string;
  mimeType?: string;
  files?: AiExtractInputFile[];
  mode?: AiExtractMode;
  scaleTo100?: boolean;
}) {
  try {
    const authSession = await requireAuth();
    const rawTextParts: string[] = [];
    if (payload.rawText && String(payload.rawText).trim()) {
      rawTextParts.push(String(payload.rawText).trim());
    }

    const incomingFiles: AiExtractInputFile[] = [];
    if (Array.isArray(payload.files)) {
      incomingFiles.push(...payload.files.slice(0, 8));
    } else if (payload.imageBase64 && String(payload.imageBase64).trim()) {
      incomingFiles.push({
        name: 'lampiran-kunci',
        base64: String(payload.imageBase64).trim(),
        mimeType: String(payload.mimeType || 'image/jpeg').trim(),
      });
    }

    const mediaFiles: AiExtractInputFile[] = [];
    for (const f of incomingFiles) {
      if (!f?.base64) continue;
      const lowerName = (f.name || '').toLowerCase();
      const mime = (f.mimeType || '').toLowerCase();

      if (
        lowerName.endsWith('.docx') ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const docText = extractTextFromDocxBuffer(Buffer.from(f.base64, 'base64'));
        if (docText) rawTextParts.push(`[DOKUMEN WORD: ${f.name}]\n${docText}`);
      } else if (
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.csv') ||
        mime.startsWith('text/')
      ) {
        const plain = Buffer.from(f.base64, 'base64').toString('utf8').trim();
        if (plain) rawTextParts.push(`[DOKUMEN TEKS: ${f.name}]\n${plain}`);
      } else if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
        mediaFiles.push({ name: f.name || 'dokumen.pdf', base64: f.base64, mimeType: 'application/pdf' });
      } else if (mime.startsWith('image/') || !mime) {
        mediaFiles.push({ name: f.name || 'gambar.jpg', base64: f.base64, mimeType: f.mimeType || 'image/jpeg' });
      } else {
        throw new Error(
          `Format file "${f.name}" belum didukung (${f.mimeType || 'tidak dikenal'}). Gunakan Foto (JPG/PNG/WEBP), PDF, Word (.docx), atau TXT.`
        );
      }
    }

    const combinedText = rawTextParts.join('\n\n---\n\n').trim();
    if (!combinedText && mediaFiles.length === 0) {
      throw new Error('Tempel teks soal/kunci atau unggah file (Foto, PDF, Word .docx, atau TXT) terlebih dahulu.');
    }

    const settingsRes = await getSettingsAction(true);
    const settings = (settingsRes.data || {}) as Record<string, string>;

    const result = await runAiKeyExtraction({
      rawText: combinedText,
      mediaFiles,
      mode: payload.mode || 'auto',
      scaleTo100: payload.scaleTo100 !== false,
      settings,
    });

    await logger.info(
      'AI_EXTRACT_KUNCI',
      `Ekstrak AI (${result.modelUsed}, mode=${payload.mode || 'auto'}) menghasilkan ${result.items.length} butir (${result.uncertainNumbers.length} perlu ditinjau)`,
      authSession.id
    );

    return {
      success: true,
      data: result,
    };
  } catch (e: any) {
    return {
      success: false,
      message: formatAiExtractError(e),
    };
  }
}
