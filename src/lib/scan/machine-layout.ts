export type MachineQuestionType =
  | 'single_choice'
  | 'single_choice_4'
  | 'true_false'
  | 'multiple_select'
  | 'multiple_true_false'
  | 'matching'
  | 'matching_single'
  | 'short_answer'
  | 'essay';

export interface MachineQuestionInput {
  no: number;
  tipe?: string;
  opsi?: string[];
  jumlah_pernyataan?: number;
  jumlah_pasang?: number;
  panjang_jawaban?: number;
}

export interface MachineCell {
  id: string;
  value: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'circle' | 'square';
  labelX?: number;
  labelY?: number;
  rowKey?: string;
}

export interface MachineQuestionLayout {
  no: number;
  type: MachineQuestionType;
  short: string;
  x: number;
  y: number;
  w: number;
  h: number;
  headerWidth: number;
  columnIndex: number;
  cells: MachineCell[];
  answerBox?: { x: number; y: number; w: number; h: number };
  textBoxes?: Array<{ x: number; y: number; w: number; h: number; index: number }>;
  rowHeaders?: Array<{ text: string; x: number; y: number }>;
  colHeaders?: Array<{ text: string; x: number; y: number }>;
}

export type MachineLayoutDensity = 'spacious' | 'normal' | 'compact' | 'ultra';

export interface MachinePageLayout {
  templateVersion: 2;
  page: { width: number; height: number };
  columns: number;
  density: MachineLayoutDensity;
  objectiveArea: { x: number; y: number; w: number; h: number };
  essayArea: { x: number; y: number; w: number; h: number } | null;
  questions: MachineQuestionLayout[];
  maxQuestionBottom: number;
}

export const MACHINE_PAGE_SIZE = { width: 1000, height: 1414 } as const;

// Ruang jawaban diperluas dari y=338 hingga y=1380 karena QR dipindah ke atas & footer bawah dihapus
const OBJECTIVE_TOP = 338;
const CONTENT_BOTTOM = 1380;
const AREA_X = 44;
const AREA_W = 912;
const INNER_PAD_X = 16;
const INNER_PAD_TOP = 8;
const INNER_PAD_BOTTOM = 8;

interface DensitySpec {
  density: MachineLayoutDensity;
  columns: number;
  columnGap: number;
  blockGap: number;
  headerWidth: number;
  simpleHeight: number;
  mtfBaseHeight: number;
  mtfRowHeight: number;
  matchingBaseHeight: number;
  matchingRowHeight: number;
  bubbleMaxCircle: number;
  bubbleMaxSquare: number;
  matrixBubbleSize: number;
}

