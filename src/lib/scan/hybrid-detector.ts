import jsQR from 'jsqr';
import { getSharp } from '@/lib/sharp-loader';
import { buildMachinePageLayout, MachineQuestionInput, MachineQuestionType } from './machine-layout';

interface ImageDataRaw {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  gray: Uint8Array;
}

export interface HybridScanAnswer {
  no: number;
  ans: string | string[] | Record<string, string>;
  source: 'local';
  confidence: number;
}

export interface HybridScanResult {
  success: boolean;
  isCalibrated: boolean;
  answers: HybridScanAnswer[];
  nis?: string;
  idSiswa?: string;
  idKunci?: string;
  confidenceScore: number;
  unresolvedObjective: number;
  answeredObjective: number;
}

export interface HybridDebugQuestionScore {
  no: number;
  type: string;
  cells: Array<{ value: string; rowKey?: string; score: number }>;
}

export interface HybridDebugResult extends HybridScanResult {
  questionScores: HybridDebugQuestionScore[];
}

type PageBounds = { left: number; top: number; width: number; height: number };

async function readRawImage(buffer: Buffer): Promise<ImageDataRaw> {
  const sharp = await getSharp();
  if (!sharp) {
    throw new Error('Modul sharp tidak tersedia di runtime server.');
  }

  const { data, info } = await sharp(buffer)
    .rotate() // Auto-orient EXIF rotation from mobile cameras
    .ensureAlpha()
    .removeAlpha()
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const gray = new Uint8Array(data);
  const rgba = new Uint8ClampedArray(info.width * info.height * 4);
  for (let index = 0; index < gray.length; index++) {
    const value = gray[index];
    const offset = index * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  }

  return { width: info.width, height: info.height, rgba, gray };
}

function darkRatio(gray: Uint8Array, width: number, x: number, y: number, w: number, h: number) {
  let dark = 0;
  let total = 0;
  const endX = Math.max(x, Math.min(width, x + w));
  const endY = Math.max(y, Math.min(Math.floor(gray.length / width), y + h));
  for (let py = Math.max(0, y); py < endY; py++) {
    for (let px = Math.max(0, x); px < endX; px++) {
      total++;
      if (gray[(py * width) + px] < 165) dark++;
    }
  }
  return total > 0 ? dark / total : 0;
}

function findPageBounds(gray: Uint8Array, width: number, height: number): PageBounds | null {
  const rowThreshold = Math.max(0.03, 24 / width);
  const colThreshold = Math.max(0.03, 24 / height);

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    if (darkRatio(gray, width, 0, y, width, 1) > rowThreshold) {
      top = y;
      break;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    if (darkRatio(gray, width, 0, y, width, 1) > rowThreshold) {
      bottom = y;
      break;
    }
  }

  let left = -1;
  let right = -1;
  for (let x = 0; x < width; x++) {
    if (darkRatio(gray, width, x, 0, 1, height) > colThreshold) {
      left = x;
      break;
    }
  }
  for (let x = width - 1; x >= 0; x--) {
    if (darkRatio(gray, width, x, 0, 1, height) > colThreshold) {
      right = x;
      break;
    }
  }

  if (top < 0 || left < 0 || bottom <= top || right <= left) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function cropToMachinePage(buffer: Buffer): Promise<{
  cropped: ImageDataRaw;
  original: ImageDataRaw;
  isCalibrated: boolean;
} | null> {
  const original = await readRawImage(buffer);
  const bounds = findPageBounds(original.gray, original.width, original.height);
  if (!bounds) return null;

  const aspect = bounds.width / Math.max(1, bounds.height);
  const areaCoverage = (bounds.width * bounds.height) / Math.max(1, original.width * original.height);
  // A4 portrait aspect ratio is ~0.707 (1000 / 1414). Allow tolerance for digital/flatbed scans.
  const isAspectValid = aspect >= 0.60 && aspect <= 0.82;
  const isCoverageValid = areaCoverage >= 0.35 && areaCoverage <= 1.0;

  const sharp = await getSharp();
  if (!sharp) return null;

  const croppedBuffer = await sharp(buffer)
    .rotate()
    .extract(bounds)
    .resize(1000, 1414, { fit: 'fill' })
    .png()
    .toBuffer();

  const cropped = await readRawImage(croppedBuffer);

  // Check if the 4 corner fiducial markers (top-left, top-right, bottom-left, bottom-right) have dark ink
  const tlFid = darkRatio(cropped.gray, cropped.width, 4, 4, 34, 34);
  const trFid = darkRatio(cropped.gray, cropped.width, cropped.width - 38, 4, 34, 34);
  const blFid = darkRatio(cropped.gray, cropped.width, 4, cropped.height - 38, 34, 34);
  const brFid = darkRatio(cropped.gray, cropped.width, cropped.width - 38, cropped.height - 38, 34, 34);
  const hasFiducials = tlFid > 0.15 && trFid > 0.15 && blFid > 0.15 && brFid > 0.15;

  return {
    cropped,
    original,
    isCalibrated: isAspectValid && isCoverageValid && hasFiducials,
  };
}

function sampleCell(image: ImageDataRaw, rect: { x: number; y: number; w: number; h: number }, shape: 'circle' | 'square') {
  const insetX = Math.max(1, Math.floor(rect.w * 0.2));
  const insetY = Math.max(1, Math.floor(rect.h * 0.2));
  const startX = Math.floor(rect.x + insetX);
  const startY = Math.floor(rect.y + insetY);
  const endX = Math.floor(rect.x + rect.w - insetX);
  const endY = Math.floor(rect.y + rect.h - insetY);

  let sum = 0;
  let total = 0;
  const radiusX = Math.max(1, (endX - startX) / 2);
  const radiusY = Math.max(1, (endY - startY) / 2);
  const centerX = startX + radiusX;
  const centerY = startY + radiusY;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (shape === 'circle') {
        const dx = (x - centerX) / radiusX;
        const dy = (y - centerY) / radiusY;
        if ((dx * dx) + (dy * dy) > 1) continue;
      }
      total++;
      sum += (255 - image.gray[(y * image.width) + x]) / 255;
    }
  }

  return total > 0 ? sum / total : 0;
}

