'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/logger';
import { buildEssayScoringPrompt, evaluateEssayWithRubricKeywords } from '@/lib/ai/grader-engine';
import { resolveApiKeyPool } from '@/lib/ai/gemini-fallback';
import { getSettingsAction } from '@/lib/actions/settings';
import { requireAuth } from '@/lib/session-server';

export interface EssayBatchGradingItem {
  no: number;
  studentAnswer: string;
  rubricOrKey?: string;
  maxPoin: number;
}

export interface EssayBatchGradingResultItem {
  no: number;
  score: number;
  maxPoin: number;
  feedback: string;
}

export async function automatedEssayScoringAction(
  studentAnswer: string,
  question: string,
  rubric: any,
  guruId?: string
) {
  try {
    const auth = await requireAuth().catch(() => null);
    const activeGuruId = guruId || auth?.id || 'SYSTEM';

    if (!studentAnswer || !rubric) {
      throw new Error('Data jawaban siswa atau pedoman rubrik tidak lengkap.');
    }

    const settingsRes = await getSettingsAction(true);
    const settings = (settingsRes.data || {}) as Record<string, string>;
    const keys = resolveApiKeyPool(settings);
    const genAI = new GoogleGenerativeAI(keys[0] || process.env.GEMINI_API_KEY || '');
    const modelName = settings?.['ai_model'] || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
    const prompt = buildEssayScoringPrompt(studentAnswer, question || 'Soal Uraian', rubric);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(cleaned);

    await logger.info(
      'AES_SCORING',
      `Penilaian esai otomatis berhasil. Skor: ${parsed.total_score}`,
      activeGuruId
    );

    return {
      success: true,
      data: parsed,
      message: 'Penilaian esai otomatis berhasil dilakukan.'
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * scoreStudentEssaysWithAIAction
 * Menilai satu atau beberapa butir jawaban esai siswa sekaligus menggunakan Gemini AI
 * berdasarkan pedoman jawaban/rubrik dan poin maksimal masing-masing butir soal.
 * Dilengkapi fallback otomatis ke evaluasi kata kunci rubrik jika koneksi AI terkendala.
 */
export async function scoreStudentEssaysWithAIAction(
  items: EssayBatchGradingItem[],
  examTitle: string = 'Ujian Sekolah'
): Promise<{
  success: boolean;
  data?: EssayBatchGradingResultItem[];
  message?: string;
}> {
  try {
    const auth = await requireAuth();
    const validItems = (items || []).filter(
      (it) => it && Number(it.no) > 0 && Number(it.maxPoin) > 0
    );

    if (validItems.length === 0) {
      return { success: false, message: 'Tidak ada butir soal esai untuk dinilai.' };
    }

    // Jika semua jawaban kosong, langsung kembalikan skor 0
    const nonEmptyItems = validItems.filter((it) => {
      const s = String(it.studentAnswer || '').trim();
      return s !== '' && s !== '?' && s !== '—';
    });

    if (nonEmptyItems.length === 0) {
      return {
        success: true,
        data: validItems.map((it) => ({
          no: it.no,
          score: 0,
          maxPoin: it.maxPoin,
          feedback: 'Jawaban esai kosong / belum diisi pada lembar LJK.',
        })),
        message: 'Seluruh jawaban esai kosong (0 poin).',
      };
    }

    const settingsRes = await getSettingsAction(true);
    const settings = (settingsRes.data || {}) as Record<string, string>;
    const keys = resolveApiKeyPool(settings);
    const modelName = settings?.['ai_model'] || 'gemini-2.5-flash';

    const prompt = `Anda adalah EVALUATOR AKADEMIK PROFESIONAL untuk ujian "${examTitle}".
Tugas Anda adalah menilai jawaban uraian/esai siswa secara objektif, adil, dan konstruktif untuk setiap nomor soal berikut:

${validItems
  .map(
    (it) => `--- SOAL ESAI NOMOR ${it.no} (POIN MAKSIMAL: ${it.maxPoin}) ---
PEDOMAN JAWABAN / RUBRIK GURU: "${it.rubricOrKey || 'Nilai berdasarkan ketepatan konsep, penalaran logis, dan kelengkapan argumen'}"
JAWABAN TERTULIS SISWA: "${it.studentAnswer || '(Kosong)'}"`
  )
  .join('\n\n')}

ATURAN PENILAIAN:
1. Jika jawaban siswa kosong, tidak relevan sama sekali, atau '?', berikan score: 0.
2. Jika jawaban siswa sebagian benar atau mendekati konsep pada pedoman jawaban, berikan poin parsial yang proporsional (antara 0 sampai maxPoin, boleh desimal 0.5).
3. Jika substansi jawaban siswa sesuai dengan pedoman jawaban/rubrik meskipun menggunakan kalimat sendiri (parafrase), berikan poin penuh (maxPoin).
4. Berikan feedback singkat (1 kalimat padat dalam Bahasa Indonesia).
5. Kembalikan HANYA objek JSON murni tanpa markdown/backtick dengan struktur berikut:
{
  "results": [
    { "no": 31, "score": 8, "feedback": "Konsep sangat tepat dan lengkap." }
  ]
}`;

    let aiResultsMap = new Map<number, { score: number; feedback: string }>();
    let usedFallback = false;

    try {
      const genAI = new GoogleGenerativeAI(keys[0] || process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
      const res = await model.generateContent(prompt);
      const rawText = res.response.text().trim();
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      const arr = Array.isArray(parsed?.results) ? parsed.results : Array.isArray(parsed) ? parsed : [];
      for (const row of arr) {
        const no = Number(row.no);
        if (no > 0) {
          aiResultsMap.set(no, {
            score: Number(row.score) || 0,
            feedback: String(row.feedback || 'Dinilai oleh AI Evaluator.'),
          });
        }
      }
    } catch {
      usedFallback = true;
    }

    const finalResults: EssayBatchGradingResultItem[] = validItems.map((it) => {
      const sAns = String(it.studentAnswer || '').trim();
      if (!sAns || sAns === '?' || sAns === '—') {
        return {
          no: it.no,
          score: 0,
          maxPoin: it.maxPoin,
          feedback: 'Jawaban kosong.',
        };
      }

      const fromAI = aiResultsMap.get(Number(it.no));
      if (fromAI && !usedFallback) {
        const clamped = Math.min(it.maxPoin, Math.max(0, Math.round(fromAI.score * 100) / 100));
        return {
          no: it.no,
          score: clamped,
          maxPoin: it.maxPoin,
          feedback: fromAI.feedback,
        };
      }

      // Fallback ke evaluasi kata kunci rubrik lokal
      const fallbackEval = evaluateEssayWithRubricKeywords(sAns, it.rubricOrKey || '', it.maxPoin);
      return {
        no: it.no,
        score: fallbackEval.score,
        maxPoin: it.maxPoin,
        feedback:
          fallbackEval.matchedKeywords.length > 0
            ? `Kata kunci cocok (${fallbackEval.matchedKeywords.length}/${fallbackEval.totalKeywords}): ${fallbackEval.matchedKeywords.join(', ')}`
            : 'Evaluasi rubrik otomatis selesai.',
      };
    });

    await logger.info(
      'AES_BATCH_SCORING',
      `Penilaian ${finalResults.length} soal esai selesai (${usedFallback ? 'Rubrik Lokal' : 'Gemini AI'}).`,
      auth.id
    );

    return {
      success: true,
      data: finalResults,
      message: usedFallback
        ? `Berhasil menilai ${finalResults.length} soal esai menggunakan pencocokan rubrik.`
        : `Berhasil menilai ${finalResults.length} soal esai dengan AI Gemini!`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
