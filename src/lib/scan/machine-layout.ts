export type MachineQuestionType =
  | 'single_choice'
  | 'single_choice_4'
  | 'true_false'
  | 'multiple_select'
  | 'multiple_true_false'
  | 'matching'
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

const OBJECTIVE_TOP = 376;
const CONTENT_BOTTOM = 1248;
const AREA_X = 44;
const AREA_W = 912;
const INNER_PAD_X = 18;
const INNER_PAD_TOP = 10;
const INNER_PAD_BOTTOM = 10;

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
    simpleHeight: 54,
    mtfBaseHeight: 42,
    mtfRowHeight: 28,
    matchingBaseHeight: 44,
    matchingRowHeight: 28,
    bubbleMaxCircle: 23,
    bubbleMaxSquare: 21,
    matrixBubbleSize: 18,
  },
  {
    density: 'spacious',
    columns: 2,
    columnGap: 32,
    blockGap: 6,
    headerWidth: 44,
    simpleHeight: 42,
    mtfBaseHeight: 34,
    mtfRowHeight: 22,
    matchingBaseHeight: 36,
    matchingRowHeight: 22,
    bubbleMaxCircle: 21,
    bubbleMaxSquare: 19,
    matrixBubbleSize: 15,
  },
  {
    density: 'normal',
    columns: 2,
    columnGap: 24,
    blockGap: 5,
    headerWidth: 42,
    simpleHeight: 34,
    mtfBaseHeight: 28,
    mtfRowHeight: 19,
    matchingBaseHeight: 30,
    matchingRowHeight: 19,
    bubbleMaxCircle: 18,
    bubbleMaxSquare: 16,
    matrixBubbleSize: 14,
  },
  {
    density: 'normal',
    columns: 3,
    columnGap: 20,
    blockGap: 5,
    headerWidth: 38,
    simpleHeight: 36,
    mtfBaseHeight: 28,
    mtfRowHeight: 18,
    matchingBaseHeight: 30,
    matchingRowHeight: 18,
    bubbleMaxCircle: 18,
    bubbleMaxSquare: 16,
    matrixBubbleSize: 14,
  },
  {
    density: 'compact',
    columns: 3,
    columnGap: 18,
    blockGap: 4,
    headerWidth: 38,
    simpleHeight: 30,
    mtfBaseHeight: 25,
    mtfRowHeight: 17,
    matchingBaseHeight: 26,
    matchingRowHeight: 17,
    bubbleMaxCircle: 16,
    bubbleMaxSquare: 15,
    matrixBubbleSize: 13,
  },
  {
    density: 'compact',
    columns: 3,
    columnGap: 16,
    blockGap: 3,
    headerWidth: 36,
    simpleHeight: 26,
    mtfBaseHeight: 22,
    mtfRowHeight: 15,
    matchingBaseHeight: 23,
    matchingRowHeight: 15,
    bubbleMaxCircle: 15,
    bubbleMaxSquare: 14,
    matrixBubbleSize: 12,
  },
  {
    density: 'ultra',
    columns: 4,
    columnGap: 14,
    blockGap: 3,
    headerWidth: 34,
    simpleHeight: 24,
    mtfBaseHeight: 20,
    mtfRowHeight: 14,
    matchingBaseHeight: 21,
    matchingRowHeight: 14,
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
    'BENAR_SALAH': 'true_false',
    'PG_TUNGGAL': 'single_choice',
    'PG_KOMPLEKS': 'multiple_select',
    MTF: 'multiple_true_false',
    MENJODOHKAN: 'matching',
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
    short_answer: 'ISN',
    essay: 'ESI',
  };
  return map[type];
}

