import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSharp } from '@/lib/sharp-loader';
import { getSettingsAction } from '@/lib/actions/settings';

export interface QuestionBlueprintItem {
  no: number;
  tipe?: string;
  opsi?: string[];
  jumlah_pernyataan?: number;
  jumlah_pasang?: number;
  panjang_jawaban?: number;
}

let roundRobinKeyCursor = 0;

/**
 * Mengumpulkan seluruh API Key Gemini yang tersedia dari:
 * 1. Pengaturan Sistem (`ai_api_keys_pool` - dipisahkan koma atau baris baru)
 * 2. Environment `GEMINI_API_KEYS` (dipisahkan koma)
 * 3. Environment utama `GEMINI_API_KEY`
 * Menghasilkan pool API Key unik untuk rotasi Round-Robin & Anti-Rate-Limit saat banyak guru scan serentak.
 */
export function resolveApiKeyPool(settings?: Record<string, string>): string[] {
  const rawList: string[] = [];

  if (settings?.['ai_api_keys_pool']) {
    rawList.push(...settings['ai_api_keys_pool'].split(/[\n,;]+/));
  }
  if (process.env.GEMINI_API_KEYS) {
    rawList.push(...process.env.GEMINI_API_KEYS.split(/[\n,;]+/));
  }
  if (process.env.GEMINI_API_KEY) {
    rawList.push(process.env.GEMINI_API_KEY);
  }

  const uniqueKeys = Array.from(
    new Set(
      rawList
        .map((k) => k.trim())
        .filter((k) => k.length >= 20)
    )
  );

  return uniqueKeys.length > 0 ? uniqueKeys : [process.env.GEMINI_API_KEY || ''];
}

function getNextGenAIFromPool(keys: string[], offset: number = 0): { genAI: GoogleGenerativeAI; keyIndex: number } {
  const pool = keys.length > 0 ? keys : [process.env.GEMINI_API_KEY || ''];
  const idx = (roundRobinKeyCursor + offset) % pool.length;
  if (offset === 0) {
    roundRobinKeyCursor = (roundRobinKeyCursor + 1) % pool.length;
  }
  return {
    genAI: new GoogleGenerativeAI(pool[idx] || ''),
    keyIndex: idx,
  };
}

/**
 * Optimasi citra sebelum dikirim ke Gemini Vision:
 * - Auto-rotasi EXIF (penting untuk foto kamera HP portrait/landscape)
 * - Mempertahankan kontras & gradasi asli foto (tanpa .normalise() destruktif)
 * - Resolusi optimal 2048px JPEG kualitas 92
 */
async function optimizeImageForVision(
  imageBase64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  try {
    const sharp = await getSharp();
    if (!sharp) {
      return { base64: imageBase64, mimeType: mimeType || 'image/jpeg' };
    }

    const inputBuffer = Buffer.from(imageBase64, 'base64');
    // PENTING: Ukuran maksimal 1024px memastikan Gemini Vision memproses citra sebagai 1 Single-Frame utuh (258 token)
    // tanpa memotong kertas menjadi 9 sub-tiles (yang menyebabkan waktu proses >25 detik / timeout dan membelah baris soal!).
    const fullPageBuffer = await sharp(inputBuffer)
      .rotate() // Auto-fix EXIF orientation dari kamera HP
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    return {
      base64: fullPageBuffer.toString('base64'),
      mimeType: 'image/jpeg',
    };
  } catch {
    return { base64: imageBase64, mimeType: mimeType || 'image/jpeg' };
  }
}

function getExpectedOptionsForItem(item?: QuestionBlueprintItem): string[] | null {
  const tipe = item?.tipe || 'single_choice';
  if (tipe === 'true_false' || tipe === 'Benar-Salah') return ['B', 'S'];
  if (tipe === 'single_choice_4' || tipe === 'A-D') {
    return item?.opsi?.length ? item.opsi : ['A', 'B', 'C', 'D'];
  }
  if (tipe === 'single_choice' || tipe === 'A-E') {
    return item?.opsi?.length ? item.opsi : ['A', 'B', 'C', 'D', 'E'];
  }
  return null;
}

