import { formatJawaban, getTipeMeta, TIPE_SOAL_AKM, TipeSoalKode } from '@/lib/constants/tipe-soal';
import { buildMachinePageLayout } from '@/lib/scan/machine-layout';
import {
  appendObjectRows,
  createWorkbook,
  downloadWorkbook,
  loadWorkbookFromFile,
  worksheetToObjects,
} from '@/lib/utils/excel';

export type PerlakuanSoal = 'normal' | 'bonus' | 'anulir';
export type KompleksMode = 'mutlak' | 'parsial';

/** Representasi satu butir kunci jawaban sesuai skema KUNCI_JAWABAN & machine-layout. */
export interface SoalItem {
  no: number;
  tipe: TipeSoalKode;
  jawaban: any;
  opsi: string[];
  poin: number;
  perlakuan?: PerlakuanSoal;
  jumlah_pernyataan?: number;
  jumlah_pasang?: number;
  panjang_jawaban?: number;
}

export interface TypeWeightSummary {
  kode: TipeSoalKode;
  label: string;
  short: string;
  color: string;
  count: number;
  activeCount: number;
  totalPoin: number;
  pctOfTotal: number;
}

/** Konfigurasi komposisi jumlah & bobot persentase per jenis soal (gaya Bank Soal). */
export interface CompositionConfig {
  pgCount: number;
  pgOpsi: '4' | '5';
  pgPct: number;
  tfCount: number;
  tfPct: number;
  pgkCount: number;
  pgkPct: number;
  mtfCount: number;
  mtfPct: number;
  mtfPernyataan: number;
  jdhCount: number;
  jdhPct: number;
  jdhPasang: number;
  isnCount: number;
  isnPct: number;
  isnPanjang: number;
  esiCount: number;
  esiPct: number;
}

export const DEFAULT_COMPOSITION: CompositionConfig = {
  pgCount: 0,
  pgOpsi: '5',
  pgPct: 0,
  tfCount: 0,
  tfPct: 0,
  pgkCount: 0,
  pgkPct: 0,
  mtfCount: 0,
  mtfPct: 0,
  mtfPernyataan: 3,
  jdhCount: 0,
  jdhPct: 0,
  jdhPasang: 3,
  isnCount: 0,
  isnPct: 0,
  isnPanjang: 10,
  esiCount: 0,
  esiPct: 0,
};

export interface BulkParseResult {
  updatedItems: SoalItem[];
  appliedCount: number;
  skippedCount: number;
}

export interface PgDistributionStats {
  counts: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
  tfCounts: Record<'B' | 'S', number>;
  totalPg: number;
  totalTf: number;
  dominantLetter: string | null;
  dominantPct: number;
}

export interface LjkEstimateSummary {
  columns: number;
  density: string;
  densityLabel: string;
  hasEssayArea: boolean;
  objectiveCount: number;
  essayCount: number;
}

/** Generate default valid jawaban untuk suatu tipe soal. */
export function defaultJawaban(tipe: TipeSoalKode | string, jp = 3, jps = 3): any {
  const meta = getTipeMeta(tipe);
  switch (meta.kode) {
    case 'single_choice':
    case 'single_choice_4':
    case 'true_false':
      return '';
    case 'multiple_select':
      return [];
    case 'multiple_true_false':
      return Array.from({ length: jp }, (_, i) => (i % 2 === 0 ? 'B' : 'S'));
    case 'matching': {
      const m: Record<string, string> = {};
      const opts = ['A', 'B', 'C', 'D', 'E'];
      for (let i = 1; i <= jps; i++) m[String(i)] = opts[(i - 1) % 5];
      return m;
    }
    case 'short_answer':
    case 'essay':
      return '';
  }
}

/** Buat satu item soal baru yang lengkap dan aman untuk LJK + AI Grader. */
export function buildSoalItem(no: number, tipe: TipeSoalKode | string, poin = 1): SoalItem {
  const meta = getTipeMeta(tipe);
  const item: SoalItem = {
    no,
    tipe: meta.kode,
    jawaban: defaultJawaban(meta.kode),
    opsi: [...meta.opsi],
    poin: Math.max(0.05, Math.round((Number(poin) || 1) * 100) / 100),
  };
  if (meta.kode === 'multiple_true_false') item.jumlah_pernyataan = 3;
  if (meta.kode === 'matching') item.jumlah_pasang = 3;
  if (meta.kode === 'short_answer') item.panjang_jawaban = 10;
  return item;
}

/** Mengubah tipe satu item soal sembari menjaga kelengkapan properti wajibnya. */
export function changeSoalTipe(prev: SoalItem, newTipe: TipeSoalKode): SoalItem {
  const meta = getTipeMeta(newTipe);
  const jp = prev.jumlah_pernyataan || 3;
  const jps = prev.jumlah_pasang || 3;
  const updated: SoalItem = {
    no: prev.no,
    tipe: meta.kode,
    opsi: [...meta.opsi],
    poin: prev.poin || 1,
    jawaban: defaultJawaban(meta.kode, jp, jps),
  };
  if (meta.kode === 'multiple_true_false') updated.jumlah_pernyataan = jp;
  if (meta.kode === 'matching') updated.jumlah_pasang = jps;
  if (meta.kode === 'short_answer') updated.panjang_jawaban = prev.panjang_jawaban || 10;
  return updated;
}

/** Resize array soal tanpa menghapus kunci yang sudah diisi pada nomor awal. */
export function resizeSoalItems(
  prevItems: SoalItem[],
  newCount: number,
  defaultTipe: TipeSoalKode,
  defaultPoin = 1
): SoalItem[] {
  const count = Math.max(1, Math.min(100, Math.round(newCount) || 1));
  const next: SoalItem[] = [];
  for (let i = 1; i <= count; i++) {
    const existing = prevItems.find((x) => Number(x.no) === i);
    next.push(existing ? { ...existing, no: i } : buildSoalItem(i, defaultTipe, defaultPoin));
  }
  return next;
}