interface ParsedQrData {
  nis: string;
  idSiswa: string;
  idKunci: string;
}

function extractQrPayload(raw?: string): ParsedQrData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const nis = String(parsed.s || parsed.nis || '').trim();
      const idSiswa = String(parsed.id || parsed.id_siswa || '').trim();
      const idKunci = String(parsed.k || parsed.id_kunci || '').trim();
      if (nis || idSiswa || idKunci) {
        return { nis, idSiswa, idKunci };
      }
    }
  } catch {
    const trimmed = String(raw).trim();
    if (trimmed) {
      return { nis: trimmed, idSiswa: '', idKunci: '' };
    }
  }
  return null;
}

function scalePixelsNearest(source: Uint8ClampedArray, width: number, height: number, scale: number) {
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const output = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);

  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const sourceX = Math.floor(x / scale);
      const sourceY = Math.floor(y / scale);
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const targetIndex = (y * scaledWidth + x) * 4;
      output[targetIndex] = source[sourceIndex];
      output[targetIndex + 1] = source[sourceIndex + 1];
      output[targetIndex + 2] = source[sourceIndex + 2];
      output[targetIndex + 3] = 255;
    }
  }

  return { pixels: output, width: scaledWidth, height: scaledHeight };
}

function decodeQrFromRegions(image: ImageDataRaw, candidates: Array<{ x: number; y: number; w: number; h: number }>): ParsedQrData | null {
  for (const candidate of candidates) {
    const crop = {
      x: Math.max(0, Math.floor(image.width * candidate.x)),
      y: Math.max(0, Math.floor(image.height * candidate.y)),
      w: Math.max(16, Math.min(image.width - Math.floor(image.width * candidate.x), Math.floor(image.width * candidate.w))),
      h: Math.max(16, Math.min(image.height - Math.floor(image.height * candidate.y), Math.floor(image.height * candidate.h))),
    };

    const pixels = new Uint8ClampedArray(crop.w * crop.h * 4);
    for (let y = 0; y < crop.h; y++) {
      for (let x = 0; x < crop.w; x++) {
        const sourceIndex = ((crop.y + y) * image.width + (crop.x + x)) * 4;
        const targetIndex = (y * crop.w + x) * 4;
        pixels[targetIndex] = image.rgba[sourceIndex];
        pixels[targetIndex + 1] = image.rgba[sourceIndex + 1];
        pixels[targetIndex + 2] = image.rgba[sourceIndex + 2];
        pixels[targetIndex + 3] = 255;
      }
    }

    const attempts = [
      { pixels, width: crop.w, height: crop.h },
      scalePixelsNearest(pixels, crop.w, crop.h, 2),
    ];

    if (crop.w < 240) {
      attempts.push(scalePixelsNearest(pixels, crop.w, crop.h, 3));
    }

    for (const attempt of attempts) {
      const decoded = jsQR(attempt.pixels, attempt.width, attempt.height);
      const payload = extractQrPayload(decoded?.data);
      if (payload && (payload.nis || payload.idSiswa)) return payload;
    }
  }
  return null;
}