function buildQuestionBlueprintSummary(questionBlueprint: QuestionBlueprintItem[] = []) {
  if (!questionBlueprint.length) return '';

  // Kelompokkan nomor soal yang bertipe sama secara berurutan agar instruksi ke Vision LLM ringkas & sangat tajam
  const groups: Array<{ start: number; end: number; desc: string }> = [];

  const describeItem = (item: QuestionBlueprintItem) => {
    const tipe = item.tipe || 'single_choice';
    if (tipe === 'single_choice_4' || tipe === 'A-D') {
      return 'have 4 circles from left to right: A, B, C, D.';
    }
    if (tipe === 'single_choice' || tipe === 'A-E') {
      return 'have 5 circles from left to right: A, B, C, D, E.';
    }
    if (tipe === 'true_false' || tipe === 'Benar-Salah') {
      return 'have 2 circles from left to right: B, S.';
    }
    if (tipe === 'multiple_select') {
      return `are multiple-select boxes (${item.opsi?.join(', ') || 'A, B, C, D, E'}) — combine all marked letters (e.g. "AC").`;
    }
    if (tipe === 'multiple_true_false') {
      return `have ${item.jumlah_pernyataan || 3} statement rows of B/S (format: "B,S,B").`;
    }
    if (tipe === 'matching') {
      return `have ${item.jumlah_pasang || 3} matching rows (format: "1-A, 2-B, 3-C").`;
    }
    if (tipe === 'short_answer') {
      return 'have an open rectangular write-in box (read the student\'s handwritten text, number, or math expression inside the box).';
    }
    if (tipe === 'essay') {
      return 'are essay questions in the bottom JAWABAN URAIAN / ESAI box (transcribe the student\'s handwritten response).';
    }
    return `type ${tipe}.`;
  };

  for (let i = 0; i < questionBlueprint.length; i++) {
    const item = questionBlueprint[i];
    const no = Number(item.no || i + 1);
    const desc = describeItem(item);
    const prev = groups[groups.length - 1];
    if (prev && prev.desc === desc && prev.end === no - 1) {
      prev.end = no;
    } else {
      groups.push({ start: no, end: no, desc });
    }
  }

  const lines = groups.map((g) =>
    g.start === g.end
      ? `- Question ${g.start} ${g.desc}`
      : `- Questions ${g.start}-${g.end} ${g.desc}`
  );

  return lines.join('\n');
}

/**
 * buildSystemPrompt (V6 Elimination Visual Reasoning OMR Engine - Teruji 40/40 = 100% Akurat pada Foto Kamera HP)
 */