/** Parse string/array `data_json` dari sheet KUNCI_JAWABAN secara aman. */
export function parseDataJsonSafe(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parse objek pengaturan_poin secara aman. */
export function parsePengaturanPoinSafe(raw: any): Record<string, any> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Normalisasi data item kunci yang dimuat untuk mode Edit atau Duplikat. */
export function hydrateSoalItems(kunciRow: any): SoalItem[] {
  const rawArr = parseDataJsonSafe(kunciRow?.data_json);
  const poinMap = parsePengaturanPoinSafe(kunciRow?.pengaturan_poin);

  return rawArr.map((item: any, idx: number) => {
    const no = Number(item.no) || idx + 1;
    const meta = getTipeMeta(item.tipe || kunciRow?.tipe_soal || 'single_choice');
    const jp = Math.max(2, Math.min(10, Number(item.jumlah_pernyataan) || 3));
    const jps = Math.max(2, Math.min(5, Number(item.jumlah_pasang) || 3));
    const rawPoin = Number(item.poin ?? poinMap[String(no)]);
    const perlakuan: PerlakuanSoal | undefined =
      item.perlakuan === 'bonus' || item.perlakuan === 'anulir' ? item.perlakuan : undefined;

    const hydrated: SoalItem = {
      no,
      tipe: meta.kode,
      opsi: Array.isArray(item.opsi) && item.opsi.length > 0 ? item.opsi : [...meta.opsi],
      jawaban: item.jawaban ?? defaultJawaban(meta.kode, jp, jps),
      poin:
        perlakuan === 'anulir'
          ? 0
          : Number.isFinite(rawPoin) && rawPoin >= 0.05
            ? Math.round(rawPoin * 100) / 100
            : 1,
      ...(perlakuan ? { perlakuan } : {}),
    };
    if (meta.kode === 'multiple_true_false') hydrated.jumlah_pernyataan = jp;
    if (meta.kode === 'matching') hydrated.jumlah_pasang = jps;
    if (meta.kode === 'short_answer') {
      hydrated.panjang_jawaban = Math.max(3, Math.min(20, Number(item.panjang_jawaban) || 10));
    }
    return hydrated;
  });
}

/** Hitung total poin semua item aktif (soal dianulir tidak dihitung ke pembagi). */
export function calcTotalPoin(items: SoalItem[]): number {
  const sum = items.reduce(
    (acc, s) => acc + (s.perlakuan === 'anulir' ? 0 : Number(s.poin) || 0),
    0
  );
  return Math.round(sum * 100) / 100;
}

/** Cek apakah suatu butir soal sudah memiliki kunci jawaban valid. */
export function isSoalFilled(item: SoalItem): boolean {
  if (item.perlakuan === 'bonus' || item.perlakuan === 'anulir') return true;
  switch (item.tipe) {
    case 'single_choice':
    case 'single_choice_4':
    case 'true_false':
      return typeof item.jawaban === 'string' && item.jawaban.trim().length > 0;
    case 'multiple_select':
      return Array.isArray(item.jawaban) && item.jawaban.length > 0;
    case 'multiple_true_false':
      return Array.isArray(item.jawaban) && item.jawaban.length >= (item.jumlah_pernyataan || 3);
    case 'matching': {
      const need = item.jumlah_pasang || 3;
      const obj = item.jawaban && typeof item.jawaban === 'object' ? item.jawaban : {};
      for (let i = 1; i <= need; i++) {
        if (!obj[String(i)]) return false;
      }
      return true;
    }
    case 'short_answer':
      return typeof item.jawaban === 'string' && item.jawaban.trim().length > 0;
    case 'essay':
      return true;
  }
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Distribusikan bobot agar Total Nilai = 100 poin dengan presisi 2 desimal.
 * Menjaga keseragaman poin antar soal sejenis agar soal yang setara tidak timpang.
 */
export function autoScalePoinTo100(
  items: SoalItem[],
  mode: 'proportional' | 'equal' = 'proportional'
): SoalItem[] {
  const activeIndices = items
    .map((s, idx) => (s.perlakuan === 'anulir' ? -1 : idx))
    .filter((idx) => idx >= 0);

  const activeCount = activeIndices.length;
  if (activeCount === 0) return items;

  const activeWeights = activeIndices.map((idx) => Math.max(0.05, Number(items[idx].poin) || 1));
  const minW = Math.min(...activeWeights);
  const maxW = Math.max(...activeWeights);
  const allEqual = maxW - minW < 0.001;
  const totalCurrent = activeWeights.reduce((a, b) => a + b, 0);

  const result = items.map((s) => (s.perlakuan === 'anulir' ? { ...s, poin: 0 } : { ...s }));

  if (mode === 'equal' || allEqual || totalCurrent <= 0) {
    const base = Math.max(0.05, Math.floor((100 / activeCount) * 100) / 100);
    activeIndices.forEach((idx) => {
      result[idx].poin = base;
    });
    let diffCents = Math.round((100 - calcTotalPoin(result)) * 100);
    for (let k = activeIndices.length - 1; k >= 0 && diffCents > 0; k--) {
      const idx = activeIndices[k];
      result[idx].poin = round2(result[idx].poin + 0.01);
      diffCents--;
    }
    return result;
  }

  // Skala proporsional 2 desimal -> menjaga soal berbobot sama tetap identik
  activeIndices.forEach((idx, pos) => {
    const scaledVal = round2((activeWeights[pos] / totalCurrent) * 100);
    result[idx].poin = Math.max(0.05, scaledVal);
  });

  // Bila masih tersisa sen pembulatan, distribusikan merata ke grup bobot terbesar (misal Esai) dahulu
  let diffCents = Math.round((100 - calcTotalPoin(result)) * 100);
  if (diffCents !== 0) {
    const sortedActive = [...activeIndices].sort(
      (a, b) => result[b].poin - result[a].poin || b - a
    );
    let guard = 0;
    while (diffCents !== 0 && guard < 500) {
      for (const idx of sortedActive) {
        if (diffCents === 0) break;
        if (diffCents > 0) {
          result[idx].poin = round2(result[idx].poin + 0.01);
          diffCents--;
        } else if (result[idx].poin > 0.05) {
          result[idx].poin = round2(result[idx].poin - 0.01);
          diffCents++;
        }
      }
      guard++;
    }
  }

  return result;
}

/** Terapkan bobot poin kustom per masing-masing Tipe Soal AKM (bebas, tidak wajib total 100). */
export function applyWeightsByType(
  items: SoalItem[],
  weightsByTipe: Partial<Record<TipeSoalKode, number>>
): SoalItem[] {
  return items.map((s) => {
    if (s.perlakuan === 'anulir') return { ...s, poin: 0 };
    const val = weightsByTipe[s.tipe];
    if (val === undefined || !Number.isFinite(val)) return s;
    return { ...s, poin: Math.max(0.05, round2(val)) };
  });
}

/** Bagi bobot persentase (%) per Tipe Soal sehingga Total = 100 poin dan rata per tipe. */
export function applyPercentagesByType(
  items: SoalItem[],
  percentByTipe: Partial<Record<TipeSoalKode, number>>
): SoalItem[] {
  const activeByType = new Map<TipeSoalKode, number[]>();
  items.forEach((s, idx) => {
    if (s.perlakuan === 'anulir') return;
    const arr = activeByType.get(s.tipe) || [];
    arr.push(idx);
    activeByType.set(s.tipe, arr);
  });

  if (activeByType.size === 0) return items;

  let totalPct = 0;
  for (const tipe of activeByType.keys()) {
    totalPct += Math.max(0, Number(percentByTipe[tipe]) || 0);
  }
  if (totalPct <= 0) return autoScalePoinTo100(items, 'equal');

  const result = items.map((s) => (s.perlakuan === 'anulir' ? { ...s, poin: 0 } : { ...s }));

  for (const [tipe, idxs] of activeByType.entries()) {
    const pct = Math.max(0, Number(percentByTipe[tipe]) || 0);
    const groupTargetPoints = (pct / totalPct) * 100;
    const perItem = Math.max(0.05, round2(groupTargetPoints / idxs.length));
    idxs.forEach((idx) => {
      result[idx].poin = perItem;
    });
  }

  // Penyesuaian minimal bila ada pembulatan desimal berulang
  const activeIdxs = items
    .map((s, idx) => (s.perlakuan === 'anulir' ? -1 : idx))
    .filter((i) => i >= 0);
  let diffCents = Math.round((100 - calcTotalPoin(result)) * 100);
  if (diffCents !== 0 && activeIdxs.length > 0) {
    const sorted = [...activeIdxs].sort((a, b) => result[b].poin - result[a].poin || b - a);
    let guard = 0;
    while (diffCents !== 0 && guard < 500) {
      for (const idx of sorted) {
        if (diffCents === 0) break;
        if (diffCents > 0) {
          result[idx].poin = round2(result[idx].poin + 0.01);
          diffCents--;
        } else if (result[idx].poin > 0.05) {
          result[idx].poin = round2(result[idx].poin - 0.01);
          diffCents++;
        }
      }
      guard++;
    }
  }

  return result;
}

/** Ringkas grup tipe soal yang aktif beserta total poin & persentasenya. */
export function summarizeTypeGroups(items: SoalItem[]): TypeWeightSummary[] {
  const totalAll = calcTotalPoin(items);
  const byType = new Map<TipeSoalKode, { count: number; activeCount: number; totalPoin: number }>();

  items.forEach((s) => {
    const cur = byType.get(s.tipe) || { count: 0, activeCount: 0, totalPoin: 0 };
    cur.count++;
    if (s.perlakuan !== 'anulir') {
      cur.activeCount++;
      cur.totalPoin += Number(s.poin) || 0;
    }
    byType.set(s.tipe, cur);
  });

  return Array.from(byType.entries()).map(([kode, stat]) => {
    const meta = getTipeMeta(kode);
    const totalPoin = round2(stat.totalPoin);
    return {
      kode,
      label: meta.label,
      short: meta.short,
      color: meta.color,
      count: stat.count,
      activeCount: stat.activeCount,
      totalPoin,
      pctOfTotal: totalAll > 0 ? Math.round((totalPoin / totalAll) * 1000) / 10 : 0,
    };
  });
}

/** Terapkan bobot poin cepat berdasarkan kategori tipe soal (Objektif / Kompleks / Isian / Esai). */
export function applyWeightByCategory(
  items: SoalItem[],
  weights: Partial<Record<'objektif' | 'kompleks' | 'isian' | 'esai', number>>
): SoalItem[] {
  return items.map((s) => {
    if (s.perlakuan === 'anulir') return { ...s, poin: 0 };
    const meta = getTipeMeta(s.tipe);
    const val = weights[meta.kategori];
    if (val === undefined || !Number.isFinite(val)) return s;
    return { ...s, poin: Math.max(0.05, round2(val)) };
  });
}

/** Hitung keseimbangan distribusi opsi PG (A-E) & B/S untuk memeriksa kecenderungan kunci jawaban. */
export function computePgDistribution(items: SoalItem[]): PgDistributionStats {
  const counts: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const tfCounts: Record<'B' | 'S', number> = { B: 0, S: 0 };
  let totalPg = 0;
  let totalTf = 0;

  items.forEach((item) => {
    if (item.tipe === 'single_choice' || item.tipe === 'single_choice_4') {
      const ch = String(item.jawaban || '').toUpperCase().slice(0, 1);
      if (ch in counts) {
        counts[ch as keyof typeof counts]++;
        totalPg++;
      }
    } else if (item.tipe === 'true_false') {
      const tf = String(item.jawaban || '').toUpperCase().slice(0, 1);
      if (tf === 'B' || tf === 'S') {
        tfCounts[tf]++;
        totalTf++;
      }
    }
  });

  let dominantLetter: string | null = null;
  let maxCnt = 0;
  (['A', 'B', 'C', 'D', 'E'] as const).forEach((l) => {
    if (counts[l] > maxCnt) {
      maxCnt = counts[l];
      dominantLetter = l;
    }
  });
  const dominantPct = totalPg > 0 ? Math.round((maxCnt / totalPg) * 100) : 0;

  return { counts, tfCounts, totalPg, totalTf, dominantLetter, dominantPct };
}

/** Estimasi tata letak lembar LJK A4 real-time memakai mesin tata letak resmi. */
export function estimateLjkPreview(items: SoalItem[]): LjkEstimateSummary {
  const objectiveCount = items.filter((s) => s.tipe !== 'essay').length;
  const essayCount = items.filter((s) => s.tipe === 'essay').length;
  try {
    const layout = buildMachinePageLayout(items, items.length);
    const densityLabel =
      layout.density === 'normal'
        ? 'Lega & Nyaman'
        : layout.density === 'compact'
          ? 'Padat Rapi'
          : 'Sangat Padat';
    return {
      columns: layout.columns,
      density: layout.density,
      densityLabel,
      hasEssayArea: Boolean(layout.essayArea),
      objectiveCount,
      essayCount,
    };
  } catch {
    return {
      columns: objectiveCount > 20 ? 3 : 2,
      density: 'normal',
      densityLabel: 'Normal',
      hasEssayArea: essayCount > 0,
      objectiveCount,
      essayCount,
    };
  }
}

/** Parser Input Kilat: tempel teks kunci jawaban massal seperti "ABCDE ABCDE" atau "1. A 2. B". */
export function parseBulkKeyText(rawText: string, items: SoalItem[]): BulkParseResult {
  const trimmed = rawText.trim();
  if (!trimmed || items.length === 0) {
    return { updatedItems: items, appliedCount: 0, skippedCount: 0 };
  }

  const next = items.map((s) => ({ ...s }));
  const indexedMatches = [
    ...trimmed.matchAll(/(?:^|\n|\s)(\d{1,3})\s*[.):\-]\s*([^\n]+?)(?=(?:\s+\d{1,3}\s*[.):\-])|\n|$)/g),
  ];

  let applied = 0;
  let skipped = 0;

  if (indexedMatches.length >= 2) {
    for (const m of indexedMatches) {
      const no = Number(m[1]);
      const valRaw = (m[2] || '').trim();
      const targetIdx = next.findIndex((s) => s.no === no);
      if (targetIdx === -1) {
        skipped++;
        continue;
      }
      if (applyTokenToSoal(next, targetIdx, valRaw)) applied++;
      else skipped++;
    }
    return { updatedItems: next, appliedCount: applied, skippedCount: skipped };
  }

  const rawTokens = trimmed.includes('\n')
    ? trimmed.split(/\r?\n/).map((t) => t.trim()).filter(Boolean)
    : /[\s,;]+/.test(trimmed)
      ? trimmed.split(/[\s,;]+/).filter(Boolean)
      : trimmed.split('');

  for (let i = 0; i < rawTokens.length && i < next.length; i++) {
    if (applyTokenToSoal(next, i, rawTokens[i])) applied++;
    else skipped++;
  }

  return { updatedItems: next, appliedCount: applied, skippedCount: skipped };
}