const DENSITY_CANDIDATES: DensitySpec[] = [
  {
    density: 'spacious',
    columns: 1,
    columnGap: 0,
    blockGap: 8,
    headerWidth: 52,
    simpleHeight: 48,
    mtfBaseHeight: 40,
    mtfRowHeight: 26,
    matchingBaseHeight: 42,
    matchingRowHeight: 26,
    bubbleMaxCircle: 22,
    bubbleMaxSquare: 20,
    matrixBubbleSize: 18,
  },
  {
    density: 'spacious',
    columns: 2,
    columnGap: 28,
    blockGap: 6,
    headerWidth: 44,
    simpleHeight: 38,
    mtfBaseHeight: 32,
    mtfRowHeight: 21,
    matchingBaseHeight: 34,
    matchingRowHeight: 21,
    bubbleMaxCircle: 20,
    bubbleMaxSquare: 18,
    matrixBubbleSize: 15,
  },
  {
    density: 'normal',
    columns: 2,
    columnGap: 22,
    blockGap: 5,
    headerWidth: 42,
    simpleHeight: 32,
    mtfBaseHeight: 26,
    mtfRowHeight: 18,
    matchingBaseHeight: 28,
    matchingRowHeight: 18,
    bubbleMaxCircle: 18,
    bubbleMaxSquare: 16,
    matrixBubbleSize: 14,
  },
  {
    density: 'compact',
    columns: 2,
    columnGap: 18,
    blockGap: 3,
    headerWidth: 40,
    simpleHeight: 24,
    mtfBaseHeight: 22,
    mtfRowHeight: 15,
    matchingBaseHeight: 23,
    matchingRowHeight: 15,
    bubbleMaxCircle: 16,
    bubbleMaxSquare: 15,
    matrixBubbleSize: 13,
  },
  {
    density: 'normal',
    columns: 3,
    columnGap: 18,
    blockGap: 5,
    headerWidth: 46,
    simpleHeight: 34,
    mtfBaseHeight: 26,
    mtfRowHeight: 18,
    matchingBaseHeight: 28,
    matchingRowHeight: 18,
    bubbleMaxCircle: 18,
    bubbleMaxSquare: 16,
    matrixBubbleSize: 14,
  },
  {
    density: 'compact',
    columns: 3,
    columnGap: 16,
    blockGap: 4,
    headerWidth: 44,
    simpleHeight: 28,
    mtfBaseHeight: 24,
    mtfRowHeight: 16,
    matchingBaseHeight: 25,
    matchingRowHeight: 16,
    bubbleMaxCircle: 16,
    bubbleMaxSquare: 15,
    matrixBubbleSize: 13,
  },
  {
    density: 'compact',
    columns: 3,
    columnGap: 14,
    blockGap: 3,
    headerWidth: 42,
    simpleHeight: 23,
    mtfBaseHeight: 20,
    mtfRowHeight: 14,
    matchingBaseHeight: 21,
    matchingRowHeight: 14,
    bubbleMaxCircle: 15,
    bubbleMaxSquare: 14,
    matrixBubbleSize: 12,
  },
  {
    density: 'ultra',
    columns: 4,
    columnGap: 12,
    blockGap: 3,
    headerWidth: 40,
    simpleHeight: 22,
    mtfBaseHeight: 19,
    mtfRowHeight: 13,
    matchingBaseHeight: 20,
    matchingRowHeight: 13,
    bubbleMaxCircle: 14,
    bubbleMaxSquare: 13,
    matrixBubbleSize: 11,
  },
];

function normalizeType(raw?: string): MachineQuestionType {
  const map: Record<string, MachineQuestionType> = {
    'A-E': 'single_choice',
    'A-D': 'single_choice_4',
    'Benar-Salah': 'true_false',
    BENAR_SALAH: 'true_false',
    PG_TUNGGAL: 'single_choice',
    PG_KOMPLEKS: 'multiple_select',
    MTF: 'multiple_true_false',
    MENJODOHKAN: 'matching',
    'JDH-1': 'matching_single',
    JDH1: 'matching_single',
    MENJODOHKAN_TUNGGAL: 'matching_single',
    ISIAN: 'short_answer',
    ISIAN_SINGKAT: 'short_answer',
    ESAI: 'essay',
    URAIAN: 'essay',
  };
  return map[raw || ''] || (raw as MachineQuestionType) || 'single_choice';
}

export function getMachineQuestionOptions(question: MachineQuestionInput): string[] {
  const type = normalizeType(question.tipe);
  if (question.opsi && question.opsi.length > 0) return [...question.opsi];
  if (type === 'single_choice_4') return ['A', 'B', 'C', 'D'];
  if (type === 'true_false') return ['B', 'S'];
  if (type === 'matching_single') return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  return ['A', 'B', 'C', 'D', 'E'];
}

function getShortLabel(type: MachineQuestionType) {
  const map: Record<MachineQuestionType, string> = {
    single_choice: 'PG',
    single_choice_4: 'PG',
    true_false: 'B/S',
    multiple_select: 'PGK',
    multiple_true_false: 'MTF',
    matching: 'JDH',
    matching_single: 'JDH',
    short_answer: 'ISN',
    essay: 'ESI',
  };
  return map[type];
}

function getBaseBlockHeight(question: MachineQuestionInput, spec: DensitySpec) {
  const type = normalizeType(question.tipe);
  if (type === 'multiple_true_false') {
    return spec.mtfBaseHeight + (question.jumlah_pernyataan || 3) * spec.mtfRowHeight;
  }
  if (type === 'matching') {
    return spec.matchingBaseHeight + (question.jumlah_pasang || 3) * spec.matchingRowHeight;
  }
  if (type === 'essay') return 0;
  return spec.simpleHeight;
}

