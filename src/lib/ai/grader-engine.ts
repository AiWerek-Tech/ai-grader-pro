import { levenshteinSimilarity } from './similarityAlgorithms';

/**
 * Map legacy tipe_soal strings ke kode tipe AKM baru
 */
export function normalizeTipe(raw: string | undefined): string {
  if (!raw) return 'single_choice';
  const map: Record<string, string> = {
    'A-E': 'single_choice',
    'A-D': 'single_choice_4',
    'Benar-Salah': 'true_false',
    'PG_TUNGGAL': 'single_choice',
    'BENAR_SALAH': 'true_false',
    'PG_KOMPLEKS': 'multiple_select',
    'MTF': 'multiple_true_false',
    'MENJODOHKAN': 'matching',
    'ISIAN': 'short_answer',
    'ISIAN_SINGKAT': 'short_answer',
    'ESAI': 'essay',
    'URAIAN': 'essay',
  };
  return map[raw] ?? raw;
}

/**
 * normalizeAIAnswer — konversi berbagai format output AI ke format yang diharapkan grader
 * Contoh:
 *   'ABC'       → ['A','B','C']         (multiple_select)
 *   '1-A, 2-B'  → {1:'A', 2:'B'}        (matching)
 *   'Benar,Salah' → ['B','S']           (multiple_true_false)
 *   'B'/'S'/'Benar'/'Salah' → 'B'/'S'  (true_false)
 */
export function normalizeAIAnswer(rawAns: any, tipe: string): any {
  if (rawAns === null || rawAns === undefined || rawAns === '?' || rawAns === '') return rawAns;

  const normalized = normalizeTipe(tipe);

  // ── multiple_select: 'ABC' → ['A','B','C'] ──
  if (normalized === 'multiple_select') {
    if (Array.isArray(rawAns)) return rawAns.map((x: any) => String(x).trim().toUpperCase());
    const s = String(rawAns).trim().toUpperCase().replace(/[,\s]+/g, '');
    // format 'A,B,C' or 'ABC'
    if (s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean);
    // contiguous letters: 'ABC' → ['A','B','C']
    return s.split('').filter(c => /[A-E]/.test(c));
  }

  // ── multiple_true_false: 'B,S,B' or ['Benar','Salah'] → ['B','S','B'] ──
  if (normalized === 'multiple_true_false') {
    const arr = Array.isArray(rawAns) ? rawAns : String(rawAns).split(/[,;\s]+/);
    return arr.map((x: any) => {
      const s = String(x).trim().toLowerCase();
      if (s === 'b' || s.startsWith('benar') || s === 'true') return 'B';
      if (s === 's' || s.startsWith('salah') || s === 'false') return 'S';
      return String(x).trim().toUpperCase();
    });
  }

  // ── matching: '1-A, 2-C, 3-B' → {1:'A', 2:'C', 3:'B'} ──
  if (normalized === 'matching') {
    if (typeof rawAns === 'object' && !Array.isArray(rawAns)) return rawAns;
    const str = String(rawAns).trim();
    const result: Record<string, string> = {};
    // Pattern: '1-A' or '1: A' or '1→A'
    const matches = str.matchAll(/(\d+)\s*[-:→]\s*([A-Za-z])/g);
    for (const m of matches) {
      result[m[1]] = m[2].toUpperCase();
    }
    if (Object.keys(result).length > 0) return result;
    // Fallback: if it's an array like ['A','B','C'], create ordered map
    if (Array.isArray(rawAns)) {
      rawAns.forEach((v: any, i: number) => { result[String(i+1)] = String(v).toUpperCase(); });
      return result;
    }
    return rawAns;
  }

  // ── true_false: normalize 'Benar'/'Salah' → 'B'/'S' ──
  if (normalized === 'true_false') {
    const s = String(rawAns).trim().toLowerCase();
    if (s === 'b' || s.startsWith('benar') || s === 'true' || s === '1') return 'B';
    if (s === 's' || s.startsWith('salah') || s === 'false' || s === '0') return 'S';
    return String(rawAns).trim().toUpperCase();
  }

  // ── single_choice: always uppercase ──
  if (normalized === 'single_choice' || normalized === 'single_choice_4') {
    return String(rawAns).trim().toUpperCase().charAt(0);
  }

  return rawAns;
}