function applyTokenToSoal(list: SoalItem[], idx: number, rawToken: string): boolean {
  const item = list[idx];
  const token = rawToken.trim();
  if (!token) return false;
  const upper = token.toUpperCase();

  if (item.tipe === 'single_choice' || item.tipe === 'single_choice_4') {
    const allowed = item.tipe === 'single_choice_4' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
    const ch = upper.replace(/[^A-E]/g, '').slice(0, 1);
    if (!allowed.includes(ch)) return false;
    list[idx] = { ...item, jawaban: ch };
    return true;
  }

  if (item.tipe === 'true_false') {
    const mapTF =
      upper === 'BENAR' || upper === 'TRUE' || upper === 'T'
        ? 'B'
        : upper === 'SALAH' || upper === 'FALSE' || upper === 'F'
          ? 'S'
          : upper.slice(0, 1);
    if (mapTF !== 'B' && mapTF !== 'S') return false;
    list[idx] = { ...item, jawaban: mapTF };
    return true;
  }

  if (item.tipe === 'multiple_select') {
    const letters = [...new Set(upper.replace(/[^A-E]/g, '').split(''))].sort();
    if (letters.length === 0) return false;
    list[idx] = { ...item, jawaban: letters };
    return true;
  }

  if (item.tipe === 'multiple_true_false') {
    const vals = upper.replace(/[^BS]/g, '').split('');
    if (vals.length < 2) return false;
    const clampedLen = Math.min(10, vals.length);
    list[idx] = { ...item, jumlah_pernyataan: clampedLen, jawaban: vals.slice(0, clampedLen) };
    return true;
  }

  if (item.tipe === 'matching') {
    const pairs = [...upper.matchAll(/(\d)\s*(?:->|→|:|-|=)?\s*([A-E])/g)];
    if (pairs.length >= 2) {
      const jps = Math.max(2, Math.min(5, pairs.length));
      const obj: Record<string, string> = {};
      pairs.slice(0, jps).forEach((p, k) => {
        obj[String(k + 1)] = p[2];
      });
      list[idx] = { ...item, jumlah_pasang: jps, jawaban: obj };
      return true;
    }
    const letters = upper.replace(/[^A-E]/g, '').split('');
    if (letters.length >= 2) {
      const jps = Math.min(5, letters.length);
      const obj: Record<string, string> = {};
      for (let i = 0; i < jps; i++) obj[String(i + 1)] = letters[i];
      list[idx] = { ...item, jumlah_pasang: jps, jawaban: obj };
      return true;
    }
    return false;
  }

  if (item.tipe === 'short_answer' || item.tipe === 'essay') {
    list[idx] = { ...item, jawaban: token };
    return true;
  }

  return false;
}

