'use server';

import { dbGetAll } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { runAIWithConsensus } from '@/lib/ai/gemini-fallback';
import { hitungSkorV3, normalizeAIAnswer, normalizeTipe } from '@/lib/ai/grader-engine';
import { runHybridObjectiveScan } from '@/lib/scan/hybrid-detector';

/**
 * Hitung similarity antara dua string nama siswa (token & prefix aware).
 */
function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aNorm = a.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const bNorm = b.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;

  const aWords = aNorm.split(/\s+/).filter(Boolean);
  const bWords = bNorm.split(/\s+/).filter(Boolean);

  let matches = 0;
  for (const aw of aWords) {
    for (const bw of bWords) {
      if (aw === bw) {
        matches += 1;
        break;
      } else if (aw.length >= 3 && bw.length >= 3) {
        if (aw.startsWith(bw) || bw.startsWith(aw)) {
          matches += 0.85;
          break;
        } else if (aw.slice(0, 3) === bw.slice(0, 3)) {
          matches += 0.5;
          break;
        }
      }
    }
  }

  const maxWords = Math.max(aWords.length, bWords.length);
  return maxWords > 0 ? Math.min(1, matches / maxWords) : 0;
}

function normalizeInternalStudentId(raw?: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(SIS|USR)_/i.test(value)) return value;
  return '';
}

function isAnswerNonEmpty(ans: any): boolean {
  if (ans === undefined || ans === null) return false;
  if (typeof ans === 'string') {
    const t = ans.trim();
    return t !== '' && t !== '?' && t !== '—';
  }
  if (Array.isArray(ans)) return ans.length > 0;
  if (typeof ans === 'object') return Object.keys(ans).length > 0;
  return true;
}

/**
 * scanLJKAction
 * Menerima 1 gambar LJK (Base64), memindai QR & OMR lokal + Gemini Vision AI,
 * lalu mencocokkan hasilnya dengan kunci jawaban serta database siswa.
 */
