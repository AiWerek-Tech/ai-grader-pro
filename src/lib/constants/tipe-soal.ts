// lib/constants/tipe-soal.ts
// Definisi 7 Tipe Soal AKM berdasarkan Panduan Soal AKM.md

export const TIPE_SOAL_AKM = [
  { kode: 'single_choice',       label: 'Pilihan Ganda (A–E)',         short: 'PG-E', opsi: ['A','B','C','D','E'], color: 'indigo' },
  { kode: 'single_choice_4',    label: 'Pilihan Ganda (A–D)',         short: 'PG-D', opsi: ['A','B','C','D'],     color: 'violet' },
  { kode: 'true_false',         label: 'Benar / Salah',               short: 'B/S',  opsi: ['B','S'],             color: 'teal'   },
  { kode: 'multiple_select',    label: 'Pilihan Ganda Kompleks',      short: 'PGK',  opsi: ['A','B','C','D','E'], color: 'sky'    },
  { kode: 'multiple_true_false',label: 'Benar-Salah Majemuk (MTF)',   short: 'MTF',  opsi: [],                    color: 'cyan'   },
  { kode: 'matching',           label: 'Menjodohkan',                 short: 'JDH',  opsi: [],                    color: 'amber'  },
  { kode: 'short_answer',       label: 'Isian Singkat',               short: 'ISN',  opsi: [],                    color: 'orange' },
  { kode: 'essay',              label: 'Uraian (Esai)',               short: 'ESI',  opsi: [],                    color: 'rose'   },
] as const;

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