/** Resolve string/singkatan kode tipe soal (untuk impor Excel atau AI). */
export function resolveTipeFromAlias(raw: any): TipeSoalKode {
  const s = String(raw || '').trim();
  if (!s) return 'single_choice';
  const upper = s.toUpperCase();
  const aliasMap: Record<string, TipeSoalKode> = {
    'PG-E': 'single_choice',
    PG: 'single_choice',
    'PG-D': 'single_choice_4',
    PG4: 'single_choice_4',
    'B/S': 'true_false',
    BS: 'true_false',
    PGK: 'multiple_select',
    MTF: 'multiple_true_false',
    JDH: 'matching',
    MENJODOHKAN: 'matching',
    ISN: 'short_answer',
    ISIAN: 'short_answer',
    ESI: 'essay',
    ESAI: 'essay',
    URAIAN: 'essay',
  };
  if (aliasMap[upper]) return aliasMap[upper];
  return getTipeMeta(s).kode;
}

/** Unduh file Template Excel (.xlsx) resmi untuk impor kunci jawaban. */
export async function downloadKunciTemplateXlsx() {
  const wb = createWorkbook();
  const sheet = wb.addWorksheet('Template_Kunci');
  appendObjectRows(
    sheet,
    [
      { No: 1, Tipe: 'PG-E', Kunci_Jawaban: 'A', Poin: 2, Pernyataan_MTF: '', Pasang_JDH: '', Kotak_ISN: '' },
      { No: 2, Tipe: 'PG-E', Kunci_Jawaban: 'C', Poin: 2, Pernyataan_MTF: '', Pasang_JDH: '', Kotak_ISN: '' },
      { No: 3, Tipe: 'B/S', Kunci_Jawaban: 'B', Poin: 2, Pernyataan_MTF: '', Pasang_JDH: '', Kotak_ISN: '' },
      { No: 4, Tipe: 'PGK', Kunci_Jawaban: 'A, C', Poin: 4, Pernyataan_MTF: '', Pasang_JDH: '', Kotak_ISN: '' },
      { No: 5, Tipe: 'MTF', Kunci_Jawaban: 'BSB', Poin: 5, Pernyataan_MTF: 3, Pasang_JDH: '', Kotak_ISN: '' },
      { No: 6, Tipe: 'JDH', Kunci_Jawaban: '1-A 2-C 3-B', Poin: 5, Pernyataan_MTF: '', Pasang_JDH: 3, Kotak_ISN: '' },
      { No: 7, Tipe: 'ISN', Kunci_Jawaban: 'Soekarno | Ir. Soekarno', Poin: 5, Pernyataan_MTF: '', Pasang_JDH: '', Kotak_ISN: 12 },
      { No: 8, Tipe: 'ESI', Kunci_Jawaban: 'fotosintesis | klorofil', Poin: 10, Pernyataan_MTF: '', Pasang_JDH: '', Kotak_ISN: '' },
    ],
    { columnWidths: [8, 12, 28, 10, 16, 14, 14] }
  );

  const guide = wb.addWorksheet('Panduan_Kode');
  appendObjectRows(
    guide,
    TIPE_SOAL_AKM.map((t) => ({
      Kode_Singkat: t.short,
      Kode_Sistem: t.kode,
      Nama_Tipe: t.label,
      Contoh_Isi_Kunci: t.contoh,
      Keterangan: t.desc,
    })),
    { columnWidths: [14, 22, 26, 24, 48] }
  );

  await downloadWorkbook(wb, 'Template_Import_Kunci_WMVAA.xlsx');
}