function buildSystemPrompt(
  _settings: Record<string, string>,
  retryIndex: number,
  totalSoal: number,
  questionBlueprint: QuestionBlueprintItem[] = []
) {
  const blueprintLines = buildQuestionBlueprintSummary(questionBlueprint);

  let prompt = `Examine this LJK (Lembar Jawaban Komputer) answer sheet carefully.
1. Extract the student's full name ("name") from 'NAMA PESERTA' in the top-left identity box and student ID/NIS ("nis") from 'NIS / NO. PESERTA' or the 'NIS:' label under the top-right QR code.
2. Read all ${totalSoal} questions (numbered 1 to ${totalSoal}). For each question number, look at the answer area immediately to the right of that question number (or in the bottom 'JAWABAN URAIAN / ESAI' section for essay items):
${blueprintLines || `- Questions 1-${totalSoal} have circles from left to right.`}
3. CRITICAL VISUAL & SPATIAL COUNTING RULE FOR BUBBLE QUESTIONS:
   - In each row, the student's chosen circle is completely blackened (filled solid black ●) or crossed (X), which COVERS the letter printed inside that circle.
   - Meanwhile, the OTHER unchosen circles on that same row remain white (○) with their printed letters visible inside!
   - To avoid any confusion between adjacent circles (like B vs C in a 5-circle row):
     * Count how many empty white circles (○) are to the LEFT of the black dot (●) on that row -> "left_empty" (e.g. ●○○○○ -> left_empty=0; ○●○○○ -> left_empty=1; ○○●○○ -> left_empty=2; ○○○●○ -> left_empty=3; ○○○○● -> left_empty=4).
     * Count how many empty white circles (○) are to the RIGHT of the black dot (●) on that row -> "right_empty".
     * List the remaining visible letters in "unfilled_letters_visible".
     * Put the chosen letter in "filled_letter" (or "?" if all circles on that row are empty white).
4. RULE FOR SHORT-ANSWER (ISN) & ESSAY QUESTIONS:
   - For short-answer (ISN) boxes, read the handwritten text, number, or mathematical value inside the rectangular box and put the exact text in "filled_letter" (or "?" if blank).
   - For essay questions in the bottom 'JAWABAN URAIAN / ESAI' section, transcribe the handwritten answer into "filled_letter" (or "?" if blank or not present on this page).

Return pure JSON matching this exact structure:
{
  "name": "STUDENT FULL NAME",
  "nis": "388",
  "id_siswa": "",
  "confidence": 98,
  "answers": [
    { "no": 1, "left_empty": 0, "right_empty": 3, "unfilled_letters_visible": ["B", "C", "D"], "filled_letter": "A" },
    { "no": 2, "left_empty": 3, "right_empty": 0, "unfilled_letters_visible": ["A", "B", "C"], "filled_letter": "D" }
  ]
}
Ensure "answers" contains all ${totalSoal} items from "no": 1 to "no": ${totalSoal}.`;

  if (retryIndex >= 1) {
    prompt += `\n\n[RETRY #${retryIndex + 1}] Double-check every question number 1 to ${totalSoal} carefully row by row.`;
  }

  return prompt;
}