function buildSimpleChoiceCells(
  options: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  square: boolean,
  spec: DensitySpec,
  maxChoiceWidth?: number,
  customHeaderWidth?: number
): MachineCell[] {
  const effectiveHeaderWidth = customHeaderWidth ?? spec.headerWidth;
  const areaX = x + effectiveHeaderWidth;
  const availableWidth = Math.max(40, w - effectiveHeaderWidth - 6);
  const isWideRow = options.length >= 6;
  const choiceWidth = isWideRow ? availableWidth : Math.min(maxChoiceWidth || availableWidth, availableWidth);
  const startX = isWideRow ? areaX + 4 : areaX + Math.max(0, (availableWidth - choiceWidth) * 0.35);
  const slotWidth = choiceWidth / Math.max(options.length, 1);
  const maxBubble = square ? spec.bubbleMaxSquare : spec.bubbleMaxCircle;
  const dynamicMaxBubble = h >= 56 ? maxBubble + 2 : maxBubble;
  const slotRatio = isWideRow ? 0.68 : 0.5;
  const bubbleSize = Math.max(11, Math.min(dynamicMaxBubble, Math.floor(slotWidth * slotRatio), h - 6));
  const bubbleY = y + Math.round((h - bubbleSize) / 2);

  return options.map((value, index) => {
    const centerX = startX + slotWidth * index + slotWidth / 2;
    return {
      id: `${value}-${index}`,
      value,
      x: Math.round(centerX - bubbleSize / 2),
      y: bubbleY,
      w: bubbleSize,
      h: bubbleSize,
      shape: square ? 'square' : 'circle',
    };
  });
}