/** Unduh 1 paket kunci jawaban lengkap (.xlsx) sebagai arsip pegangan guru/Wakakurikulum. */
export async function downloadSingleKunciXlsx(
  kunci: any,
  mapelLabel: string,
  kelasLabel: string
) {
  const wb = createWorkbook();
  const sheet = wb.addWorksheet('Kunci_Jawaban');
  const items = hydrateSoalItems(kunci);
  appendObjectRows(
    sheet,
    items.map((item) => {
      const meta = getTipeMeta(item.tipe);
      return {
        No: item.no,
        Kode_Tipe: meta.short,
        Tipe_Soal: meta.label,
        Kunci_Jawaban: formatJawaban(item),
        Bobot_Poin: item.poin,
      };
    }),
    { columnWidths: [8, 12, 28, 34, 14] }
  );

  const infoSheet = wb.addWorksheet('Info_Ujian');
  appendObjectRows(
    infoSheet,
    [
      { Field: 'ID Kunci', Nilai: kunci.id_kunci || '' },
      { Field: 'Judul Ujian', Nilai: kunci.judul_ujian || '' },
      { Field: 'Mata Pelajaran', Nilai: mapelLabel },
      { Field: 'Kelas', Nilai: kelasLabel },
      { Field: 'Jumlah Soal', Nilai: items.length },
      { Field: 'Total Poin', Nilai: calcTotalPoin(items) },
      { Field: 'Guru Pembuat', Nilai: kunci.nama_guru || kunci.id_guru || '' },
    ],
    { columnWidths: [20, 44] }
  );

  const safeName = String(kunci.judul_ujian || 'Kunci_Jawaban')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40);
  await downloadWorkbook(wb, `Kunci_${safeName}.xlsx`);
}