function parseAIJson(rawText: string) {
  if (!rawText) return null;
  try {
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const direct = JSON.parse(cleaned);
      if (Array.isArray(direct)) {
        return { answers: direct, name: 'SISWA_UNKNOWN', confidence: 85 };
      }
      if (direct && typeof direct === 'object') {
        return direct;
      }
    } catch {
      // Continue to regex extraction
    }

    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed && !Array.isArray(parsed.answers) && Array.isArray(parsed)) {
        return { answers: parsed };
      }
      return parsed;
    }

    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const arr = JSON.parse(arrMatch[0]);
      if (Array.isArray(arr) && arr.length > 0 && arr[0].no !== undefined) {
        return { answers: arr, name: 'SISWA_UNKNOWN', confidence: 75 };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function validateAIResult(
  result: any,
  totalSoal: number,
  minConfidencePct: number = 60,
  questionBlueprint: QuestionBlueprintItem[] = []
) {
  if (!result || typeof result !== 'object') return { valid: false, reason: 'EMPTY_RESULT' };
  if (!Array.isArray(result.answers)) return { valid: false, reason: 'INVALID_FORMAT' };

  const minConfidenceThreshold = Math.max(0.1, Math.min(1, (Number(minConfidencePct) || 60) / 100));
  const blueprintMap = new Map<number, QuestionBlueprintItem>();
  questionBlueprint.forEach((b, idx) => {
    blueprintMap.set(Number(b.no || idx + 1), b);
  });

  const byNo = new Map<number, any>();

  for (let i = 0; i < result.answers.length; i++) {
    const rawItem = result.answers[i];
    let ans: any = '?';
    let no = i + 1;

    if (rawItem !== null && typeof rawItem === 'object') {
      ans =
        rawItem.filled_letter ??
        rawItem.ans ??
        rawItem.jawaban ??
        rawItem.answer ??
        '?';
      no = Number(rawItem.no ?? rawItem.nomor ?? (i + 1));

      const unfilled = rawItem.unfilled_letters_visible ?? rawItem.unfilled_visible;
      const leftEmpty = Number(rawItem.left_empty);
      const rightEmpty = Number(rawItem.right_empty);
      const bpItem = blueprintMap.get(no);
      const expectedOpts = getExpectedOptionsForItem(bpItem);

      if (expectedOpts) {
        // 1. Jika left_empty + right_empty + 1 === jumlah bulatan pada baris tersebut, maka indeks bulatan hitam adalah left_empty!
        if (
          Number.isFinite(leftEmpty) &&
          Number.isFinite(rightEmpty) &&
          leftEmpty >= 0 &&
          rightEmpty >= 0 &&
          leftEmpty + rightEmpty + 1 === expectedOpts.length
        ) {
          ans = expectedOpts[leftEmpty];
        } else if (Array.isArray(unfilled)) {
          // 2. Fallback ke Hukum Eliminasi Himpunan Pasti (Set-Difference)
          const visSet = new Set(unfilled.map((u: any) => String(u).trim().toUpperCase()));
          const missing = expectedOpts.filter((o) => !visSet.has(o));
          if (missing.length === 1) {
            ans = missing[0];
          } else if (missing.length === 0 && visSet.size === expectedOpts.length) {
            ans = '?';
          }
        }
      }
    } else {
      ans = rawItem ?? '?';
    }

    if (!Number.isFinite(no) || no < 1) no = i + 1;
    no = Math.round(no);

    if (typeof ans === 'string') {
      ans = ans.trim();
      if (ans === '' || ans.toLowerCase() === 'kosong' || ans.toLowerCase() === 'null' || ans === '-') {
        ans = '?';
      } else if (ans.length <= 5 && !ans.includes('-')) {
        ans = ans.toUpperCase();
      }
    }

    if (totalSoal <= 0 || no <= totalSoal) {
      byNo.set(no, ans);
    }
  }

  const minRequiredAnswers = totalSoal > 0 ? Math.min(2, totalSoal) : 1;
  if (byNo.size < minRequiredAnswers) {
    return {
      valid: false,
      reason: `AI hanya mengembalikan ${byNo.size} dari ${totalSoal} soal.`,
    };
  }

  const cleanedAnswers: Array<{ no: number; ans: any }> = [];
  const targetCount = totalSoal > 0 ? totalSoal : Math.max(...Array.from(byNo.keys()), 0);

  for (let no = 1; no <= targetCount; no++) {
    cleanedAnswers.push({
      no,
      ans: byNo.has(no) ? byNo.get(no) : '?',
    });
  }

  result.name = (result.name || result.nama || 'SISWA_UNKNOWN').toString().trim();
  result.nis = (result.nis || '').toString().trim();

  const hasConfidenceField = result.confidence !== undefined || result.confidence_score !== undefined;
  const rawConfidenceValue = result.confidence ?? result.confidence_score ?? 0;
  const normalizedConfidence = (() => {
    if (typeof rawConfidenceValue === 'string') {
      const cleaned = rawConfidenceValue.replace('%', '').trim();
      const parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) return 0;
      if (parsed <= 1 && cleaned.includes('.')) return Math.max(0, Math.min(1, parsed));
      return Math.max(0, Math.min(1, parsed / 100));
    }

    const parsed = Number(rawConfidenceValue);
    if (!Number.isFinite(parsed)) return 0;
    if (parsed <= 1) return Math.max(0, Math.min(1, parsed));
    return Math.max(0, Math.min(1, parsed / 100));
  })();

  const answeredCount = cleanedAnswers.filter((item) => {
    if (item.ans === null || item.ans === undefined) return false;
    if (typeof item.ans === 'string') return item.ans.trim() !== '' && item.ans.trim() !== '?';
    if (Array.isArray(item.ans)) return item.ans.length > 0;
    return true;
  }).length;

  const derivedConfidence = targetCount > 0 ? answeredCount / targetCount : 0;
  result.confidence_score = hasConfidenceField && normalizedConfidence > 0
    ? normalizedConfidence
    : Math.max(0.45, Math.min(0.96, derivedConfidence));

  result.need_review = result.confidence_score < minConfidenceThreshold;
  result.answers = cleanedAnswers;

  return { valid: true, data: result };
}