export function formatAnswerForDisplay(answer: any): string {
  if (answer === null || answer === undefined || answer === '') return '—';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') {
    return Object.entries(answer).map(([k, v]) => `${k}→${v}`).join(', ');
  }
  return String(answer);
}

function cleanShortAnswerText(raw: any): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
    .replace(/\s+/g, ' ');
}

/**
 * matchShortAnswer — Pencocokan Isian Singkat Pintar (Opsi C)
 * - Mendukung multi-kunci yang dipisahkan dengan tanda '|' atau ';' (misal: "Soekarno | Ir. Soekarno | Bung Karno")
 * - Case-insensitive & mengabaikan tanda baca/spasi berlebih
 * - Toleransi typo OCR ringan (Levenshtein >= 0.84) untuk kata >= 5 huruf (bukan angka murni)
 */
export function matchShortAnswer(studentAnswer: any, keyAnswer: any): boolean {
  const sClean = cleanShortAnswerText(studentAnswer);
  if (!sClean || sClean === '?') return false;

  const rawVariants = Array.isArray(keyAnswer)
    ? keyAnswer.map((v) => String(v))
    : String(keyAnswer ?? '').split(/[|;]+/);

  const variants = rawVariants.map(cleanShortAnswerText).filter(Boolean);
  if (variants.length === 0) return false;

  const isNumericStudent = /^\d+([.,]\d+)?$/.test(sClean);

  for (const vClean of variants) {
    if (sClean === vClean) return true;

    const isNumericKey = /^\d+([.,]\d+)?$/.test(vClean);
    // Hanya izinkan fuzzy match untuk teks non-angka dengan panjang >= 5 karakter
    if (!isNumericStudent && !isNumericKey && vClean.length >= 5 && sClean.length >= 4) {
      const sim = levenshteinSimilarity(sClean, vClean);
      if (sim >= 0.84) return true;
    }
  }

  return false;
}

const INDONESIAN_STOPWORDS = new Set([
  'yang', 'dari', 'untuk', 'dalam', 'pada', 'adalah', 'dengan', 'atau', 'karena',
  'sebagai', 'oleh', 'tidak', 'bisa', 'dapat', 'akan', 'juga', 'serta', 'antara',
  'ketika', 'sehingga', 'merupakan', 'tersebut', 'yaitu', 'yakni', 'agar', 'supaya',
]);

/**
 * evaluateEssayWithRubricKeywords — Evaluasi heuristik kata kunci/rubrik untuk Esai (Opsi A)
 * Menghitung kecocokan konsep utama antara jawaban tertulis siswa dengan pedoman jawaban/rubrik guru.
 */