function buildMachineQuestionLayout(
  question: MachineQuestionInput,
  x: number,
  y: number,
  w: number,
  h: number,
  columnIndex: number,
  spec: DensitySpec
): MachineQuestionLayout {
  const type = normalizeType(question.tipe);
  const options = getMachineQuestionOptions(question);
  const short = getShortLabel(type);
  const headerWidth = spec.headerWidth;

  if (type === 'multiple_true_false') {
    const cells: MachineCell[] = [];
    const rowHeaders = [];
    const count = Math.max(1, question.jumlah_pernyataan || 3);
    const headerBand = Math.max(14, Math.min(24, Math.round(h * 0.22)));
    const availableRowsH = Math.max(count * 12, h - headerBand - 4);
    const rowStep = Math.max(12, Math.min(28, Math.floor(availableRowsH / count)));
    const bubbleSize = Math.max(10, Math.min(spec.matrixBubbleSize + 2, rowStep - 3));
    const totalMatrixH = headerBand + count * rowStep;
    const topOffset = Math.max(2, Math.round((h - totalMatrixH) / 2));

    const choiceAreaWidth = Math.min(110, Math.max(68, w - headerWidth - 18));
    const choiceAreaX = x + w - choiceAreaWidth;
    const col1Center = choiceAreaX + Math.round(choiceAreaWidth * 0.28);
    const col2Center = choiceAreaX + Math.round(choiceAreaWidth * 0.72);
    const colHeaders = [
      { text: 'B', x: col1Center, y: y + topOffset },
      { text: 'S', x: col2Center, y: y + topOffset },
    ];
    const startRowY = y + topOffset + headerBand + Math.round((rowStep - bubbleSize) / 2);

    for (let index = 0; index < count; index++) {
      const rowY = startRowY + index * rowStep;
      rowHeaders.push({ text: String(index + 1), x: x + headerWidth + 4, y: rowY });
      cells.push({
        id: `B-${index + 1}`,
        value: 'B',
        rowKey: String(index + 1),
        x: Math.round(col1Center - bubbleSize / 2),
        y: rowY,
        w: bubbleSize,
        h: bubbleSize,
        shape: 'circle',
      });
      cells.push({
        id: `S-${index + 1}`,
        value: 'S',
        rowKey: String(index + 1),
        x: Math.round(col2Center - bubbleSize / 2),
        y: rowY,
        w: bubbleSize,
        h: bubbleSize,
        shape: 'circle',
      });
    }
    return { no: question.no, type, short, x, y, w, h, headerWidth, columnIndex, cells, rowHeaders, colHeaders };
  }

  if (type === 'matching') {
    const count = Math.max(1, Math.min(5, question.jumlah_pasang || 3));
    const letters = (question.opsi && question.opsi.length >= 2 ? question.opsi : ['A', 'B', 'C', 'D', 'E']).slice(
      0,
      Math.max(count, 4)
    );
    const headerBand = Math.max(14, Math.min(24, Math.round(h * 0.22)));
    const availableRowsH = Math.max(count * 12, h - headerBand - 4);
    const rowStep = Math.max(12, Math.min(28, Math.floor(availableRowsH / count)));
    const bubbleSize = Math.max(10, Math.min(spec.matrixBubbleSize + 2, rowStep - 3));
    const totalMatrixH = headerBand + count * rowStep;
    const topOffset = Math.max(2, Math.round((h - totalMatrixH) / 2));

    const choiceWidth = Math.min(184, Math.max(92, w - headerWidth - 22));
    const startX = x + w - choiceWidth;
    const slotWidth = choiceWidth / Math.max(letters.length, 1);
    const rowHeaders = [];
    const colHeaders = letters.map((letter, index) => ({
      text: letter,
      x: startX + slotWidth * index + slotWidth / 2,
      y: y + topOffset,
    }));
    const cells: MachineCell[] = [];
    const startRowY = y + topOffset + headerBand + Math.round((rowStep - bubbleSize) / 2);

    for (let rowIndex = 0; rowIndex < count; rowIndex++) {
      const rowY = startRowY + rowIndex * rowStep;
      rowHeaders.push({ text: String(rowIndex + 1), x: x + headerWidth + 4, y: rowY });
      letters.forEach((letter, colIndex) => {
        cells.push({
          id: `${rowIndex + 1}-${letter}`,
          value: letter,
          rowKey: String(rowIndex + 1),
          x: Math.round(startX + slotWidth * colIndex + slotWidth / 2 - bubbleSize / 2),
          y: rowY,
          w: bubbleSize,
          h: bubbleSize,
          shape: 'circle',
        });
      });
    }
    return { no: question.no, type, short, x, y, w, h, headerWidth, columnIndex, cells, rowHeaders, colHeaders };
  }

  if (type === 'short_answer') {
    // Area kosong terbuka (open write-in box) untuk angka, rumus matematika, atau kata/frasa singkat
    const boxX = x + headerWidth + 6;
    const boxW = Math.max(60, w - headerWidth - 10);
    const boxH = Math.min(30, Math.max(16, h - 6));
    const boxY = y + Math.round((h - boxH) / 2);
    const answerBox = { x: boxX, y: boxY, w: boxW, h: boxH };
    return {
      no: question.no,
      type,
      short,
      x,
      y,
      w,
      h,
      headerWidth,
      columnIndex,
      cells: [],
      answerBox,
    };
  }

  const effectiveHeaderWidth =
    type === 'matching_single' ? Math.max(spec.headerWidth, 56) : headerWidth;

  const cells = buildSimpleChoiceCells(
    type === 'true_false' ? ['B', 'S'] : options,
    x,
    y,
    w,
    h,
    type === 'multiple_select',
    spec,
    type === 'true_false'
      ? Math.min(150, w - effectiveHeaderWidth - 10)
      : type === 'single_choice_4'
        ? Math.min(280, w - effectiveHeaderWidth - 10)
        : type === 'single_choice' || type === 'multiple_select'
          ? Math.min(340, w - effectiveHeaderWidth - 10)
          : undefined,
    effectiveHeaderWidth
  );
  return { no: question.no, type, short, x, y, w, h, headerWidth: effectiveHeaderWidth, columnIndex, cells };
}

/**
 * Partisi sekuensial seimbang ke dalam `cols` kolom:
 * - Jika seluruh butir memiliki tinggi dasar seragam (mis. PG + B/S + PGK + Isian),
 *   bagi jumlah soal secara merata: ceil(N/cols), sehingga 30 soal di 3 kolom = 10 + 10 + 10.
 * - Jika terdapat matriks tinggi (MTF / Menjodohkan), gunakan Dynamic Programming Min-Max
 *   agar tinggi kolom tertinggi seminimal & seseimbang mungkin.
 */