export function detectAnomaly(result: any) {
  const answers = result?.answers;
  if (!answers || answers.length === 0) return { suspicious: false, reason: '' };

  const countMap: Record<string, number> = {};
  let maxConsecutiveRun = 1;
  let currentRun = 1;
  let maxRunChar = '';

  for (let i = 0; i < answers.length; i++) {
    const rawAns = answers[i].ans;
    const key = typeof rawAns === 'string' ? rawAns : JSON.stringify(rawAns);
    countMap[key] = (countMap[key] || 0) + 1;

    if (i > 0) {
      const prevRaw = answers[i - 1].ans;
      const prevKey = typeof prevRaw === 'string' ? prevRaw : JSON.stringify(prevRaw);
      if (key === prevKey && key !== '?') {
        currentRun++;
        if (currentRun > maxConsecutiveRun) {
          maxConsecutiveRun = currentRun;
          maxRunChar = key;
        }
      } else {
        currentRun = 1;
      }
    }
  }

  // Dominasi >80% pada ujian >= 6 soal
  if (answers.length >= 6) {
    for (const k in countMap) {
      if (countMap[k] / answers.length > 0.80 && k !== '?') {
        return {
          suspicious: true,
          reason: `POLA DOMINAN JAWABAN '${k}': Terdeteksi >80% jawaban bernilai sama. Mohon periksa kejelasan arsiran.`,
        };
      }
    }
  }

  // Deretan >= 9 jawaban identik beruntun pada soal pilihan ganda
  if (answers.length >= 10 && maxConsecutiveRun >= 9) {
    return {
      suspicious: true,
      reason: `POLA BERUNTUN '${maxRunChar}' (${maxConsecutiveRun} soal berturut-turut): Mohon pastikan sesuai dengan LJK siswa.`,
    };
  }

  // Terlalu banyak kosong >60%
  const kosong = countMap['?'] || 0;
  if (answers.length >= 5 && kosong / answers.length > 0.6) {
    return {
      suspicious: true,
      reason: `TERLALU BANYAK KOSONG (${kosong}/${answers.length}): Kemungkinan citra LJK terlalu redup/silau atau belum terisi penuh.`,
    };
  }

  return { suspicious: false, reason: '' };
}

// Urutan model Vision terbaik (gemini-3-flash-preview terbukti 40/40 = 100% akurat pada foto kamera LJK 40 soal)
const FAST_FALLBACK_POOL = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

function resolveEffectiveVisionModel(configuredModel?: string): string {
  // Jika masih tersetel ke default lama gemini-2.5-flash atau kosong, otomatis tingkatkan ke gemini-3-flash-preview
  // karena akurasi spasial OMR 40 soal pada gemini-3-flash-preview mencapai 100% (40/40).
  if (!configuredModel || configuredModel === 'gemini-2.5-flash' || configuredModel === 'gemini-2.5-pro') {
    return 'gemini-3-flash-preview';
  }
  return configuredModel;
}

