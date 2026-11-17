// lib/constants/tipe-soal.ts
// Definisi 8 Tipe Soal AKM & Standar Asesmen (kompatibel LJK Hybrid OMR & AI)

export const TIPE_SOAL_AKM = [
  {
    kode: 'single_choice',
    label: 'Pilihan Ganda (A–E)',
    short: 'PG-E',
    opsi: ['A', 'B', 'C', 'D', 'E'],
    color: 'indigo',
    kategori: 'objektif',
    desc: 'Pilihan ganda 5 opsi (A sampai E), standar SMA/SMK/MA.',
    contoh: 'A / B / C / D / E',
  },
  {
    kode: 'single_choice_4',
    label: 'Pilihan Ganda (A–D)',
    short: 'PG-D',
    opsi: ['A', 'B', 'C', 'D'],
    color: 'violet',
    kategori: 'objektif',
    desc: 'Pilihan ganda 4 opsi (A sampai D), standar SD/SMP/MTs.',
    contoh: 'A / B / C / D',
  },
  {
    kode: 'true_false',
    label: 'Benar / Salah',
    short: 'B/S',
    opsi: ['B', 'S'],
    color: 'teal',
    kategori: 'objektif',
    desc: 'Satu pernyataan dengan pilihan Benar (B) atau Salah (S).',
    contoh: 'B atau S',
  },
  {
    kode: 'multiple_select',
    label: 'Pilihan Ganda Kompleks',
    short: 'PGK',
    opsi: ['A', 'B', 'C', 'D', 'E'],
    color: 'sky',
    kategori: 'kompleks',
    desc: 'Lebih dari 1 jawaban benar dalam satu soal AKM.',
    contoh: 'A, C, E',
  },
  {
    kode: 'multiple_true_false',
    label: 'Benar-Salah Majemuk (MTF)',
    short: 'MTF',
    opsi: [],
    color: 'cyan',
    kategori: 'kompleks',
    desc: '2–10 sub-pernyataan Benar/Salah dalam satu nomor soal.',
    contoh: 'B, S, B',
  },
  {
    kode: 'matching',
    label: 'Menjodohkan',
    short: 'JDH',
    opsi: [],
    color: 'amber',
    kategori: 'kompleks',
    desc: 'Pasangkan 2–5 item kiri (1–5) ke jawaban kanan (A–E).',
    contoh: '1→A, 2→C, 3→B',
  },
  {
    kode: 'short_answer',
    label: 'Isian Singkat',
    short: 'ISN',
    opsi: [],
    color: 'orange',
    kategori: 'isian',
    desc: 'Jawaban kata/angka singkat. Pisahkan sinonim dengan tanda |',
    contoh: 'Soekarno | Ir. Soekarno',
  },
  {
    kode: 'essay',
    label: 'Uraian (Esai)',
    short: 'ESI',
    opsi: [],
    color: 'rose',
    kategori: 'esai',
    desc: 'Dinilai AI dari kata kunci rubrik atau input nilai manual guru.',
    contoh: 'kata kunci | manual',
  },
] as const;

export type TipeSoalMeta = (typeof TIPE_SOAL_AKM)[number];

/** Cari metadata tipe soal berdasarkan kode standar atau alias lama. */
export function getTipeMeta(kode?: string | null): TipeSoalMeta {
  const normalized =
    kode === 'A-E'
      ? 'single_choice'
      : kode === 'A-D'
        ? 'single_choice_4'
        : kode === 'Benar-Salah'
          ? 'true_false'
          : kode;
  return TIPE_SOAL_AKM.find((t) => t.kode === normalized) ?? TIPE_SOAL_AKM[0];
}

export type TipeSoalKode = typeof TIPE_SOAL_AKM[number]['kode'];

export const TIPE_COLOR: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  teal:   'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
  sky:    'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  cyan:   'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  amber:  'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  rose:   'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

/** Format jawaban untuk tampilan ringkas */
export function formatJawaban(item: any): string {
  if (!item) return '—';
  const jwb = item.jawaban;
  if (jwb === null || jwb === undefined) return '—';
  if (Array.isArray(jwb)) return jwb.join(', ');
  if (typeof jwb === 'object') return Object.entries(jwb).map(([k, v]) => `${k}→${v}`).join(', ');
  return String(jwb);
}

/** Hitung distribusi tipe soal dari data_json */
export function getTipeDistribusi(dataJson: any[]): Record<string, number> {
  const dist: Record<string, number> = {};
  (dataJson || []).forEach(item => {
    const t = item.tipe || 'single_choice';
    dist[t] = (dist[t] || 0) + 1;
  });
  return dist;
}

/** Resolve tipe dari kunci jawaban (baru atau legacy) */
export function resolveTipe(kunciItem: any): string {
  if (kunciItem?.tipe) return kunciItem.tipe;
  // Legacy: field tipe_soal level atas
  return 'single_choice';
}
