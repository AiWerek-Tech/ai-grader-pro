'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
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
import { resolveApiKeyPool } from '@/lib/ai/gemini-fallback';
import { hitungSkorV3 } from '@/lib/ai/grader-engine';
import { getTipeMeta } from '@/lib/constants/tipe-soal';

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

/** Ekstrak kunci jawaban terstruktur (8 tipe AKM) dari teks soal/kunci atau gambar menggunakan Gemini AI. */
export async function extractKunciWithAIAction(payload: {
  rawText?: string;
  imageBase64?: string;
  mimeType?: string;
}) {
  try {
    const authSession = await requireAuth();
    const rawText = String(payload.rawText || '').trim();
    const imageBase64 = String(payload.imageBase64 || '').trim();
    const mimeType = String(payload.mimeType || 'image/jpeg').trim();

    if (!rawText && !imageBase64) {
      throw new Error('Masukkan teks soal/kunci atau unggah foto lembar kunci.');
    }

    const settingsRes = await getSettingsAction();
    const settings = (settingsRes.data || {}) as Record<string, string>;
    const apiKeys = resolveApiKeyPool(settings);
    const activeKey = apiKeys[0] || process.env.GEMINI_API_KEY || '';
    if (!activeKey) {
      throw new Error('API Key Gemini belum dikonfigurasi di Pengaturan atau .env.local.');
    }

    const prompt = `Anda adalah asisten penyusun kunci jawaban asesmen sekolah Indonesia.
Tugas: Ekstrak seluruh butir kunci jawaban dari materi yang diberikan ke JSON valid.
Gunakan HANYA kode tipe soal berikut:
- "single_choice": PG 5 opsi A-E (jawaban: "A".."E")
- "single_choice_4": PG 4 opsi A-D (jawaban: "A".."D")
- "true_false": Benar/Salah (jawaban: "B" atau "S")
- "multiple_select": PG Kompleks >1 jawaban (jawaban: ["A","C"])
- "multiple_true_false": B/S Majemuk (jawaban: ["B","S","B"], jumlah_pernyataan: integer 2..10)
- "matching": Menjodohkan (jawaban: {"1":"A","2":"B"}, jumlah_pasang: integer 2..5)
- "short_answer": Isian Singkat (jawaban: string kata/angka, pisah sinonim dengan "|")
- "essay": Uraian/Esai (jawaban: kata kunci singkat pisah "|", atau "" jika manual)

Format JSON WAJIB:
{
  "judul_saran": "Judul ujian singkat jika terdeteksi atau kosong",
  "items": [
    { "no": 1, "tipe": "single_choice", "jawaban": "A", "poin": 2 }
  ]
}
Maksimal 100 soal. Jangan kembalikan penjelasan di luar JSON.${
      rawText ? `\n\nMATERI TEKS:\n${rawText.slice(0, 20000)}` : ''
    }`;

    const configuredModel = settings?.ai_model;
    const candidateModels = [...new Set([
      configuredModel || 'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-2.0-flash',
    ])];

    let rawResponse = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(activeKey);
        const model = genAI.getGenerativeModel(
          {
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          },
          { apiVersion: 'v1beta' }
        );
        const parts: any[] = imageBase64
          ? [{ inlineData: { data: imageBase64, mimeType } }, prompt]
          : [prompt];
        const result = await model.generateContent(parts);
        rawResponse = result.response.text();
        if (rawResponse) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!rawResponse) {
      throw new Error(lastError?.message || 'Gemini AI gagal memproses materi kunci.');
    }

    const cleaned = rawResponse
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
    if (rawItems.length === 0) {
      throw new Error('AI tidak menemukan butir kunci jawaban yang jelas pada materi tersebut.');
    }

    const sanitizedItems = rawItems.slice(0, 100).map((it: any, idx: number) => {
      const meta = getTipeMeta(it?.tipe);
      const no = Number(it?.no) || idx + 1;
      const poin = Math.max(0.05, Math.round((Number(it?.poin) || 1) * 100) / 100);
      const base: Record<string, any> = {
        no,
        tipe: meta.kode,
        opsi: [...meta.opsi],
        poin,
        jawaban: it?.jawaban ?? '',
      };

      if (meta.kode === 'multiple_true_false') {
        const arr = Array.isArray(it?.jawaban)
          ? it.jawaban.map((v: any) => (String(v).toUpperCase().startsWith('S') ? 'S' : 'B'))
          : ['B', 'S', 'B'];
        const jp = Math.max(2, Math.min(10, Number(it?.jumlah_pernyataan) || arr.length || 3));
        base.jumlah_pernyataan = jp;
        base.jawaban = Array.from({ length: jp }, (_, i) => arr[i] || 'B');
      } else if (meta.kode === 'matching') {
        const jps = Math.max(2, Math.min(5, Number(it?.jumlah_pasang) || 3));
        const obj = it?.jawaban && typeof it.jawaban === 'object' ? it.jawaban : {};
        const cleanMap: Record<string, string> = {};
        for (let i = 1; i <= jps; i++) {
          const val = String(obj[String(i)] || 'A').toUpperCase().slice(0, 1);
          cleanMap[String(i)] = ['A', 'B', 'C', 'D', 'E'].includes(val) ? val : 'A';
        }
        base.jumlah_pasang = jps;
        base.jawaban = cleanMap;
      } else if (meta.kode === 'multiple_select') {
        const arr = Array.isArray(it?.jawaban)
          ? it.jawaban.map((v: any) => String(v).toUpperCase().slice(0, 1)).filter((v: string) => ['A', 'B', 'C', 'D', 'E'].includes(v))
          : [];
        base.jawaban = [...new Set(arr)].sort();
      } else if (meta.kode === 'short_answer') {
        base.panjang_jawaban = Math.max(3, Math.min(20, Number(it?.panjang_jawaban) || 10));
        base.jawaban = String(it?.jawaban || '').trim();
      } else if (meta.kode === 'essay') {
        base.jawaban = String(it?.jawaban || '').trim();
      } else if (meta.kode === 'true_false') {
        const tf = String(it?.jawaban || 'B').toUpperCase();
        base.jawaban = tf.startsWith('S') || tf.startsWith('F') ? 'S' : 'B';
      } else {
        const ch = String(it?.jawaban || 'A').toUpperCase().slice(0, 1);
        base.jawaban = meta.opsi.includes(ch as any) ? ch : 'A';
      }

      return base;
    });

    await logger.info('AI_EXTRACT_KUNCI', `Ekstrak AI menghasilkan ${sanitizedItems.length} butir`, authSession.id);
    return {
      success: true,
      data: {
        judul_saran: String(parsed?.judul_saran || '').trim(),
        items: sanitizedItems,
      },
    };
  } catch (e: any) {
    return { success: false, message: e.message || 'Gagal mengekstrak kunci dengan AI.' };
  }
}