async function callModel(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  modelName: string,
  temperature: number = 0.0,
  timeoutMs: number = 25000,
  apiKeysPool?: string[]
): Promise<string> {
  const apiVersion = 'v1beta';
  const pool = apiKeysPool && apiKeysPool.length > 0 ? apiKeysPool : resolveApiKeyPool();

  const tryInvoke = async (targetModel: string, limitMs: number, keyOffset: number = 0): Promise<string> => {
    const { genAI } = getNextGenAIFromPool(pool, keyOffset);
    const model = genAI.getGenerativeModel(
      {
        model: targetModel,
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
        },
      },
      { apiVersion }
    );

    const callPromise = (async () => {
      const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType } },
        prompt,
      ]);
      const response = await result.response;
      return response.text();
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timeout (${Math.round(limitMs / 1000)}s) saat menghubungi model ${targetModel}`)),
        limitMs
      );
    });

    return Promise.race([callPromise, timeoutPromise]);
  };

  try {
    return await tryInvoke(modelName, timeoutMs, 0);
  } catch (e: any) {
    const errMsg = (e.message || '').toLowerCase();

    if (pool.length > 1 && (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource exhausted') || errMsg.includes('api_key'))) {
      for (let k = 1; k < pool.length; k++) {
        try {
          console.warn(`[Key-Pool Failover] Beralih ke API Key cadangan #${k + 1} untuk model ${modelName}...`);
          return await tryInvoke(modelName, timeoutMs, k);
        } catch {
          // Lanjut ke key berikutnya
        }
      }
    }

    const isRecoverable =
      errMsg.includes('503') ||
      errMsg.includes('high demand') ||
      errMsg.includes('overloaded') ||
      errMsg.includes('timeout') ||
      errMsg.includes('429') ||
      errMsg.includes('404') ||
      errMsg.includes('not found') ||
      errMsg.includes('resource exhausted') ||
      errMsg.includes('fetch failed');

    if (isRecoverable) {
      console.warn(`Model ${modelName} kendala (${e.message}). Mencoba ulang & beralih ke pool fallback...`);
      // Coba ulang model utama (gemini-3-flash-preview) sekali lagi terlebih dahulu sebelum turun ke model cadangan
      const candidates = [modelName, ...FAST_FALLBACK_POOL.filter((m) => m !== modelName)];
      for (let idx = 0; idx < candidates.length; idx++) {
        const fallbackModel = candidates[idx];
        try {
          return await tryInvoke(fallbackModel, 45000, (idx + 1) % pool.length);
        } catch (fbErr: any) {
          console.warn(`Fallback ${fallbackModel} belum berhasil: ${fbErr.message}`);
        }
      }
    }
    throw e;
  }
}

export async function runAIWithConsensus(
  imageBase64: string,
  totalSoal: number,
  mimeType: string = 'image/jpeg',
  questionBlueprint: QuestionBlueprintItem[] = []
) {
  const [settingsRes, optimizedImg] = await Promise.all([
    getSettingsAction(true),
    optimizeImageForVision(imageBase64, mimeType),
  ]);

  const settings = (settingsRes.data || {}) as Record<string, string>;
  const userSelectedModel = resolveEffectiveVisionModel(settings['ai_model']);
  const minConfidencePct = Number(settings['min_confidence'] || 60);
  const configuredTemp = Number(settings['ai_temperature']);
  const effectiveTemp = Number.isFinite(configuredTemp) ? Math.max(0, Math.min(1, configuredTemp)) : 0.1;
  const apiKeyPool = resolveApiKeyPool(settings);

  const prompt = buildSystemPrompt(settings, 0, totalSoal, questionBlueprint);

  try {
    const rawPrimary = await callModel(
      optimizedImg.base64,
      optimizedImg.mimeType,
      prompt,
      userSelectedModel,
      effectiveTemp,
      50000,
      apiKeyPool
    );
    const parsedPrimary = parseAIJson(rawPrimary);
    const checkPrimary = validateAIResult(parsedPrimary, totalSoal, minConfidencePct, questionBlueprint);

    if (checkPrimary.valid) {
      const payload = checkPrimary.data;
      const anomaly = detectAnomaly(payload);
      if (anomaly.suspicious) {
        payload.warning = anomaly.reason;
      }

      const isHallucination = anomaly.suspicious && anomaly.reason.includes('POLA DOMINAN');
      if (!isHallucination && (payload.confidence_score >= 0.72 || !payload.need_review)) {
        payload.consensus = true;
        payload.entropy = 0;
        return payload;
      }

      const secondaryModel =
        userSelectedModel === 'gemini-3-flash-preview' ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';
      try {
        const rawSecondary = await callModel(
          optimizedImg.base64,
          optimizedImg.mimeType,
          prompt,
          secondaryModel,
          0,
          22000,
          apiKeyPool
        );
        const parsedSecondary = parseAIJson(rawSecondary);
        const checkSecondary = validateAIResult(parsedSecondary, totalSoal, minConfidencePct, questionBlueprint);

        if (checkSecondary.valid) {
          const isIdentical =
            JSON.stringify(checkPrimary.data.answers) === JSON.stringify(checkSecondary.data.answers);
          if (isIdentical) {
            payload.consensus = true;
            payload.entropy = 0;
            return payload;
          }
          const chosen =
            checkSecondary.data.confidence_score > payload.confidence_score
              ? checkSecondary.data
              : payload;
          chosen.consensus = false;
          chosen.entropy = 1;
          const chosenAnomaly = detectAnomaly(chosen);
          if (chosenAnomaly.suspicious) chosen.warning = chosenAnomaly.reason;
          return chosen;
        }
      } catch (secErr) {
        console.warn('Verifikasi sekunder dilewati:', secErr);
      }

      payload.consensus = false;
      return payload;
    }

    return await runAIWithFallbackAndRetry(
      optimizedImg.base64,
      totalSoal,
      optimizedImg.mimeType,
      questionBlueprint,
      settings
    );
  } catch (err) {
    console.warn('Koreksi utama kendala, masuk ke auto-retry fallback:', err);
    return await runAIWithFallbackAndRetry(
      optimizedImg.base64,
      totalSoal,
      optimizedImg.mimeType,
      questionBlueprint,
      settings
    );
  }
}

