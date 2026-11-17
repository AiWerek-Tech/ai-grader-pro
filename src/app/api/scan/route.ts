import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData, assertSessionSecretConfigured, sessionOptions } from "@/lib/session";
import { dbGetAll } from "@/lib/google-sheets";
import { runAIWithConsensus } from '@/lib/ai/gemini-fallback';
import { runHybridObjectiveScan } from '@/lib/scan/hybrid-detector';

function normalizeScanQuestionType(raw?: string) {
  const map: Record<string, string> = {
    'A-E': 'single_choice',
    'A-D': 'single_choice_4',
    'Benar-Salah': 'true_false',
    'BENAR_SALAH': 'true_false',
    'PG_TUNGGAL': 'single_choice',
    'PG_KOMPLEKS': 'multiple_select',
    MTF: 'multiple_true_false',
    MENJODOHKAN: 'matching',
    ISIAN: 'short_answer',
    'ISIAN_SINGKAT': 'short_answer',
    ESAI: 'essay',
    URAIAN: 'essay',
  };

  return map[raw || ''] || raw || 'single_choice';
}

function normalizeInternalStudentId(raw?: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(SIS|USR)_/i.test(value)) return value;
  return '';
}

export async function POST(request: Request) {
  try {
    // Authentication check
    const cookieStore = await cookies();
    assertSessionSecretConfigured();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    
    if (!session.isLoggedIn) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.imageBase64) {
      return NextResponse.json({ success: false, message: 'Citra LJK basis64 kosng atau rusak.' }, { status: 400 });
    }

    const totalSoal = parseInt(body.totalSoal, 10) || 50;
    const mimeType = body.mimeType || 'image/jpeg';

    const questionBlueprint = Array.isArray(body.questionBlueprint) ? body.questionBlueprint : [];
    const objectiveQuestionTypes = new Set([
      'single_choice',
      'single_choice_4',
      'true_false',
      'multiple_select',
      'multiple_true_false',
      'matching',
    ]);
    const textQuestionTypes = new Set(['short_answer', 'essay']);

    let aiFailureWarning = '';
    const [hybridResult, aiResult] = await Promise.all([
      runHybridObjectiveScan(
        Buffer.from(body.imageBase64, 'base64'),
        questionBlueprint,
        totalSoal
      ),
      runAIWithConsensus(body.imageBase64, totalSoal, mimeType, questionBlueprint).catch((error: any) => {
        aiFailureWarning = `AI fallback gagal: ${error?.message || 'unknown error'}`;
        return null;
      }),
    ]);

    if (!hybridResult.success && !aiResult) {
      return NextResponse.json(
        { success: false, message: aiFailureWarning || 'Scanner lokal dan AI sama-sama gagal membaca LJK.' },
        { status: 503 }
      );
    }

    const hybridAnswerMap = new Map(
      (hybridResult.answers || []).map((answer) => [Number(answer.no), answer])
    );
    const aiAnswerMap = new Map(
      (Array.isArray(aiResult?.answers) ? aiResult.answers : []).map((answer: any) => [Number(answer.no), answer.ans])
    );
    const isNonEmpty = (ans: any) => {
      if (ans === undefined || ans === null) return false;
      if (typeof ans === 'string') return ans.trim() !== '' && ans.trim() !== '?';
      if (Array.isArray(ans)) return ans.length > 0;
      if (typeof ans === 'object') return Object.keys(ans).length > 0;
      return true;
    };

    const mergedAnswers = (questionBlueprint.length > 0
      ? questionBlueprint.map((question: any, index: number) => {
          const no = Number(question?.no || index + 1);
          const hybridItem = hybridAnswerMap.get(no);
          const hybridAnswer = hybridItem?.ans;
          const aiAnswer = aiAnswerMap.get(no);

          let chosen: any = '?';
          if (aiResult) {
            if (isNonEmpty(aiAnswer)) {
              chosen = aiAnswer;
            }
          } else if (isNonEmpty(hybridAnswer)) {
            chosen = hybridAnswer;
          }

          return {
            no,
            ans: chosen,
          };
        })
      : (aiResult?.answers || hybridResult.answers || []));

    const confidenceScore = aiResult
      ? Math.max(0, Math.min(1, aiResult.confidence_score || 0.92))
      : Math.max(0, Math.min(1, hybridResult.confidenceScore || 0));

    const warningParts = [
      aiResult ? '' : aiFailureWarning,
      aiResult?.warning,
    ].filter(Boolean);

    let resolvedName = aiResult?.name || 'TIDAK TERBACA';
    const resolvedNis = hybridResult.nis || aiResult?.nis || '';
    if ((!resolvedName || resolvedName === 'TIDAK TERBACA' || resolvedName === 'SISWA_UNKNOWN') && resolvedNis) {
      let siswaRows = await dbGetAll('SISWA', true);
      if (session.role === 'GURU') {
        const tugas = await dbGetAll('TUGAS_GURU', true);
        const myKelasIds = new Set(
          tugas
            .filter((item) => String(item.id_user) === String(session.id))
            .map((item) => item.id_kelas)
        );
        siswaRows = siswaRows.filter((item) => myKelasIds.has(item.id_kelas));
      }

      const normalizedNis = String(resolvedNis).replace(/\D/g, '');
      const matchedSiswa = siswaRows.find((item) => String(item.nis || '').replace(/\D/g, '') === normalizedNis);
      if (matchedSiswa?.nama) resolvedName = matchedSiswa.nama;
    }

    return NextResponse.json({
      success: true,
      message: 'Hybrid scanner berhasil membaca LJK',
      data: {
        ...(aiResult || {}),
        nis: resolvedNis,
        id_siswa: normalizeInternalStudentId(hybridResult.idSiswa || aiResult?.id_siswa),
        name: resolvedName,
        answers: mergedAnswers,
        confidence_score: confidenceScore,
        need_review: Boolean(aiResult?.need_review) || confidenceScore < 0.70,
        warning: warningParts.length > 0 ? warningParts.join(' ') : undefined,
        consensus: aiResult?.consensus ?? true,
        entropy: aiResult?.entropy ?? 0,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