export function evaluateEssayWithRubricKeywords(
  studentAnswer: any,
  rubricText: any,
  maxPoin: number
): { score: number; matchedKeywords: string[]; totalKeywords: number; ratio: number } {
  const sRaw = String(studentAnswer ?? '').trim();
  const rRaw = String(rubricText ?? '').trim();
  if (!sRaw || sRaw === '?' || sRaw === '—' || !rRaw) {
    return { score: 0, matchedKeywords: [], totalKeywords: 0, ratio: 0 };
  }

  const sNorm = sRaw.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const sWords = sNorm.split(' ').filter(Boolean);

  // Pisahkan berdasarkan delimiter eksplisit (|, ;, koma) jika ada, atau ekstrak kata kunci penting
  const explicitPhrases = rRaw
    .split(/[|;,]+/)
    .map((p) => p.trim().toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 3);

  let keywords: string[] = [];
  if (explicitPhrases.length >= 2 && explicitPhrases.every((p) => p.split(' ').length <= 4)) {
    keywords = explicitPhrases;
  } else {
    keywords = Array.from(
      new Set(
        rRaw
          .toLowerCase()
          .replace(/[^a-z0-9\s]/gi, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !INDONESIAN_STOPWORDS.has(w))
      )
    );
  }

  if (keywords.length === 0) {
    const sim = levenshteinSimilarity(sNorm, rRaw.toLowerCase().trim());
    const score = Math.round(sim * maxPoin * 2) / 2;
    return { score: Math.min(maxPoin, Math.max(0, score)), matchedKeywords: [], totalKeywords: 1, ratio: sim };
  }

  const matchedKeywords: string[] = [];
  for (const kw of keywords) {
    if (sNorm.includes(kw)) {
      matchedKeywords.push(kw);
      continue;
    }
    // Cek fuzzy per kata jika kata kunci tunggal >= 5 huruf
    if (!kw.includes(' ') && kw.length >= 5) {
      const fuzzyHit = sWords.some((sw) => sw.length >= 4 && levenshteinSimilarity(sw, kw) >= 0.82);
      if (fuzzyHit) matchedKeywords.push(kw);
    }
  }

  const ratio = Math.min(1, matchedKeywords.length / keywords.length);
  // Bulatkan ke 0.5 terdekat
  const rawScore = Math.round(ratio * maxPoin * 2) / 2;
  return {
    score: Math.min(maxPoin, Math.max(0, rawScore)),
    matchedKeywords,
    totalKeywords: keywords.length,
    ratio,
  };
}

export function answersMatch(studentAnswer: any, keyAnswer: any, tipe: string): boolean {
  const normalizedType = normalizeTipe(tipe);
  const normalizedStudent = normalizeAIAnswer(studentAnswer, normalizedType);
  const normalizedKey = normalizeAIAnswer(keyAnswer, normalizedType);

  switch (normalizedType) {
    case 'single_choice':
    case 'single_choice_4':
    case 'true_false':
      return String(normalizedStudent ?? '').toUpperCase() === String(normalizedKey ?? '').toUpperCase();

    case 'multiple_select': {
      const studentValues = (Array.isArray(normalizedStudent) ? normalizedStudent : [normalizedStudent])
        .map((value: any) => String(value).toUpperCase())
        .filter(Boolean)
        .sort();
      const keyValues = (Array.isArray(normalizedKey) ? normalizedKey : [normalizedKey])
        .map((value: any) => String(value).toUpperCase())
        .filter(Boolean)
        .sort();
      return studentValues.join(',') === keyValues.join(',');
    }

    case 'multiple_true_false': {
      const studentValues = (Array.isArray(normalizedStudent) ? normalizedStudent : [normalizedStudent])
        .map((value: any) => String(value).toUpperCase());
      const keyValues = (Array.isArray(normalizedKey) ? normalizedKey : [normalizedKey])
        .map((value: any) => String(value).toUpperCase());
      return studentValues.length === keyValues.length && keyValues.every((value, index) => value === studentValues[index]);
    }

    case 'matching': {
      const studentEntries = typeof normalizedStudent === 'object' && normalizedStudent !== null && !Array.isArray(normalizedStudent)
        ? Object.entries(normalizedStudent).sort(([a], [b]) => a.localeCompare(b))
        : [];
      const keyEntries = typeof normalizedKey === 'object' && normalizedKey !== null && !Array.isArray(normalizedKey)
        ? Object.entries(normalizedKey).sort(([a], [b]) => a.localeCompare(b))
        : [];
      return studentEntries.length > 0 &&
        studentEntries.length === keyEntries.length &&
        studentEntries.every(([left, right], index) => {
          const [keyLeft, keyRight] = keyEntries[index];
          return left === keyLeft && String(right).toUpperCase() === String(keyRight).toUpperCase();
        });
    }

    case 'short_answer':
      return matchShortAnswer(normalizedStudent, normalizedKey);

    case 'essay':
      return false;

    default:
      return String(normalizedStudent ?? '').trim().toUpperCase() === String(normalizedKey ?? '').trim().toUpperCase();
  }
}