/** Impor daftar butir kunci jawaban dari file Excel (.xlsx). */
export async function importKunciFromXlsx(file: File): Promise<{
  items: SoalItem[];
  importedCount: number;
  skippedCount: number;
}> {
  const wb = await loadWorkbookFromFile(file);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('File Excel tidak memiliki lembar kerja.');

  const rows = worksheetToObjects(sheet);
  if (rows.length === 0) throw new Error('File Excel kosong atau header tidak ditemukan di baris 1.');

  const result: SoalItem[] = [];
  let skippedCount = 0;

  rows.slice(0, 100).forEach((row, idx) => {
    const keys = Object.keys(row);
    const pick = (patterns: RegExp[]) => {
      const matchKey = keys.find((k) => patterns.some((re) => re.test(k)));
      return matchKey ? row[matchKey] : undefined;
    };

    const rawNo = pick([/^no$/i, /nomor/i]);
    const rawTipe = pick([/^tipe/i, /jenis/i, /kode/i]);
    const rawAns = pick([/kunci/i, /jawaban/i, /ans/i]);
    const rawPoin = pick([/poin/i, /bobot/i, /skor/i]);
    const rawJp = pick([/pernyataan/i, /mtf/i]);
    const rawJps = pick([/pasang/i, /jdh/i]);
    const rawPj = pick([/kotak/i, /panjang/i, /isn/i]);

    const no = Number(rawNo) || idx + 1;
    const tipe = resolveTipeFromAlias(rawTipe);
    const parsedPoin = Number(rawPoin);
    const poin = Number.isFinite(parsedPoin) && parsedPoin >= 0.05 ? round2(parsedPoin) : 1;
    const item = buildSoalItem(no, tipe, poin);

    if (rawJp !== undefined && rawJp !== null && Number(rawJp) >= 2 && tipe === 'multiple_true_false') {
      item.jumlah_pernyataan = Math.min(10, Math.round(Number(rawJp)));
    }
    if (rawJps !== undefined && rawJps !== null && Number(rawJps) >= 2 && tipe === 'matching') {
      item.jumlah_pasang = Math.min(5, Math.round(Number(rawJps)));
    }
    if (rawPj !== undefined && rawPj !== null && Number(rawPj) >= 3 && tipe === 'short_answer') {
      item.panjang_jawaban = Math.min(20, Math.round(Number(rawPj)));
    }

    const ansStr = String(rawAns ?? '').trim();
    if (ansStr) {
      const tmp = [item];
      if (!applyTokenToSoal(tmp, 0, ansStr)) skippedCount++;
      else result.push(tmp[0]);
    } else if (tipe === 'essay') {
      result.push({ ...item, jawaban: '' });
    } else {
      result.push(item);
    }
  });

  if (result.length === 0) {
    throw new Error('Tidak ada baris butir soal yang berhasil diimpor dari file Excel tersebut.');
  }

  return {
    items: result.map((s, idx) => ({ ...s, no: idx + 1 })),
    importedCount: result.length,
    skippedCount,
  };
}

/** Hitung total soal dan total persentase dari CompositionConfig. */
export function getCompositionTotals(comp: CompositionConfig): {
  totalSoal: number;
  totalPct: number;
} {
  const totalSoal =
    (Math.max(0, Math.round(comp.pgCount)) || 0) +
    (Math.max(0, Math.round(comp.tfCount)) || 0) +
    (Math.max(0, Math.round(comp.pgkCount)) || 0) +
    (Math.max(0, Math.round(comp.mtfCount)) || 0) +
    (Math.max(0, Math.round(comp.jdhCount)) || 0) +
    (Math.max(0, Math.round(comp.isnCount)) || 0) +
    (Math.max(0, Math.round(comp.esiCount)) || 0);

  const rawPct =
    (comp.pgCount > 0 ? Math.max(0, Number(comp.pgPct) || 0) : 0) +
    (comp.tfCount > 0 ? Math.max(0, Number(comp.tfPct) || 0) : 0) +
    (comp.pgkCount > 0 ? Math.max(0, Number(comp.pgkPct) || 0) : 0) +
    (comp.mtfCount > 0 ? Math.max(0, Number(comp.mtfPct) || 0) : 0) +
    (comp.jdhCount > 0 ? Math.max(0, Number(comp.jdhPct) || 0) : 0) +
    (comp.isnCount > 0 ? Math.max(0, Number(comp.isnPct) || 0) : 0) +
    (comp.esiCount > 0 ? Math.max(0, Number(comp.esiPct) || 0) : 0);

  return { totalSoal, totalPct: Math.round(rawPct * 10) / 10 };
}

/** Cek apakah daftar item memiliki susunan tipe yang berselang-seling (mis. soal lama acak). */
export function hasInterleavedTypes(items: SoalItem[]): boolean {
  const seen = new Set<string>();
  let prev = '';
  for (const s of items) {
    const key = s.tipe === 'single_choice' || s.tipe === 'single_choice_4' ? 'PG' : s.tipe;
    if (key !== prev) {
      if (seen.has(key)) return true;
      seen.add(key);
      prev = key;
    }
  }
  return false;
}