function decodeQr(croppedImage: ImageDataRaw, originalImage?: ImageDataRaw): ParsedQrData {
  // Prioritaskan posisi QR baru di kanan-atas (y: 166..304 dari 1414 -> ~0.10..0.24),
  // serta fallback ke kanan-bawah untuk kompatibilitas lembar LJK cetakan lama.
  const croppedCandidates = [
    { x: 0.78, y: 0.10, w: 0.20, h: 0.14 },
    { x: 0.70, y: 0.07, w: 0.29, h: 0.20 },
    { x: 0.72, y: 0.82, w: 0.27, h: 0.17 },
    { x: 0.76, y: 0.86, w: 0.22, h: 0.13 },
    { x: 0.60, y: 0.75, w: 0.40, h: 0.25 },
  ];

  const fromCropped = decodeQrFromRegions(croppedImage, croppedCandidates);
  if (fromCropped) return fromCropped;

  if (originalImage) {
    const originalCandidates = [
      { x: 0.55, y: 0.02, w: 0.45, h: 0.32 },
      { x: 0.55, y: 0.65, w: 0.45, h: 0.35 },
      { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
    ];
    const fromOriginal = decodeQrFromRegions(originalImage, originalCandidates);
    if (fromOriginal) return fromOriginal;
  }

  return { nis: '', idSiswa: '', idKunci: '' };
}

function chooseSingle(values: Array<{ value: string; score: number }>) {
  const sorted = [...values].sort((a, b) => b.score - a.score);
  const first = sorted[0];
  const second = sorted[1];
  if (!first) return { answer: '?', confidence: 0 };
  // Printed letters inside empty bubbles have darkness ~0.10-0.20.
  // Require >= 0.26 darkness and >= 0.07 margin over second choice to prevent false positives.
  if (first.score < 0.26) return { answer: '?', confidence: first.score };
  const margin = first.score - (second?.score || 0);
  if (margin < 0.07) return { answer: '?', confidence: first.score * 0.5 };
  return { answer: first.value, confidence: Math.min(1, first.score + margin) };
}

function chooseMultiple(values: Array<{ value: string; score: number }>) {
  const maxScore = values.reduce((max, item) => Math.max(max, item.score), 0);
  const threshold = Math.max(0.30, maxScore * 0.60);
  const selectedItems = values.filter((item) => item.score >= threshold);
  const selected = selectedItems.map((item) => item.value).sort();
  const confidence = selectedItems.length > 0
    ? selectedItems.reduce((sum, item) => sum + item.score, 0) / selectedItems.length
    : maxScore;
  return { answer: selected.length > 0 ? selected : '?', confidence };
}

function resolveQuestionAnswer(type: MachineQuestionType, scoredCells: Array<{ value: string; score: number; rowKey?: string }>) {
  if (type === 'single_choice' || type === 'single_choice_4' || type === 'true_false' || type === 'matching_single') {
    return chooseSingle(scoredCells.map(({ value, score }) => ({ value, score })));
  }

  if (type === 'multiple_select') {
    return chooseMultiple(scoredCells.map(({ value, score }) => ({ value, score })));
  }

  if (type === 'multiple_true_false' || type === 'matching') {
    const grouped = new Map<string, Array<{ value: string; score: number }>>();
    scoredCells.forEach((cell) => {
      const key = cell.rowKey || '';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ value: cell.value, score: cell.score });
    });

    if (type === 'multiple_true_false') {
      const answers: string[] = [];
      let confidenceSum = 0;
      for (const [, row] of grouped) {
        const resolved = chooseSingle(row);
        answers.push(String(resolved.answer));
        confidenceSum += resolved.confidence;
      }
      const valid = answers.every((answer) => answer === 'B' || answer === 'S');
      return {
        answer: valid ? answers : '?',
        confidence: grouped.size > 0 ? confidenceSum / grouped.size : 0,
      };
    }

    const answerMap: Record<string, string> = {};
    let confidenceSum = 0;
    let validRows = 0;
    for (const [rowKey, row] of grouped) {
      const resolved = chooseSingle(row);
      if (typeof resolved.answer === 'string' && resolved.answer !== '?') {
        answerMap[rowKey] = resolved.answer;
        validRows++;
      }
      confidenceSum += resolved.confidence;
    }
    return {
      answer: validRows === grouped.size && grouped.size > 0 ? answerMap : '?',
      confidence: grouped.size > 0 ? confidenceSum / grouped.size : 0,
    };
  }

  return { answer: '?', confidence: 0 };
}