function getBaseBlockHeight(question: MachineQuestionInput, spec: DensitySpec) {
  const type = normalizeType(question.tipe);
  if (type === 'multiple_true_false') {
    return spec.mtfBaseHeight + ((question.jumlah_pernyataan || 3) * spec.mtfRowHeight);
  }
  if (type === 'matching') {
    return spec.matchingBaseHeight + ((question.jumlah_pasang || 3) * spec.matchingRowHeight);
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
  maxChoiceWidth?: number
): MachineCell[] {
  const areaX = x + spec.headerWidth;
  const availableWidth = Math.max(40, w - spec.headerWidth - 8);
  const choiceWidth = Math.min(maxChoiceWidth || availableWidth, availableWidth);
  const startX = areaX + Math.max(0, (availableWidth - choiceWidth) * 0.35);
  const slotWidth = choiceWidth / Math.max(options.length, 1);
  const maxBubble = square ? spec.bubbleMaxSquare : spec.bubbleMaxCircle;
  // Izinkan ukuran bulatan sedikit lebih besar bila tinggi baris (h) sangat lega
  const dynamicMaxBubble = h >= 64 ? maxBubble + 2 : maxBubble;
  const bubbleSize = Math.max(12, Math.min(dynamicMaxBubble, Math.floor(slotWidth * 0.5), h - 8));
  const bubbleY = y + Math.round((h - bubbleSize) / 2);

  return options.map((value, index) => {
    const centerX = startX + (slotWidth * index) + (slotWidth / 2);
    return {
      id: `${value}-${index}`,
      value,
      x: Math.round(centerX - (bubbleSize / 2)),
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
    const totalMatrixH = headerBand + (count * rowStep);
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
      const rowY = startRowY + (index * rowStep);
      rowHeaders.push({ text: String(index + 1), x: x + headerWidth + 4, y: rowY });
      cells.push({
        id: `B-${index + 1}`,
        value: 'B',
        rowKey: String(index + 1),
        x: Math.round(col1Center - (bubbleSize / 2)),
        y: rowY,
        w: bubbleSize,
        h: bubbleSize,
        shape: 'circle',
      });
      cells.push({
        id: `S-${index + 1}`,
        value: 'S',
        rowKey: String(index + 1),
        x: Math.round(col2Center - (bubbleSize / 2)),
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
    const letters = (question.opsi && question.opsi.length >= 2 ? question.opsi : ['A', 'B', 'C', 'D', 'E']).slice(0, Math.max(count, 4));
    const headerBand = Math.max(14, Math.min(24, Math.round(h * 0.22)));
    const availableRowsH = Math.max(count * 12, h - headerBand - 4);
    const rowStep = Math.max(12, Math.min(28, Math.floor(availableRowsH / count)));
    const bubbleSize = Math.max(10, Math.min(spec.matrixBubbleSize + 2, rowStep - 3));
    const totalMatrixH = headerBand + (count * rowStep);
    const topOffset = Math.max(2, Math.round((h - totalMatrixH) / 2));

    const choiceWidth = Math.min(184, Math.max(92, w - headerWidth - 22));
    const startX = x + w - choiceWidth;
    const slotWidth = choiceWidth / Math.max(letters.length, 1);
    const rowHeaders = [];
    const colHeaders = letters.map((letter, index) => ({
      text: letter,
      x: startX + (slotWidth * index) + (slotWidth / 2),
      y: y + topOffset,
    }));
    const cells: MachineCell[] = [];
    const startRowY = y + topOffset + headerBand + Math.round((rowStep - bubbleSize) / 2);

    for (let rowIndex = 0; rowIndex < count; rowIndex++) {
      const rowY = startRowY + (rowIndex * rowStep);
      rowHeaders.push({ text: String(rowIndex + 1), x: x + headerWidth + 4, y: rowY });
      letters.forEach((letter, colIndex) => {
        cells.push({
          id: `${rowIndex + 1}-${letter}`,
          value: letter,
          rowKey: String(rowIndex + 1),
          x: Math.round(startX + (slotWidth * colIndex) + (slotWidth / 2) - (bubbleSize / 2)),
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
    const count = Math.max(3, Math.min(20, question.panjang_jawaban || 10));
    const availableW = Math.max(60, w - headerWidth - 10);
    const slotWidth = Math.min(24, availableW / count);
    const totalWidth = slotWidth * count;
    const startX = x + headerWidth + Math.max(0, (availableW - totalWidth) * 0.25);
    const boxH = Math.min(24, Math.max(14, h - 8));
    const boxY = y + Math.round((h - boxH) / 2);
    const textBoxes = Array.from({ length: count }, (_, index) => ({
      index,
      x: startX + (index * slotWidth),
      y: boxY,
      w: Math.max(8, slotWidth - 2.5),
      h: boxH,
    }));
    return { no: question.no, type, short, x, y, w, h, headerWidth, columnIndex, cells: [], textBoxes };
  }

  const cells = buildSimpleChoiceCells(
    type === 'true_false' ? ['B', 'S'] : options,
    x,
    y,
    w,
    h,
    type === 'multiple_select',
    spec,
    type === 'true_false'
      ? Math.min(150, w - headerWidth - 10)
      : type === 'single_choice_4'
        ? Math.min(280, w - headerWidth - 10)
        : (type === 'single_choice' || type === 'multiple_select')
          ? Math.min(340, w - headerWidth - 10)
          : undefined
  );
  return { no: question.no, type, short, x, y, w, h, headerWidth, columnIndex, cells };
}

function layoutQuestionsForSpec(
  objectiveQuestions: MachineQuestionInput[],
  objectiveArea: { x: number; y: number; w: number; h: number },
  spec: DensitySpec,
  allowElasticCompression = false
): { questions: MachineQuestionLayout[]; maxQuestionBottom: number; fits: boolean } {
  const cols = spec.columns;
  const usableX = objectiveArea.x + INNER_PAD_X;
  const usableW = objectiveArea.w - (INNER_PAD_X * 2);
  const usableY = objectiveArea.y + INNER_PAD_TOP;
  const usableH = objectiveArea.h - INNER_PAD_TOP - INNER_PAD_BOTTOM;

  if (objectiveQuestions.length === 0) {
    return { questions: [], maxQuestionBottom: objectiveArea.y, fits: true };
  }

  const columnWidth = (usableW - (spec.columnGap * (cols - 1))) / cols;
  const baseHeights = objectiveQuestions.map((q) => getBaseBlockHeight(q, spec));

  // Partisi soal ke dalam kolom secara seimbang berdasarkan tinggi visual (Height-Balanced Partitioning)
  const colItems: Array<Array<{ question: MachineQuestionInput; baseH: number }>> = Array.from(
    { length: cols },
    () => []
  );
  const colRawHeights = new Array<number>(cols).fill(0);
  let currentCol = 0;

  for (let i = 0; i < objectiveQuestions.length; i++) {
    const q = objectiveQuestions[i];
    const bH = baseHeights[i];
    const remainingQuestions = objectiveQuestions.length - i;
    const remainingColsAfter = cols - currentCol - 1;

    // Hitung sisa tinggi dari index i hingga akhir
    let remainingHeight = 0;
    for (let j = i; j < objectiveQuestions.length; j++) {
      remainingHeight += baseHeights[j] + spec.blockGap;
    }
    const targetRemainingPerCol = remainingHeight / (cols - currentCol);

    const wouldExceedUsable = colRawHeights[currentCol] + bH > usableH;
    const reachedBalancedHeight =
      colRawHeights[currentCol] + (bH * 0.55) >= targetRemainingPerCol;

    if (
      currentCol < cols - 1 &&
      colItems[currentCol].length > 0 &&
      remainingQuestions >= remainingColsAfter &&
      (wouldExceedUsable || reachedBalancedHeight)
    ) {
      currentCol++;
    }

    colItems[currentCol].push({ question: q, baseH: bH });
    colRawHeights[currentCol] += bH + spec.blockGap;
  }

  // Hitung tinggi kolom tertinggi (tanpa blockGap terakhir)
  const actualColHeights = colItems.map((items) => {
    if (items.length === 0) return 0;
    const sumH = items.reduce((acc, it) => acc + it.baseH, 0);
    return sumH + (spec.blockGap * (items.length - 1));
  });
  const maxRawColHeight = Math.max(1, ...actualColHeights);

  const fitsNaturally = maxRawColHeight <= usableH + 0.5;
  if (!fitsNaturally && !allowElasticCompression) {
    return { questions: [], maxQuestionBottom: objectiveArea.y + maxRawColHeight, fits: false };
  }

  // Skala elastis cerdas (Smart Elastic Scaling):
  // - Jika jumlah soal sedikit (maxRawColHeight < usableH), rentangkan tinggi baris secara proporsional
  //   agar memenuhi kotak lembar jawaban dengan rapi dan tidak menyisakan ruang kosong kaku di bawah.
  // - Jika jumlah soal sangat padat & dipilih sebagai fallback terakhir, kompres secara presisi agar 100% muat.
  const heightScale = fitsNaturally
    ? Math.min(3.2, usableH / maxRawColHeight)
    : usableH / maxRawColHeight;

  const scaledGap = Math.max(2, Math.round(spec.blockGap * Math.min(1.5, heightScale)));

  const questions: MachineQuestionLayout[] = [];

  for (let col = 0; col < cols; col++) {
    const items = colItems[col];
    if (items.length === 0) continue;

    const totalBaseH = items.reduce((acc, it) => acc + it.baseH, 0);
    const totalGaps = scaledGap * (items.length - 1);
    // Gunakan skala seragam berbasis kolom terpadat agar baris kiri & kanan sejajar rapi
    const targetContentH = Math.min(
      usableH - totalGaps,
      Math.round(totalBaseH * heightScale)
    );
    const effectiveScale = totalBaseH > 0 ? targetContentH / totalBaseH : 1;

    const questionX = usableX + (col * (columnWidth + spec.columnGap));
    let cursorY = usableY;

    for (let idx = 0; idx < items.length; idx++) {
      const { question, baseH } = items[idx];
      const scaledH = Math.max(18, Math.round(baseH * effectiveScale));
      const finalH =
        idx === items.length - 1 && Math.abs((cursorY + scaledH) - (usableY + usableH)) <= 8
          ? (usableY + usableH) - cursorY
          : scaledH;

      questions.push(
        buildMachineQuestionLayout(question, questionX, cursorY, columnWidth, finalH, col, spec)
      );
      cursorY += finalH + scaledGap;
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
  const sourceQuestions = questionConfig.length > 0
    ? questionConfig
    : Array.from({ length: totalSoal }, (_, index) => ({ no: index + 1, tipe: options || 'single_choice' }));

  const objectiveQuestions = sourceQuestions.filter((question) => normalizeType(question.tipe) !== 'essay');
  const essayQuestions = sourceQuestions.filter((question) => normalizeType(question.tipe) === 'essay');

  // Hitung tinggi area esai secara adaptif berdasarkan jumlah soal esai
  let essayArea: { x: number; y: number; w: number; h: number } | null = null;
  let objectiveBottom = CONTENT_BOTTOM;

  if (essayQuestions.length > 0 && !hideEssayArea) {
    const essayHeight = essayQuestions.length === 1
      ? 130
      : essayQuestions.length === 2
        ? 172
        : essayQuestions.length === 3
          ? 212
          : 242;
    const essayY = CONTENT_BOTTOM - essayHeight;
    essayArea = { x: AREA_X, y: essayY, w: AREA_W, h: essayHeight };
    objectiveBottom = essayY - 12;
  }

  const objectiveArea = {
    x: AREA_X,
    y: OBJECTIVE_TOP,
    w: AREA_W,
    h: objectiveBottom - OBJECTIVE_TOP,
  };

  // Filter kandidat jumlah kolom vertikal secara cerdas:
  // - 1..5 soal   : 1 kolom (atau 2 kolom jika matriks panjang)
  // - 6..20 soal  : 2 kolom vertikal (atau 3 kolom jika matriks AKM sangat padat)
  // - 21..40 soal : Otomatis 3 kolom vertikal (proporsional seperti LJK Ujian Nasional)
  // - > 40 soal   : 3 atau 4 kolom vertikal
  const count = objectiveQuestions.length;
  const validCandidates = DENSITY_CANDIDATES.filter((cand) => {
    if (cand.columns === 1 && count > 5) return false;
    if (cand.columns === 2 && count > 20) return false;
    if (cand.columns === 4 && count <= 35) return false;
    return true;
  });

  let chosenSpec = validCandidates[validCandidates.length - 1];
  let chosenResult: { questions: MachineQuestionLayout[]; maxQuestionBottom: number; fits: boolean } | null = null;

  for (const candidate of validCandidates) {
    const attempt = layoutQuestionsForSpec(objectiveQuestions, objectiveArea, candidate, false);
    if (attempt.fits) {
      chosenSpec = candidate;
      chosenResult = attempt;
      break;
    }
  }

  // Fallback elastis jika jumlah soal sangat banyak & kompleks (menjamin 100% tidak pernah terpotong)
  if (!chosenResult) {
    chosenResult = layoutQuestionsForSpec(objectiveQuestions, objectiveArea, chosenSpec, true);
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