/** Baca CompositionConfig dari daftar SoalItem yang sudah ada (saat mode Edit / Duplikat). */
export function extractCompositionFromItems(items: SoalItem[]): CompositionConfig {
  const totalPoin = calcTotalPoin(items);
  const pct = (sum: number) => (totalPoin > 0 ? Math.round((sum / totalPoin) * 1000) / 10 : 0);
  const sumActive = (arr: SoalItem[]) =>
    arr.reduce((a, x) => a + (x.perlakuan === 'anulir' ? 0 : Number(x.poin) || 0), 0);

  const pg5 = items.filter((s) => s.tipe === 'single_choice');
  const pg4 = items.filter((s) => s.tipe === 'single_choice_4');
  const pgAll = [...pg5, ...pg4];
  const tf = items.filter((s) => s.tipe === 'true_false');
  const pgk = items.filter((s) => s.tipe === 'multiple_select');
  const mtf = items.filter((s) => s.tipe === 'multiple_true_false');
  const jdh = items.filter((s) => s.tipe === 'matching');
  const isn = items.filter((s) => s.tipe === 'short_answer');
  const esi = items.filter((s) => s.tipe === 'essay');

  return {
    pgCount: pgAll.length,
    pgOpsi: pg4.length >= pg5.length && pg4.length > 0 ? '4' : '5',
    pgPct: pct(sumActive(pgAll)),
    tfCount: tf.length,
    tfPct: pct(sumActive(tf)),
    pgkCount: pgk.length,
    pgkPct: pct(sumActive(pgk)),
    mtfCount: mtf.length,
    mtfPct: pct(sumActive(mtf)),
    mtfPernyataan: mtf[0]?.jumlah_pernyataan || 3,
    jdhCount: jdh.length,
    jdhPct: pct(sumActive(jdh)),
    jdhPasang: jdh[0]?.jumlah_pasang || 3,
    isnCount: isn.length,
    isnPct: pct(sumActive(isn)),
    isnPanjang: isn[0]?.panjang_jawaban || 10,
    esiCount: esi.length,
    esiPct: pct(sumActive(esi)),
  };
}

/** Bagi bobot % otomatis hingga 100% sesuai jumlah masing-masing jenis (Esai/Kompleks sedikit lebih tinggi bila dicampur). */
export function autoDistributeCompositionPct(comp: CompositionConfig): CompositionConfig {
  const specs: Array<{ countKey: keyof CompositionConfig; pctKey: keyof CompositionConfig; factor: number }> = [
    { countKey: 'pgCount', pctKey: 'pgPct', factor: 1 },
    { countKey: 'tfCount', pctKey: 'tfPct', factor: 1 },
    { countKey: 'pgkCount', pctKey: 'pgkPct', factor: 1.5 },
    { countKey: 'mtfCount', pctKey: 'mtfPct', factor: 1.5 },
    { countKey: 'jdhCount', pctKey: 'jdhPct', factor: 1.5 },
    { countKey: 'isnCount', pctKey: 'isnPct', factor: 2 },
    { countKey: 'esiCount', pctKey: 'esiPct', factor: 3 },
  ];

  const active = specs.filter((s) => Number(comp[s.countKey]) > 0);
  if (active.length === 0) return comp;

  const next = { ...comp };
  let totalWeight = 0;
  active.forEach((s) => {
    totalWeight += Number(comp[s.countKey]) * s.factor;
  });

  let assigned = 0;
  active.forEach((s, idx) => {
    if (idx === active.length - 1) {
      (next[s.pctKey] as number) = Math.max(0, Math.round((100 - assigned) * 10) / 10);
    } else {
      const share = Math.round(((Number(comp[s.countKey]) * s.factor) / totalWeight) * 100);
      (next[s.pctKey] as number) = share;
      assigned += share;
    }
  });

  specs.filter((s) => Number(comp[s.countKey]) <= 0).forEach((s) => {
    (next[s.pctKey] as number) = 0;
  });

  return next;
}