function partitionIntoBalancedColumns(
  objectiveQuestions: MachineQuestionInput[],
  baseHeights: number[],
  cols: number,
  blockGap: number
): Array<Array<{ question: MachineQuestionInput; baseH: number }>> {
  const n = objectiveQuestions.length;
  const result: Array<Array<{ question: MachineQuestionInput; baseH: number }>> = Array.from(
    { length: cols },
    () => []
  );
  if (n === 0) return result;
  if (cols <= 1) {
    result[0] = objectiveQuestions.map((q, i) => ({ question: q, baseH: baseHeights[i] }));
    return result;
  }

  const firstH = baseHeights[0];
  const isUniformHeight = baseHeights.every((h) => Math.abs(h - firstH) <= 1);

  if (isUniformHeight) {
    const basePerCol = Math.floor(n / cols);
    const remainder = n % cols;
    let cursor = 0;
    for (let c = 0; c < cols; c++) {
      const take = basePerCol + (c < remainder ? 1 : 0);
      for (let k = 0; k < take && cursor < n; k++) {
        result[c].push({
          question: objectiveQuestions[cursor],
          baseH: baseHeights[cursor],
        });
        cursor++;
      }
    }
    return result;
  }

  // Dynamic Programming untuk soal campuran dengan tinggi bervariasi (MTF / Menjodohkan)
  const prefix = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + baseHeights[i];
  }
  const segHeight = (start: number, endExclusive: number) => {
    const count = endExclusive - start;
    if (count <= 0) return 0;
    return prefix[endExclusive] - prefix[start] + blockGap * (count - 1);
  };

  const effectiveCols = Math.min(cols, n);
  const dp: number[][] = Array.from({ length: effectiveCols + 1 }, () =>
    new Array<number>(n + 1).fill( Number.POSITIVE_INFINITY )
  );
  const splitAt: number[][] = Array.from({ length: effectiveCols + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    dp[1][i] = segHeight(0, i);
  }

  for (let c = 2; c <= effectiveCols; c++) {
    for (let i = c; i <= n; i++) {
      for (let prev = c - 1; prev < i; prev++) {
        const lastColH = segHeight(prev, i);
        const worst = Math.max(dp[c - 1][prev], lastColH);
        // Penalti sangat kecil bila kolom kanan lebih panjang dari kolom kiri agar kiri terisi mantap dulu
        const penalty = lastColH > dp[c - 1][prev] ? (lastColH - dp[c - 1][prev]) * 0.01 : 0;
        const score = worst + penalty;
        if (score < dp[c][i]) {
          dp[c][i] = score;
          splitAt[c][i] = prev;
        }
      }
    }
  }

  const bounds: Array<[number, number]> = [];
  let curEnd = n;
  for (let c = effectiveCols; c >= 2; c--) {
    const prev = splitAt[c][curEnd];
    bounds.unshift([prev, curEnd]);
    curEnd = prev;
  }
  bounds.unshift([0, curEnd]);

  bounds.forEach(([start, end], colIdx) => {
    for (let i = start; i < end; i++) {
      result[colIdx].push({
        question: objectiveQuestions[i],
        baseH: baseHeights[i],
      });
    }
  });

  return result;
}