export async function scanLJKAction(
  arg1: string | { imageBase64: string; mimeType: string; idKunci: string },
  mimeTypeArg?: string,
  idKunciArg?: string,
): Promise<{
  success: boolean;
  data?: {
    aiName: string;
    aiNis?: string;
    matchedSiswa?: { id_siswa: string; nama: string; nis: string; kelas: string } | null;
    matchScore: number;
    answers: any[];
    skorHitung: number;
    skorDetail: any;
    confidence: number;
    needReview: boolean;
    warning?: string;
    detectedKunciId?: string;
    detectedKunciJudul?: string;
    consensus?: boolean;
    entropy?: number;
  };
  message?: string;
}> {
  try {
    const imageBase64 = typeof arg1 === 'object' && arg1 !== null ? arg1.imageBase64 : arg1;
    const mimeType = typeof arg1 === 'object' && arg1 !== null ? arg1.mimeType : (mimeTypeArg || 'image/jpeg');
    const idKunci = typeof arg1 === 'object' && arg1 !== null ? arg1.idKunci : (idKunciArg || '');

    const authSession = await requireAuth();

    // 1. Ambil kunci dari DB
    const allKunci = await dbGetAll('KUNCI_JAWABAN', true);
    const kunciRow = allKunci.find(k => k.id_kunci === idKunci);
    if (!kunciRow) throw new Error('Kunci jawaban tidak ditemukan.');
    if (authSession.role !== 'ADMIN' && String(kunciRow.id_guru) !== String(authSession.id)) {
      throw new Error('Akses ditolak. Anda hanya dapat menganalisis LJK untuk kunci jawaban milik Anda sendiri.');
    }

    let data_json: any[] = [];
    let pengaturan_poin: Record<string, any> = {};
    try { data_json = typeof kunciRow.data_json === 'string' ? JSON.parse(kunciRow.data_json) : (kunciRow.data_json || []); } catch {}
    try { pengaturan_poin = typeof kunciRow.pengaturan_poin === 'string' ? JSON.parse(kunciRow.pengaturan_poin) : (kunciRow.pengaturan_poin || {}); } catch {}

    const kunciObj = { ...kunciRow, data_json, pengaturan_poin };
    const totalSoal = data_json.length;

    // 2. Susun blueprint per butir soal
    const questionBlueprint = data_json.map((item: any, idx: number) => ({
      no: Number(item.no || idx + 1),
      tipe: item.tipe || kunciObj.tipe_soal || 'single_choice',
      opsi: item.opsi || [],
      jumlah_pernyataan: item.jumlah_pernyataan,
      jumlah_pasang: item.jumlah_pasang,
      panjang_jawaban: item.panjang_jawaban,
    }));

    // Jalankan pembacaan QR lokal (Hybrid) dan Gemini Vision V6 secara PARALEL untuk kecepatan & akurasi maksimal
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    let aiFailureWarning = '';

    let [hybridResult, aiResult] = await Promise.all([
      runHybridObjectiveScan(imageBuffer, questionBlueprint, totalSoal),
      runAIWithConsensus(imageBase64, totalSoal, mimeType, questionBlueprint).catch((error: any) => {
        aiFailureWarning = `AI Vision kendala: ${error?.message || 'unknown error'}`;
        return null;
      }),
    ]);

    if (!hybridResult.success && !aiResult) {
      throw new Error(aiFailureWarning || 'Scanner gagal mengekstraksi LJK. Pastikan foto LJK terang dan seluruh sudut kertas terlihat.');
    }

    // 3. Cek apakah QR Code LJK merujuk ke Kunci Jawaban lain milik guru ini (Auto-Resolve Kunci via QR)
    let activeKunciRow = kunciRow;
    let activeDataJson: any[] = data_json;
    let activeKunciObj = kunciObj;
    let activeBlueprint = questionBlueprint;
    let autoSwitchedKunciNote = '';

    if (
      hybridResult.idKunci &&
      hybridResult.idKunci !== 'STD' &&
      !String(idKunci).startsWith(hybridResult.idKunci) &&
      !String(kunciRow.judul_ujian || '').startsWith(hybridResult.idKunci)
    ) {
      const qrMatchedRow = allKunci.find(k =>
        (String(k.id_kunci) === hybridResult.idKunci || String(k.id_kunci).startsWith(hybridResult.idKunci!)) &&
        (authSession.role === 'ADMIN' || String(k.id_guru) === String(authSession.id))
      );
      if (qrMatchedRow && qrMatchedRow.id_kunci !== kunciRow.id_kunci) {
        try {
          const qrJson = typeof qrMatchedRow.data_json === 'string' ? JSON.parse(qrMatchedRow.data_json) : (qrMatchedRow.data_json || []);
          const qrPoin = typeof qrMatchedRow.pengaturan_poin === 'string' ? JSON.parse(qrMatchedRow.pengaturan_poin) : (qrMatchedRow.pengaturan_poin || {});
          if (Array.isArray(qrJson) && qrJson.length > 0) {
            activeKunciRow = qrMatchedRow;
            activeDataJson = qrJson;
            activeKunciObj = { ...qrMatchedRow, data_json: qrJson, pengaturan_poin: qrPoin };
            activeBlueprint = qrJson.map((item: any, idx: number) => ({
              no: Number(item.no || idx + 1),
              tipe: item.tipe || activeKunciObj.tipe_soal || 'single_choice',
              opsi: item.opsi || [],
              jumlah_pernyataan: item.jumlah_pernyataan,
              jumlah_pasang: item.jumlah_pasang,
              panjang_jawaban: item.panjang_jawaban,
            }));
            autoSwitchedKunciNote = `ℹ️ QR Code LJK terdeteksi untuk ujian "${qrMatchedRow.judul_ujian}" — dinilai otomatis menggunakan kunci tersebut.`;

            // Re-scan memakai blueprint kunci yang cocok dengan QR agar jumlah soal & opsi (mis. PG-D vs JDH-1 A–J) 100% akurat!
            const [rescanHybrid, rescanAi] = await Promise.all([
              runHybridObjectiveScan(imageBuffer, activeBlueprint, activeDataJson.length),
              runAIWithConsensus(imageBase64, activeDataJson.length, mimeType, activeBlueprint).catch((error: any) => {
                aiFailureWarning = `AI Vision kendala: ${error?.message || 'unknown error'}`;
                return null;
              }),
            ]);
            if (rescanHybrid.success || rescanAi) {
              hybridResult = rescanHybrid;
              aiResult = rescanAi;
            }
          }
        } catch {}
      }
    }

    // 3b. Penggabungan Jawaban Cerdas:
    // Utamakan 100% hasil AI Vision V6 (karena tahan kemiringan kamera HP, bayangan, & variasi jumlah kolom cetak).
    // Gunakan OMR lokal hanya jika AI gagal total (offline/timeout).
    const kunciDataJson: any[] = activeDataJson;
    const hybridAnswerMap = new Map(
      (hybridResult.answers || []).map((answer) => [Number(answer.no), answer])
    );
    const aiAnswerMap = new Map(
      (Array.isArray(aiResult?.answers) ? aiResult.answers : []).map((answer: any) => [Number(answer.no), answer.ans])
    );

    const rawAnswers = activeBlueprint.map((question) => {
      const no = Number(question.no);
      const tipe = normalizeTipe(question.tipe || activeKunciObj.tipe_soal || 'single_choice');
      const hybridItem = hybridAnswerMap.get(no);
      const hybridAns = hybridItem?.ans;
      const hybridConf = Number(hybridItem?.confidence || 0);
      const aiAns = aiAnswerMap.get(no);

      let mergedAnswer: any = '?';

      // Untuk baris lebar Menjodohkan 1-ke-1 (6–12 bulatan A–J/L), jika OMR lokal terkalibrasi penuh
      // (4 sudut fiducial terkunci) dan keyakinan piksel sangat tinggi, prioritaskan OMR piksel-presisi
      // karena bebas risiko salah hitung indeks 10-12 bulatan pada Vision LLM.
      const useCalibratedWideOmr =
        tipe === 'matching_single' &&
        hybridResult.success &&
        hybridResult.isCalibrated &&
        hybridResult.confidenceScore >= 0.55 &&
        isAnswerNonEmpty(hybridAns) &&
        hybridConf >= 0.55;

      if (useCalibratedWideOmr) {
        mergedAnswer = hybridAns;
      } else if (aiResult) {
        if (isAnswerNonEmpty(aiAns)) {
          mergedAnswer = aiAns;
        } else if (
          hybridResult.success &&
          hybridResult.isCalibrated &&
          isAnswerNonEmpty(hybridAns) &&
          hybridConf >= 0.6
        ) {
          mergedAnswer = hybridAns;
        }
      } else if (isAnswerNonEmpty(hybridAns)) {
        mergedAnswer = hybridAns;
      }

      return {
        no,
        ans: mergedAnswer,
      };
    });

    const normAnswers = rawAnswers.map((ans: any) => {
      const kItem = kunciDataJson.find(k => Number(k.no) === Number(ans.no));
      const tipe = kItem?.tipe || activeKunciObj.tipe_soal || 'single_choice';
      return {
        no: ans.no,
        ans: normalizeAIAnswer(ans.ans, tipe),
      };
    });

    const skorDetail = hitungSkorV3(normAnswers, activeKunciObj);

    // 4. Auto-match siswa (Prioritas: 1. ID Siswa QR -> 2. NIS QR/AI -> 3. Fuzzy Nama dengan Prioritas Kelas Ujian)
    const [rawSiswa, allKelas] = await Promise.all([
      dbGetAll('SISWA', true),
      dbGetAll('KELAS', true),
    ]);
    let allSiswa = rawSiswa;
    const kelasMap: Record<string, string> = {};
    allKelas.forEach(k => { kelasMap[k.id_kelas] = k.nama_kelas; });

    if (authSession.role === 'GURU') {
      const tugas = await dbGetAll('TUGAS_GURU', true);
      const myTugas = tugas.filter(t => String(t.id_user) === String(authSession.id));
      const myKelasIds = new Set(myTugas.map(t => t.id_kelas));
      allSiswa = allSiswa.filter(s => myKelasIds.has(s.id_kelas));
    }

    let matchedSiswa: any = null;
    let matchScore = 0;

    // 4a. Cek ID Siswa dari QR atau AI
    const candidateIdSiswa =
      normalizeInternalStudentId(hybridResult.idSiswa) ||
      normalizeInternalStudentId(aiResult?.id_siswa);
    if (candidateIdSiswa) {
      const byId = allSiswa.find(s => String(s.id_siswa).trim() === candidateIdSiswa);
      if (byId) {
        matchedSiswa = byId;
        matchScore = 1.0;
      }
    }

    // 4b. Cek NIS dari QR atau AI
    const aiNis = hybridResult.nis || aiResult?.nis || '';
    const normalizedAiNis = String(aiNis || '').replace(/\D/g, '');
    if (!matchedSiswa && normalizedAiNis.length >= 3 && normalizedAiNis !== '0000' && normalizedAiNis !== '0') {
      const byExactNis = allSiswa.find((s) => String(s.nis || '').replace(/\D/g, '') === normalizedAiNis);
      const byContainedNis = !byExactNis
        ? allSiswa.find((s) => {
            const candidate = String(s.nis || '').replace(/\D/g, '');
            return candidate.length >= 4 && normalizedAiNis.length >= 4 && (candidate.endsWith(normalizedAiNis) || normalizedAiNis.endsWith(candidate));
          })
        : null;
      if (byExactNis || byContainedNis) {
        matchedSiswa = byExactNis || byContainedNis;
        matchScore = byExactNis ? 1 : 0.94;
      }
    }

    // 4c. Cek kemiripan Nama Siswa (dengan prioritas kelas pada kunci ujian)
    if (!matchedSiswa && aiResult?.name && aiResult.name !== 'SISWA_UNKNOWN') {
      let bestScore = 0;
      let bestSiswa: any = null;
      const targetKelasId = String(kunciRow.id_kelas || '').trim();

      for (const s of allSiswa) {
        let score = nameSimilarity(aiResult.name, s.nama || '');
        if (score >= 0.5 && targetKelasId && targetKelasId !== 'ALL' && String(s.id_kelas) === targetKelasId) {
          score = Math.min(1, score + 0.08);
        }
        if (score > bestScore) {
          bestScore = score;
          bestSiswa = s;
        }
      }
      if (bestScore >= 0.58) {
        matchedSiswa = bestSiswa;
        matchScore = bestScore;
      }
    }

    if (matchedSiswa) {
      matchedSiswa = {
        id_siswa: matchedSiswa.id_siswa,
        nama: matchedSiswa.nama,
        nis: matchedSiswa.nis,
        kelas: kelasMap[matchedSiswa.id_kelas] || matchedSiswa.id_kelas || '—',
      };
    }

    // 5. Hitung Confidence Gabungan & Peringatan
    const combinedConfidenceRaw = aiResult
      ? (aiResult.confidence_score || 0.85)
      : (hybridResult.confidenceScore || 0.85);
    const combinedConfidence = Math.round(Math.max(0, Math.min(1, combinedConfidenceRaw)) * 100);

    const qrKunciMismatch =
      !autoSwitchedKunciNote &&
      hybridResult.idKunci &&
      idKunci &&
      hybridResult.idKunci !== 'STD' &&
      !String(idKunci).startsWith(hybridResult.idKunci) &&
      !String(kunciRow.judul_ujian || '').startsWith(hybridResult.idKunci);

    const warningParts = [
      autoSwitchedKunciNote,
      qrKunciMismatch
        ? `⚠️ QR Code LJK ini tercetak untuk kode ujian berbeda (${hybridResult.idKunci}).`
        : '',
      aiResult ? '' : aiFailureWarning,
      aiResult?.warning,
    ].filter(Boolean);
    const warning = warningParts.length > 0 ? warningParts.join(' ') : undefined;

    const needReview =
      Boolean(qrKunciMismatch) ||
      Boolean(aiResult?.need_review) ||
      combinedConfidence < 70 ||
      !matchedSiswa;

    const detectedName =
      matchedSiswa?.nama && (!aiResult?.name || aiResult.name === 'SISWA_UNKNOWN')
        ? matchedSiswa.nama
        : (aiResult?.name && aiResult.name !== 'SISWA_UNKNOWN'
            ? aiResult.name
            : matchedSiswa?.nama || 'TIDAK TERBACA');

    await logger.info(
      'SCAN_LJK',
      `Scan selesai. Terbaca: "${detectedName}", Skor: ${skorDetail.skor}, Confidence: ${combinedConfidence}%, Siswa: ${matchedSiswa?.nama || 'BELUM DIPASANGKAN'}`,
      authSession.id
    );

    return {
      success: true,
      data: {
        aiName: detectedName,
        aiNis: aiNis || matchedSiswa?.nis || '',
        matchedSiswa,
        matchScore,
        answers: normAnswers,
        skorHitung: skorDetail.skor,
        skorDetail,
        confidence: combinedConfidence,
        needReview,
        warning,
        detectedKunciId: activeKunciRow.id_kunci,
        detectedKunciJudul: activeKunciRow.judul_ujian,
        consensus: aiResult?.consensus ?? true,
        entropy: aiResult?.entropy ?? 0,
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * batchSaveScanResultsAction
 * Menyimpan semua hasil scan yang sudah di-review ke database HASIL.
 */
export async function batchSaveScanResultsAction(
  resultsInput:
    | Array<{
        id_kunci: string;
        id_siswa: string;
        answers: any[];
        confidence_score: number;
        need_review: boolean;
      }>
    | {
        items: Array<{
          id_kunci: string;
          id_siswa: string;
          answers: any[];
          confidence_score: number;
          need_review: boolean;
        }>;
      }
): Promise<{ success: boolean; saved: number; message: string }> {
  try {
    const authSession = await requireAuth();
    const results = Array.isArray(resultsInput) ? resultsInput : (resultsInput?.items || []);
    if (!results || results.length === 0) {
      return { success: true, saved: 0, message: 'Tidak ada data untuk disimpan.' };
    }

    const { saveBatchHasilScanAction } = await import('@/lib/actions/hasil');
    const res = await saveBatchHasilScanAction(results, authSession.id);

    if (!res.success) throw new Error(res.message);
    return { success: true, saved: results.length, message: res.message || `${results.length} hasil disimpan.` };
  } catch (e: any) {
    return { success: false, saved: 0, message: e.message };
  }
}