/**
 * hitungSkorV3 — AKM-Aware Scoring Engine (V4 Hybrid: Objektif + Isian Singkat + Esai Terpadu)
 * Mendukung 7 tipe soal: single_choice, single_choice_4, true_false,
 * multiple_select, multiple_true_false, matching, short_answer, essay.
 * Mendukung:
 * - Bobot poin per butir soal (`kItem.poin` atau `pengaturan_poin[no]`)
 * - Multi-kunci & fuzzy typo tolerance pada Isian Singkat (Opsi C)
 * - Penilaian Esai Otomatis berbasis Rubrik/AI (Opsi A) & Penilaian Esai Per-Butir Manual/Kertas Terpisah (Opsi B)
 */
export function hitungSkorV3(jawabanSiswa: any[], kunciObj: any) {
  // globalTipe sebagai fallback jika per-butir tidak punya `tipe`
  const rawGlobalTipe = kunciObj.tipe_soal || 'single_choice';
  const globalTipe = normalizeTipe(rawGlobalTipe);

  const bobot = kunciObj.pengaturan_poin || {};
  const arrKunci: any[] = kunciObj.data_json || [];

  const totalSoal = arrKunci.length;
  let benarCount = 0;
  let salahCount = 0;
  let kosongCount = 0;
  let maxPoin = 0;
  let poinSiswa = 0;
  let maxPoinObjektif = 0;
  let poinObjektif = 0;
  let maxPoinEsai = 0;
  let poinEsai = 0;
  let manualCount = 0;
  let essayCount = 0;
  let essayGradedCount = 0;

  // Map jawaban siswa { no → answer, poin_manual, ai_feedback }
  const mapSiswa: Record<string, any> = {};
  const mapPoinManual: Record<string, number | undefined> = {};
  const mapFeedback: Record<string, string | undefined> = {};

  (jawabanSiswa || []).forEach((item: any) => {
    const key = String(item.no);
    mapSiswa[key] = item.ans ?? item.jawaban;
    if (item.poin_manual !== undefined && item.poin_manual !== null && item.poin_manual !== '' && !isNaN(Number(item.poin_manual))) {
      mapPoinManual[key] = Number(item.poin_manual);
    }
    if (item.ai_feedback) {
      mapFeedback[key] = String(item.ai_feedback);
    }
  });

  const detail: any[] = [];

  for (let i = 0; i < arrKunci.length; i++) {
    const kItem = arrKunci[i];
    const noStr = String(kItem.no ?? i + 1);

    // ── Baca kunci jawaban (format baru: jawaban; format lama: ans) ──
    const ansKunci = kItem.jawaban ?? kItem.ans;

    // ── Tipe soal per butir (AKM baru atau fallback global) ──
    const tipe = normalizeTipe(kItem.tipe) || globalTipe;

    // ── Poin per soal (prioritas: kItem.poin -> pengaturan_poin[no] -> default tipe) ──
    const defaultTipePoin = tipe === 'essay' ? (bobot.esai ?? bobot.benar ?? 1) : (bobot.benar ?? 1);
    let poin = parseFloat(kItem.poin ?? bobot[noStr] ?? defaultTipePoin);
    if (isNaN(poin) || !isFinite(poin) || poin <= 0) poin = 1;

    let ansSiswa = mapSiswa[noStr];

    // ── AI Answer Normalization sebelum scoring ──
    if (ansSiswa !== null && ansSiswa !== undefined) {
      ansSiswa = normalizeAIAnswer(ansSiswa, tipe);
    }

    const isKosong =
      ansSiswa === null ||
      ansSiswa === undefined ||
      ansSiswa === '' ||
      ansSiswa === '?' ||
      ansSiswa === '—' ||
      (Array.isArray(ansSiswa) && ansSiswa.length === 0);

    // ── Penanganan Khusus Soal Uraian / Esai (Opsi A & Opsi B) ──
    if (tipe === 'essay') {
      essayCount++;
      maxPoin += poin;
      maxPoinEsai += poin;

      const hasManualScore = mapPoinManual[noStr] !== undefined;
      if (hasManualScore) {
        // Esai sudah dinilai oleh Guru atau AI Essay Grader
        const pDidapat = Math.min(poin, Math.max(0, Number(mapPoinManual[noStr])));
        poinSiswa += pDidapat;
        poinEsai += pDidapat;
        essayGradedCount++;
        if (pDidapat >= poin * 0.5) benarCount++;
        else salahCount++;

        detail.push({
          no: parseInt(noStr, 10),
          tipe,
          kunci: ansKunci,
          jawaban: ansSiswa ?? null,
          status: 'dinilai',
          poin_didapat: pDidapat,
          poin_max: poin,
          poin_manual: pDidapat,
          ai_feedback: mapFeedback[noStr] || undefined,
        });
        continue;
      }

      // Jika belum dinilai manual, tetapi ada teks jawaban di LJK (Opsi A) DAN guru mengisi pedoman jawaban/rubrik
      const hasRubricKey = ansKunci !== null && ansKunci !== undefined && String(ansKunci).trim() !== '';
      if (!isKosong && hasRubricKey) {
        const autoEval = evaluateEssayWithRubricKeywords(ansSiswa, ansKunci, poin);
        poinSiswa += autoEval.score;
        poinEsai += autoEval.score;
        essayGradedCount++;
        manualCount++; // Tetap tandai perlu review guru
        if (autoEval.score >= poin * 0.5) benarCount++;
        else salahCount++;

        detail.push({
          no: parseInt(noStr, 10),
          tipe,
          kunci: ansKunci,
          jawaban: ansSiswa ?? null,
          status: 'dinilai',
          is_auto_essay: true,
          poin_didapat: autoEval.score,
          poin_max: poin,
          poin_manual: autoEval.score,
          ai_feedback:
            mapFeedback[noStr] ||
            (autoEval.matchedKeywords.length > 0
              ? `Kata kunci cocok (${autoEval.matchedKeywords.length}/${autoEval.totalKeywords}): ${autoEval.matchedKeywords.join(', ')}`
              : 'Dinilai otomatis dari kemiripan rubrik (klik untuk sesuaikan poin)'),
        });
        continue;
      }

      // Jika kosong di LJK atau dikerjakan di kertas terpisah (Opsi B — menunggu input poin guru)
      manualCount++;
      detail.push({
        no: parseInt(noStr, 10),
        tipe,
        kunci: ansKunci,
        jawaban: ansSiswa ?? null,
        status: 'manual',
        poin_didapat: 0,
        poin_max: poin,
        ai_feedback: mapFeedback[noStr] || undefined,
      });
      continue;
    }

    maxPoin += poin;
    maxPoinObjektif += poin;

    let isBenar = false;
    let poinDidapat = 0;

    if (isKosong) {
      kosongCount++;
    } else {
      switch (tipe) {
        // ── Pilihan Ganda tunggal (A-E, A-D) dan Benar/Salah ──
        case 'single_choice':
        case 'single_choice_4':
        case 'true_false': {
          const sJawab = Array.isArray(ansSiswa)
            ? String(ansSiswa[0]).toUpperCase()
            : String(ansSiswa).toUpperCase();
          const kJawab = String(ansKunci ?? '').toUpperCase();
          if (sJawab === kJawab) { isBenar = true; poinDidapat = poin; }
          break;
        }

        // ── Pilihan Ganda Kompleks: semua pilihan harus tepat ──
        case 'multiple_select': {
          const kArr: string[] = (Array.isArray(ansKunci)
            ? ansKunci
            : [String(ansKunci)]
          ).map((x: any) => String(x).toUpperCase()).sort();
          const sArr: string[] = (Array.isArray(ansSiswa)
            ? ansSiswa
            : [String(ansSiswa)]
          ).map((x: any) => String(x).toUpperCase()).sort();
          if (kArr.join(',') === sArr.join(',')) { isBenar = true; poinDidapat = poin; }
          break;
        }

        // ── Benar-Salah Majemuk (MTF): setiap pernyataan harus benar ──
        case 'multiple_true_false': {
          const kMTF: string[] = Array.isArray(ansKunci)
            ? ansKunci.map((x: any) => String(x).toUpperCase())
            : [String(ansKunci).toUpperCase()];
          const sMTF: string[] = Array.isArray(ansSiswa)
            ? ansSiswa.map((x: any) => String(x).toUpperCase())
            : [String(ansSiswa).toUpperCase()];
          // Semua elemen harus cocok (posisi-based)
          if (kMTF.length === sMTF.length && kMTF.every((k, idx) => k === sMTF[idx])) {
            isBenar = true; poinDidapat = poin;
          }
          break;
        }

        // ── Menjodohkan: setiap pasangan harus tepat ──
        case 'matching': {
          const kMap: Record<string, string> =
            typeof ansKunci === 'object' && !Array.isArray(ansKunci)
              ? ansKunci
              : {};
          const sMap: Record<string, string> =
            typeof ansSiswa === 'object' && !Array.isArray(ansSiswa)
              ? ansSiswa
              : {};
          const kEntries = Object.entries(kMap).sort(([a], [b]) => a.localeCompare(b));
          const sEntries = Object.entries(sMap).sort(([a], [b]) => a.localeCompare(b));
          const kStr = kEntries.map(([k, v]) => `${k}:${String(v).toUpperCase()}`).join(',');
          const sStr = sEntries.map(([k, v]) => `${k}:${String(v).toUpperCase()}`).join(',');
          if (kStr === sStr && kEntries.length > 0) { isBenar = true; poinDidapat = poin; }
          break;
        }

        // ── Isian Singkat: multi-kunci & fuzzy typo tolerance (Opsi C) ──
        case 'short_answer': {
          if (matchShortAnswer(ansSiswa, ansKunci)) {
            isBenar = true;
            poinDidapat = poin;
          }
          break;
        }

        // ── Fallback: string comparison ──
        default: {
          const sJawab = Array.isArray(ansSiswa)
            ? String(ansSiswa[0]).toUpperCase()
            : String(ansSiswa).toUpperCase();
          const kJawab = String(ansKunci ?? '').toUpperCase();
          if (sJawab === kJawab) { isBenar = true; poinDidapat = poin; }
        }
      }

      if (isBenar) {
        benarCount++;
        poinSiswa += poinDidapat;
        poinObjektif += poinDidapat;
      } else {
        salahCount++;
      }
    }

    detail.push({
      no: parseInt(noStr, 10),
      tipe,
      kunci: ansKunci,
      jawaban: ansSiswa ?? null,
      status: isKosong ? 'tidak_dijawab' : (isBenar ? 'benar' : 'salah'),
      poin_didapat: poinDidapat,
      poin_max: poin
    });
  }

  const skorAkhir = maxPoin > 0
    ? Math.min(100, Math.max(0, Math.round((poinSiswa / maxPoin) * 100)))
    : 0;

  const skorObjektif = maxPoinObjektif > 0
    ? Math.min(100, Math.max(0, Math.round((poinObjektif / maxPoinObjektif) * 100)))
    : 0;

  return {
    skor: skorAkhir,
    skor_objektif: skorObjektif,
    poin_didapat: Math.round(poinSiswa * 100) / 100,
    poin_maksimal: Math.round(maxPoin * 100) / 100,
    poin_objektif: Math.round(poinObjektif * 100) / 100,
    poin_maksimal_objektif: Math.round(maxPoinObjektif * 100) / 100,
    poin_esai: Math.round(poinEsai * 100) / 100,
    poin_maksimal_esai: Math.round(maxPoinEsai * 100) / 100,
    benar: benarCount,
    salah: salahCount,
    tidak_dijawab: kosongCount,
    total_soal: totalSoal,
    total_soal_esai: essayCount,
    total_esai_dinilai: essayGradedCount,
    total_soal_manual: manualCount,
    total_soal_otomatis: totalSoal - essayCount,
    perlu_penilaian_manual: manualCount > 0,
    detail,
  };
}