function layoutQuestionsForSpec(
  objectiveQuestions: MachineQuestionInput[],
  objectiveArea: { x: number; y: number; w: number; h: number },
  spec: DensitySpec,
  allowElasticCompression = false
): { questions: MachineQuestionLayout[]; maxQuestionBottom: number; fits: boolean } {
  const cols = spec.columns;
  const usableX = objectiveArea.x + INNER_PAD_X;
  const usableW = objectiveArea.w - INNER_PAD_X * 2;
  const usableY = objectiveArea.y + INNER_PAD_TOP;
  const usableH = objectiveArea.h - INNER_PAD_TOP - INNER_PAD_BOTTOM;

  if (objectiveQuestions.length === 0) {
    return { questions: [], maxQuestionBottom: objectiveArea.y, fits: true };
  }

  const columnWidth = (usableW - spec.columnGap * (cols - 1)) / cols;
  const baseHeights = objectiveQuestions.map((q) => getBaseBlockHeight(q, spec));
  const colItems = partitionIntoBalancedColumns(objectiveQuestions, baseHeights, cols, spec.blockGap);

  const actualColHeights = colItems.map((items) => {
    if (items.length === 0) return 0;
    const sumH = items.reduce((acc, it) => acc + it.baseH, 0);
    return sumH + spec.blockGap * (items.length - 1);
  });
  const maxRawColHeight = Math.max(1, ...actualColHeights);

  const fitsNaturally = maxRawColHeight <= usableH + 0.5;
  if (!fitsNaturally && !allowElasticCompression) {
    return { questions: [], maxQuestionBottom: objectiveArea.y + maxRawColHeight, fits: false };
  }

  const firstH = baseHeights[0];
  const isUniformHeight = baseHeights.every((h) => Math.abs(h - firstH) <= 1);
  const maxRowsInAnyCol = Math.max(1, ...colItems.map((c) => c.length));

  const heightScale = fitsNaturally
    ? Math.min(2.2, usableH / maxRawColHeight)
    : usableH / maxRawColHeight;

  const scaledGap = Math.max(2, Math.min(8, Math.round(spec.blockGap * Math.min(1.4, heightScale))));
  const questions: MachineQuestionLayout[] = [];

  if (isUniformHeight) {
    // Tinggi baris seragam di seluruh kolom agar baris ke-1..N antar kolom sejajar lurus horizontal
    const totalGapsForMaxCol = scaledGap * Math.max(0, maxRowsInAnyCol - 1);
    const uniformRowH = Math.max(
      18,
      Math.min(52, Math.floor((usableH - totalGapsForMaxCol) / maxRowsInAnyCol))
    );

    for (let col = 0; col < cols; col++) {
      const items = colItems[col];
      if (items.length === 0) continue;
      const questionX = usableX + col * (columnWidth + spec.columnGap);

      for (let idx = 0; idx < items.length; idx++) {
        const { question } = items[idx];
        const rowY = usableY + idx * (uniformRowH + scaledGap);
        questions.push(
          buildMachineQuestionLayout(question, questionX, rowY, columnWidth, uniformRowH, col, spec)
        );
      }
    }
  } else {
    // Skala proporsional untuk ujian yang memuat matriks MTF / Menjodohkan
    const maxColGaps = scaledGap * Math.max(0, maxRowsInAnyCol - 1);
    const maxBaseSum = Math.max(
      1,
      ...colItems.map((items) => items.reduce((acc, it) => acc + it.baseH, 0))
    );
    const sharedScale = Math.min(2.0, Math.max(0.65, (usableH - maxColGaps) / maxBaseSum));

    for (let col = 0; col < cols; col++) {
      const items = colItems[col];
      if (items.length === 0) continue;
      const questionX = usableX + col * (columnWidth + spec.columnGap);
      let cursorY = usableY;

      for (let idx = 0; idx < items.length; idx++) {
        const { question, baseH } = items[idx];
        const scaledH = Math.max(18, Math.round(baseH * sharedScale));
        questions.push(
          buildMachineQuestionLayout(question, questionX, cursorY, columnWidth, scaledH, col, spec)
        );
        cursorY += scaledH + scaledGap;
      }
    }
  }

  const maxQuestionBottom = questions.reduce((max, q) => Math.max(max, q.y + q.h), objectiveArea.y);
  return { questions, maxQuestionBottom, fits: true };
}

export type EssayLayoutMode = 'integrated' | 'separate_manual' | 'second_page';