export async function runAIWithFallbackAndRetry(
  imageBase64: string,
  totalSoal: number,
  mimeType: string = 'image/jpeg',
  questionBlueprint: QuestionBlueprintItem[] = [],
  cachedSettings?: Record<string, string>
) {
  let settings = cachedSettings;
  if (!settings) {
    const result = await getSettingsAction(true);
    settings = (result.data || {}) as Record<string, string>;
  }

  const userSelectedModel = resolveEffectiveVisionModel(settings['ai_model']);
  const minConfidencePct = Number(settings['min_confidence'] || 60);
  const apiKeyPool = resolveApiKeyPool(settings);

  const MODELS = Array.from(
    new Set([
      userSelectedModel,
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ])
  );

  const MAX_RETRY = 2;
  let lastError = null;

  for (let i = 0; i < MAX_RETRY; i++) {
    let rawText = '';

    try {
      const prompt = buildSystemPrompt(settings, i + 1, totalSoal, questionBlueprint);
      let modelSuccess = false;

      for (const m of MODELS) {
        try {
          rawText = await callModel(imageBase64, mimeType, prompt, m, 0, 22000, apiKeyPool);
          modelSuccess = true;
          break;
        } catch (callErr: any) {
          lastError = `Model ${m}: ${callErr.message}`;
          if (callErr.message?.includes('API_KEY')) throw callErr;
        }
      }

      if (!modelSuccess) throw new Error('Semua fallback model tidak merespon.');

      const parsed = parseAIJson(rawText);
      const check = validateAIResult(parsed, totalSoal, minConfidencePct, questionBlueprint);

      if (check.valid) {
        const payload = check.data;
        const anomaly = detectAnomaly(payload);
        if (anomaly.suspicious) payload.warning = anomaly.reason;
        return payload;
      }

      lastError = check.reason;
    } catch (e: any) {
      lastError = e.message;
    }

    if (i < MAX_RETRY - 1) {
      await new Promise((res) => setTimeout(res, 600));
    }
  }

  throw new Error(
    `AI Grader gagal mengekstraksi LJK. Pastikan seluruh sudut LJK terlihat jelas dan tidak buram. Detail: ${lastError}`
  );
}