/**
 * calculateIRTAnalysis (V3)
 * Implementasi dasar Item Response Theory untuk analisis tingkat kesulitan soal.
 * Memisahkan tingkat kesulitan soal dari kemampuan siswa.
 */
export function calculateIRTAnalysis(allHasil: any[]) {
  if (!allHasil || allHasil.length === 0) return [];

  const totalSiswa = allHasil.length;
  const detailHasil = allHasil.map(h => {
    try {
      return typeof h.detail_json === 'string' ? JSON.parse(h.detail_json) : h.detail_json;
    } catch { return null; }
  }).filter(Boolean);

  if (detailHasil.length === 0) return [];

  const totalSoal = detailHasil[0].total_soal;
  const analysis = [];

  for (let i = 1; i <= totalSoal; i++) {
    let benar = 0;
    detailHasil.forEach(d => {
      const soal = d.detail.find((s: any) => s.no === i);
      if (soal && soal.status === 'benar') benar++;
    });

    // Indeks Kesulitan Klasik (CTT)
    const pValue = benar / totalSiswa;
    
    // Estimasi IRT 1-PL (Rasch Model) Sederhana
    // b = log((1-p)/p)
    let difficultyIRT = 0;
    if (pValue > 0 && pValue < 1) {
      difficultyIRT = Math.log((1 - pValue) / pValue);
    } else if (pValue === 0) {
      difficultyIRT = 3.0; // Sangat Sulit
    } else {
      difficultyIRT = -3.0; // Sangat Mudah
    }

    analysis.push({
      no: i,
      benar,
      salah: totalSiswa - benar,
      ctt_difficulty: pValue.toFixed(2),
      irt_difficulty: difficultyIRT.toFixed(2),
      category: pValue > 0.7 ? 'Mudah' : (pValue < 0.3 ? 'Sulit' : 'Sedang')
    });
  }

  return analysis;
}