export function buildMachinePageLayout(
  questionConfig: MachineQuestionInput[] = [],
  totalSoal = 0,
  options?: string,
  hideEssayArea = false
) {
  const sourceQuestions =
    questionConfig.length > 0
      ? questionConfig
      : Array.from({ length: totalSoal }, (_, index) => ({
          no: index + 1,
          tipe: options || 'single_choice',
        }));

  const objectiveQuestions = sourceQuestions.filter((question) => normalizeType(question.tipe) !== 'essay');
  const essayQuestions = sourceQuestions.filter((question) => normalizeType(question.tipe) === 'essay');

  const count = objectiveQuestions.length;
  const hasTallMatrix = objectiveQuestions.some((q) => {
    const t = normalizeType(q.tipe);
    return t === 'multiple_true_false' || t === 'matching';
  });
  const hasWideSingleChoice = objectiveQuestions.some((q) => {
    const t = normalizeType(q.tipe);
    return t === 'matching_single' && getMachineQuestionOptions(q).length >= 6;
  });

  // Hitung tinggi area esai secara adaptif & proporsional agar semua nomor esai muat utuh tanpa terpotong
  let essayArea: { x: number; y: number; w: number; h: number } | null = null;
  let objectiveBottom = CONTENT_BOTTOM;

  if (essayQuestions.length > 0 && !hideEssayArea) {
    const totalBodyH = CONTENT_BOTTOM - OBJECTIVE_TOP; // 1042 unit
    const approxCols = count <= 5 ? 1 : count <= 20 ? 2 : count <= 45 ? 3 : 4;
    const approxRows = Math.max(1, Math.ceil(count / approxCols));
    const minObjectiveH = count === 0 ? 0 : Math.min(680, Math.max(240, approxRows * (hasTallMatrix ? 48 : 30) + 24));

    const idealEssayH =
      essayQuestions.length === 1
        ? 165
        : essayQuestions.length === 2
          ? 225
          : essayQuestions.length === 3
            ? 280
            : essayQuestions.length === 4
              ? 330
              : essayQuestions.length === 5
                ? 375
                : Math.min(470, 50 + essayQuestions.length * 62);

    const maxAllowedEssayH = count === 0 ? totalBodyH : Math.max(200, totalBodyH - minObjectiveH - 12);
    const essayHeight = Math.min(idealEssayH, maxAllowedEssayH);
    const essayY = CONTENT_BOTTOM - essayHeight;
    essayArea = { x: AREA_X, y: essayY, w: AREA_W, h: essayHeight };
    objectiveBottom = essayY - 10;
  }

  const objectiveArea = {
    x: AREA_X,
    y: OBJECTIVE_TOP,
    w: AREA_W,
    h: Math.max(120, objectiveBottom - OBJECTIVE_TOP),
  };

  // Pilih jumlah kolom cerdas berdasarkan jumlah soal objektif:
  // - 1..5 soal   : 1 kolom (atau 2 jika matriks panjang)
  // - 6..20 soal  : 2 kolom (atau hingga 54 soal jika ada Menjodohkan 1-ke-1 A–J/L agar bulatan lebar & mudah discan!)
  // - 21..45 soal : 3 kolom (mis. 30 -> 10+10+10, 35 -> 12+12+11, 40 -> 14+13+13)
  // - > 45 soal   : 4 kolom (mis. 50 -> 13+13+12+12)
  const validCandidates = DENSITY_CANDIDATES.filter((cand) => {
    if (cand.columns === 2 && cand.density === 'compact' && !hasWideSingleChoice) return false;
    if (cand.columns === 1 && count > 5) return false;
    if (cand.columns === 2) {
      if (hasWideSingleChoice) return count > 5 && count <= 54;
      if (count <= 5 || count > 20) return false;
    }
    if (cand.columns === 3 && (count <= 20 || count > 45) && !hasTallMatrix && !hasWideSingleChoice) return false;
    if (cand.columns === 4 && (hasWideSingleChoice || (count <= 45 && !hasTallMatrix))) return false;
    return true;
  });

  const candidatePool = validCandidates.length > 0 ? validCandidates : DENSITY_CANDIDATES;
  let chosenSpec = candidatePool[candidatePool.length - 1];
  let chosenResult: { questions: MachineQuestionLayout[]; maxQuestionBottom: number; fits: boolean } | null = null;

  for (const candidate of candidatePool) {
    const attempt = layoutQuestionsForSpec(objectiveQuestions, objectiveArea, candidate, false);
    if (attempt.fits) {
      chosenSpec = candidate;
      chosenResult = attempt;
      break;
    }
  }

  if (!chosenResult) {
    chosenResult = layoutQuestionsForSpec(objectiveQuestions, objectiveArea, chosenSpec, true);
  }

  // Jika ada area esai terpadu dan area objektif menyisakan ruang kosong di bawahnya,
  // rapatkan batas bawah objectiveArea tepat mengikuti baris terakhir dan berikan ruang ekstra ke essayArea!
  if (essayArea && count > 0 && chosenResult.questions.length > 0) {
    const tightObjectiveH = Math.max(
      160,
      chosenResult.maxQuestionBottom - OBJECTIVE_TOP + INNER_PAD_BOTTOM + 4
    );
    if (tightObjectiveH < objectiveArea.h - 10) {
      objectiveArea.h = tightObjectiveH;
      const newEssayY = OBJECTIVE_TOP + objectiveArea.h + 10;
      essayArea = {
        x: AREA_X,
        y: newEssayY,
        w: AREA_W,
        h: CONTENT_BOTTOM - newEssayY,
      };
    }
  }

  return {
    templateVersion: 2 as const,
    page: { ...MACHINE_PAGE_SIZE },
    columns: chosenSpec.columns,
    density: chosenSpec.density,
    objectiveArea,
    essayArea,
    questions: chosenResult.questions,
    maxQuestionBottom: chosenResult.maxQuestionBottom,
  } satisfies MachinePageLayout;
}