/** Bangun array `SoalItem[]` berurutan dari konfigurasi Bank Soal, sambil menjaga jawaban yang sudah diisi guru! */
export function buildItemsFromComposition(
  comp: CompositionConfig,
  previousItems: SoalItem[] = []
): SoalItem[] {
  const poolByGroup: Record<string, SoalItem[]> = {
    PG: previousItems.filter((s) => s.tipe === 'single_choice' || s.tipe === 'single_choice_4'),
    TF: previousItems.filter((s) => s.tipe === 'true_false'),
    PGK: previousItems.filter((s) => s.tipe === 'multiple_select'),
    MTF: previousItems.filter((s) => s.tipe === 'multiple_true_false'),
    JDH: previousItems.filter((s) => s.tipe === 'matching'),
    ISN: previousItems.filter((s) => s.tipe === 'short_answer'),
    ESI: previousItems.filter((s) => s.tipe === 'essay'),
  };

  const pgTipe: TipeSoalKode = comp.pgOpsi === '4' ? 'single_choice_4' : 'single_choice';
  const blocks: Array<{
    groupKey: string;
    tipe: TipeSoalKode;
    count: number;
    totalPct: number;
    mtfPernyataan?: number;
    jdhPasang?: number;
    isnPanjang?: number;
  }> = [
    { groupKey: 'PG', tipe: pgTipe, count: Math.max(0, Math.round(comp.pgCount) || 0), totalPct: Number(comp.pgPct) || 0 },
    { groupKey: 'TF', tipe: 'true_false', count: Math.max(0, Math.round(comp.tfCount) || 0), totalPct: Number(comp.tfPct) || 0 },
    { groupKey: 'PGK', tipe: 'multiple_select', count: Math.max(0, Math.round(comp.pgkCount) || 0), totalPct: Number(comp.pgkPct) || 0 },
    {
      groupKey: 'MTF',
      tipe: 'multiple_true_false',
      count: Math.max(0, Math.round(comp.mtfCount) || 0),
      totalPct: Number(comp.mtfPct) || 0,
      mtfPernyataan: Math.max(2, Math.min(10, Math.round(comp.mtfPernyataan) || 3)),
    },
    {
      groupKey: 'JDH',
      tipe: 'matching',
      count: Math.max(0, Math.round(comp.jdhCount) || 0),
      totalPct: Number(comp.jdhPct) || 0,
      jdhPasang: Math.max(2, Math.min(5, Math.round(comp.jdhPasang) || 3)),
    },
    {
      groupKey: 'ISN',
      tipe: 'short_answer',
      count: Math.max(0, Math.round(comp.isnCount) || 0),
      totalPct: Number(comp.isnPct) || 0,
      isnPanjang: Math.max(3, Math.min(20, Math.round(comp.isnPanjang) || 10)),
    },
    { groupKey: 'ESI', tipe: 'essay', count: Math.max(0, Math.round(comp.esiCount) || 0), totalPct: Number(comp.esiPct) || 0 },
  ];

  const built: SoalItem[] = [];
  let currentNo = 1;

  for (const b of blocks) {
    if (b.count <= 0) continue;
    const prevPool = poolByGroup[b.groupKey] || [];
    const perItemPoin = b.totalPct > 0 ? Math.max(0.05, round2(b.totalPct / b.count)) : 1;

    for (let i = 0; i < b.count; i++) {
      if (currentNo > 100) break;
      const old = prevPool[i];
      const fresh = buildSoalItem(currentNo, b.tipe, perItemPoin);
      if (b.mtfPernyataan) {
        fresh.jumlah_pernyataan = b.mtfPernyataan;
        fresh.jawaban = defaultJawaban('multiple_true_false', b.mtfPernyataan);
      }
      if (b.jdhPasang) {
        fresh.jumlah_pasang = b.jdhPasang;
        fresh.jawaban = defaultJawaban('matching', 3, b.jdhPasang);
      }
      if (b.isnPanjang) {
        fresh.panjang_jawaban = b.isnPanjang;
      }

      if (old) {
        fresh.perlakuan = old.perlakuan;
        if (old.perlakuan === 'anulir') fresh.poin = 0;
        if (b.tipe === 'single_choice_4') {
          const ch = String(old.jawaban || '').toUpperCase();
          fresh.jawaban = ['A', 'B', 'C', 'D'].includes(ch) ? ch : '';
        } else if (old.tipe === b.tipe) {
          fresh.jawaban = old.jawaban;
          if (old.jumlah_pernyataan && b.mtfPernyataan === old.jumlah_pernyataan) {
            fresh.jumlah_pernyataan = old.jumlah_pernyataan;
          }
          if (old.jumlah_pasang && b.jdhPasang === old.jumlah_pasang) {
            fresh.jumlah_pasang = old.jumlah_pasang;
          }
          if (old.panjang_jawaban) fresh.panjang_jawaban = old.panjang_jawaban;
        }
      }

      built.push(fresh);
      currentNo++;
    }
  }

  const { totalPct } = getCompositionTotals(comp);
  if (built.length > 0 && Math.abs(totalPct - 100) < 0.05 && Math.abs(calcTotalPoin(built) - 100) >= 0.01) {
    return autoScalePoinTo100(built, 'proportional');
  }
  return built;
}

function csvCell(val: unknown): string {
  const s = String(val ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Unduh daftar kunci dalam format CSV ramah Microsoft Excel (UTF-8 BOM). */
export function downloadKunciCsv(
  list: any[],
  getMapelLabel: (id: string) => string,
  getKelasLabel: (id: string) => string
) {
  const header = [
    'ID Kunci',
    'Judul Ujian',
    'Mata Pelajaran',
    'Kelas',
    'Pembuat',
    'Jumlah Soal',
    'Total Poin',
    'Hasil Terkoreksi',
    'Komposisi Tipe',
  ];
  const rows = list.map((k) => {
    const items = parseDataJsonSafe(k.data_json);
    const tipeSet = [...new Set(items.map((x: any) => getTipeMeta(x.tipe).short))].join(' + ');
    const poinMap = parsePengaturanPoinSafe(k.pengaturan_poin);
    const totalPoin = items.reduce(
      (sum: number, x: any, idx: number) => sum + (Number(x.poin ?? poinMap[String(x.no || idx + 1)]) || 1),
      0
    );
    return [
      k.id_kunci,
      k.judul_ujian,
      getMapelLabel(k.id_mapel),
      getKelasLabel(k.id_kelas),
      k.nama_guru || k.id_guru || '',
      items.length,
      Math.round(totalPoin * 100) / 100,
      Number(k.hasil_count) || 0,
      tipeSet || 'PG',
    ]
      .map(csvCell)
      .join(',');
  });

  const csvContent = `\uFEFF${header.map(csvCell).join(',')}\r\n${rows.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Kunci_Jawaban_WMVAA_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Label tipe dominan untuk payload saveKunciAction. */
export function inferDominantTipe(items: SoalItem[]): string {
  if (items.length === 0) return 'single_choice';
  const distinct = [...new Set(items.map((s) => s.tipe))];
  if (distinct.length === 1) return distinct[0];
  return 'Campuran AKM';
}

/** Format timestamp ISO menjadi tanggal singkat Indonesia. */
export function formatTanggalSingkat(raw?: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export { TIPE_SOAL_AKM };