/**
 * buildEssayScoringPrompt (V2)
 */
export function buildEssayScoringPrompt(studentAnswer: string, question: string, rubric: any) {
  return `
Anda adalah EVALUATOR AKADEMIK PROFESIONAL. Tugas Anda adalah menilai jawaban esai siswa secara objektif.

PERTANYAAN:
"${question}"

JAWABAN SISWA:
"${studentAnswer}"

RUBRIK PENILAIAN:
${JSON.stringify(rubric, null, 2)}

INSTRUKSI PENILAIAN:
1. Analisis relevansi konten terhadap pertanyaan.
2. Gunakan rubrik yang disediakan untuk memberikan poin pada tiap kriteria.
3. Berikan umpan balik (feedback) konstruktif untuk siswa.
4. Output harus dalam format JSON murni.

FORMAT OUTPUT JSON:
{
  "total_score": 85,
  "criteria_scores": [
    { "name": "Relevansi", "score": 40, "max": 40, "feedback": "Sangat relevan." },
    { "name": "Struktur", "score": 20, "max": 20, "feedback": "Logis." },
    { "name": "Terminologi", "score": 25, "max": 40, "feedback": "Beberapa istilah kurang tepat." }
  ],
  "overall_feedback": "Jawaban yang bagus, namun perlu pendalaman pada aspek teknis."
}
`;
}