async function runHybridObjectiveScanInternal(
  buffer: Buffer,
  questionBlueprint: MachineQuestionInput[],
  totalSoal: number,
  includeDebug = false
) {
  const pageData = await cropToMachinePage(buffer).catch(() => null);
  if (!pageData) {
    return {
      success: false,
      isCalibrated: false,
      answers: [],
      confidenceScore: 0,
      unresolvedObjective: totalSoal,
      answeredObjective: 0,
      questionScores: [],
    } satisfies HybridDebugResult;
  }

  const { cropped: image, original, isCalibrated } = pageData;
  const qrData = decodeQr(image, original);
  const layout = buildMachinePageLayout(questionBlueprint, totalSoal);
  const answers: HybridScanAnswer[] = [];
  const questionScores: HybridDebugQuestionScore[] = [];
  let confidenceSum = 0;
  let answeredObjective = 0;
  let unresolvedObjective = 0;

  layout.questions.forEach((question) => {
    const scoredCells = question.cells.map((cell) => ({
      value: cell.value,
      rowKey: cell.rowKey,
      score: sampleCell(image, cell, cell.shape),
    }));
    if (includeDebug) {
      questionScores.push({
        no: question.no,
        type: question.type,
        cells: scoredCells.map((cell) => ({
          value: cell.value,
          rowKey: cell.rowKey,
          score: cell.score,
        })),
      });
    }
    const resolved = resolveQuestionAnswer(question.type as MachineQuestionType, scoredCells);
    const answer = resolved.answer;
    const isResolved =
      (typeof answer === 'string' && answer !== '?') ||
      (Array.isArray(answer) && answer.length > 0) ||
      (typeof answer === 'object' && answer !== null && Object.keys(answer).length > 0);

    if (isResolved) answeredObjective++;
    else unresolvedObjective++;
    confidenceSum += resolved.confidence;

    answers.push({
      no: question.no,
      ans: answer,
      source: 'local',
      confidence: resolved.confidence,
    });
  });

  // Check if local answers suffer from single-letter dominance anomaly (sign of misaligned camera grid)
  const counts: Record<string, number> = {};
  for (const a of answers) {
    if (typeof a.ans === 'string' && a.ans !== '?') {
      counts[a.ans] = (counts[a.ans] || 0) + 1;
    }
  }
  const hasDominanceAnomaly =
    answers.length >= 5 &&
    Object.values(counts).some((c) => c / answers.length > 0.8);

  const effectiveCalibrated = isCalibrated && !hasDominanceAnomaly;

  return {
    success: answers.length > 0,
    isCalibrated: effectiveCalibrated,
    answers,
    nis: qrData.nis,
    idSiswa: qrData.idSiswa,
    idKunci: qrData.idKunci,
    confidenceScore: answers.length > 0 ? confidenceSum / answers.length : 0,
    unresolvedObjective,
    answeredObjective,
    questionScores,
  } satisfies HybridDebugResult;
}

export async function runHybridObjectiveScan(buffer: Buffer, questionBlueprint: MachineQuestionInput[], totalSoal: number) {
  const result = await runHybridObjectiveScanInternal(buffer, questionBlueprint, totalSoal, false);
  return {
    success: result.success,
    isCalibrated: result.isCalibrated,
    answers: result.answers,
    nis: result.nis,
    idSiswa: result.idSiswa,
    idKunci: result.idKunci,
    confidenceScore: result.confidenceScore,
    unresolvedObjective: result.unresolvedObjective,
    answeredObjective: result.answeredObjective,
  } satisfies HybridScanResult;
}

export async function debugHybridObjectiveScan(buffer: Buffer, questionBlueprint: MachineQuestionInput[], totalSoal: number) {
  return runHybridObjectiveScanInternal(buffer, questionBlueprint, totalSoal, true);
}
