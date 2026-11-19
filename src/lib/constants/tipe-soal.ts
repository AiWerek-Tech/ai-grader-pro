// lib/constants/tipe-soal.ts
// Definisi 9 Tipe Soal AKM & Standar Asesmen (kompatibel LJK Hybrid OMR & AI)

export const MATCHING_SINGLE_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
] as const;

export function buildMatchingSingleOptions(count = 10): string[] {
  const safeCount = Math.max(5, Math.min(MATCHING_SINGLE_LETTERS.length, Math.round(Number(count) || 10)));
  return MATCHING_SINGLE_LETTERS.slice(0, safeCount) as unknown as string[];
}

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
    label: 'Menjodohkan Matriks (AKM)',
    short: 'JDH',
    opsi: [],
    color: 'amber',
    kategori: 'kompleks',
    desc: 'Pasangkan 2–5 item kiri (1–5) ke jawaban kanan (A–E) dalam 1 nomor.',
    contoh: '1→A, 2→C, 3→B',
  },
  {
    kode: 'matching_single',
    label: 'Menjodohkan 1-ke-1 (A–J)',
    short: 'JDH-1',
    opsi: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    color: 'amber',
    kategori: 'objektif',
    desc: '1 nomor = 1 huruf jawaban dari daftar pilihan bersama (A–E s.d. A–L).',
    contoh: 'J / F / H',
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
          : kode === 'JDH-1' || kode === 'JDH1' || kode === 'MENJODOHKAN_TUNGGAL'
            ? 'matching_single'
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
  if (Array.isArray(jwb)) return jwb.length > 0 ? jwb.join(', ') : '—';
  if (typeof jwb === 'object') {
    const entries = Object.entries(jwb);
    return entries.length > 0 ? entries.map(([k, v]) => `${k}→${v}`).join(', ') : '—';
  }
  const str = String(jwb).trim();
  return str || '—';
}

/** Jenis Asesmen resmi Kurikulum Merdeka (Kemendikbudristek) + Umum Sekolah */
export const JENIS_ASESMEN_KM = [
  { kode: 'STS', label: 'Asesmen Sumatif Tengah Semester (STS)', kategori: 'Sumatif', desc: 'Evaluasi tengah semester (pengganti PTS/UTS).' },
  { kode: 'SAS', label: 'Asesmen Sumatif Akhir Semester (SAS)', kategori: 'Sumatif', desc: 'Evaluasi akhir semester ganjil (pengganti PAS).' },
  { kode: 'SAT', label: 'Asesmen Sumatif Akhir Tahun (SAT)', kategori: 'Sumatif', desc: 'Evaluasi akhir semester genap / kenaikan kelas (pengganti PAT).' },
  { kode: 'SUMATIF_LM', label: 'Asesmen Sumatif Lingkup Materi', kategori: 'Sumatif', desc: 'Penilaian sumatif setelah selesai 1 bab atau lingkup materi.' },
  { kode: 'FORMATIF', label: 'Asesmen Formatif (Ulangan Harian / Kuis)', kategori: 'Formatif', desc: 'Pemantauan proses belajar selama pembelajaran berlangsung.' },
  { kode: 'DIAGNOSTIK_KOG', label: 'Asesmen Diagnostik Kognitif', kategori: 'Diagnostik', desc: 'Pemetaan kemampuan prasyarat siswa di awal bab/topik.' },
  { kode: 'DIAGNOSTIK_NON', label: 'Asesmen Diagnostik Non-Kognitif', kategori: 'Diagnostik', desc: 'Pemetaan kesiapan psikologis, minat, dan gaya belajar siswa.' },
  { kode: 'ASAJ', label: 'Asesmen Sumatif Akhir Jenjang (ASAJ / US)', kategori: 'Sumatif', desc: 'Ujian kelulusan akhir jenjang kelas VI / IX / XII.' },
  { kode: 'TRYOUT', label: 'Try Out / Simulasi Asesmen (ANBK / TKA)', kategori: 'Simulasi', desc: 'Latihan terstandar persiapan ANBK, TKA, atau seleksi masuk.' },
  { kode: 'KUSTOM', label: 'Lainnya (Ketik Judul Manual)', kategori: 'Kustom', desc: 'Masukkan judul asesmen secara bebas (mis. Remedial / Lomba).' },
] as const;

export type JenisAsesmenKode = (typeof JENIS_ASESMEN_KM)[number]['kode'];

export const SEMESTER_OPTIONS = [
  { value: 'GANJIL' as const, label: 'Semester Ganjil (1)' },
  { value: 'GENAP' as const, label: 'Semester Genap (2)' },
] as const;

export type SemesterKode = 'GANJIL' | 'GENAP';

/** Susun judul ujian standar otomatis dari pilihan Jenis Asesmen, Semester, dan Keterangan opsional. */
export function composeJudulAsesmen(
  jenisKode: JenisAsesmenKode,
  semester: SemesterKode,
  keterangan = '',
  customJudul = ''
): string {
  if (jenisKode === 'KUSTOM') {
    return customJudul.trim();
  }
  const found = JENIS_ASESMEN_KM.find((j) => j.kode === jenisKode) ?? JENIS_ASESMEN_KM[0];
  const semText = semester === 'GENAP' ? 'Semester Genap' : 'Semester Ganjil';
  const note = keterangan.trim();
  const base = `${found.label} — ${semText}`;
  return note ? `${base} (${note})` : base;
}

/** Deteksi jenis asesmen dari kode tersimpan atau judul ujian lama. */
export function detectJenisAsesmen(
  judul?: string | null,
  savedKode?: string | null
): { kode: JenisAsesmenKode; keterangan: string } {
  if (savedKode && JENIS_ASESMEN_KM.some((j) => j.kode === savedKode)) {
    const jKode = savedKode as JenisAsesmenKode;
    if (jKode !== 'KUSTOM' && judul) {
      const m = judul.match(/\(([^()]+)\)\s*$/);
      const foundLabel = JENIS_ASESMEN_KM.find((j) => j.kode === jKode)?.label || '';
      const maybeKeterangan =
        m && !foundLabel.includes(`(${m[1]})`) ? m[1] : '';
      return { kode: jKode, keterangan: maybeKeterangan };
    }
    return { kode: jKode, keterangan: '' };
  }
  return { kode: 'KUSTOM', keterangan: '' };
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
