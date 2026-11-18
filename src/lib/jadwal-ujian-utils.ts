export type JadwalUnit = 'SMP' | 'SMA';
export type JadwalSignerSource = 'SETTINGS_PANITIA' | 'SETTINGS_KEPSEK' | 'CUSTOM';

export interface JadwalSlot {
  id: string;
  type: 'EXAM' | 'BREAK';
  waktu: string;
  ket?: string;
  mapelByColumn: Record<string, string>;
}

export interface JadwalDay {
  id: string;
  hariTanggal: string;
  slots: JadwalSlot[];
}

export interface JadwalUjianUnitConfig {
  unit: JadwalUnit;
  judulUjian: string;
  subJudul: string;
  columns: string[];
  days: JadwalDay[];
  kotaTanggal: string;
  signerSource?: JadwalSignerSource;
  jabatanPenandatangan: string;
  namaPenandatangan: string;
  nipPenandatangan?: string;
  ttdUrl?: string;
  keteranganLines: string[];
}

export interface SimpleStudentJadwalRow {
  id: string;
  hariTanggal: string;
  mapel: string;
  waktu: string;
}

export function getDefaultJadwalUnitConfig(
  unit: JadwalUnit,
  settings: Record<string, string> = {},
  tahunAjaran: string = '2026/2027',
  semester: string = 'GANJIL'
): JadwalUjianUnitConfig {
  const semUpper = String(semester || 'GANJIL').trim().toUpperCase();
  const isGenap = semUpper === 'GENAP' || semUpper === '2';
  const semNumber = isGenap ? '2' : '1';
  const tahunDash = String(tahunAjaran || '2026/2027').replace(/\//g, '-');
  const judulDefault = isGenap
    ? 'JADWAL SUMATIF AKHIR TAHUN (SAT)'
    : 'JADWAL SUMATIF AKHIR SEMESTER (SAS)';
  const subJudulDefault = `TAHUN PELAJARAN ${tahunDash} | SEMESTER ${semNumber}`;

  const prefix = unit.toLowerCase();
  const kota = settings['kota_sekolah'] || 'Sogokmo';
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const panitiaNama =
    settings[`${prefix}_panitia_nama`] ||
    (unit === 'SMP' ? 'Linda Wetapo, S.E' : 'Linda Wetapo, S.E');
  const panitiaTtd = settings[`${prefix}_panitia_ttd_url`] || '';

  const defaultKeterangan = [
    'Semua siswa/i wajib ada di sekolah 15 menit sebelum ujian',
    'Pengawas yang bertugas, wajib ada di sekolah 15 menit sebelum ujian',
  ];

  if (unit === 'SMP') {
    const col1 = 'KELAS VII';
    const col2 = 'KELAS VIII - IX';
    return {
      unit: 'SMP',
      judulUjian: judulDefault,
      subJudul: subJudulDefault,
      columns: [col1, col2],
      days: [
        {
          id: 'smp-day-1',
          hariTanggal: 'Senin, 23 November 2026',
          slots: [
            {
              id: 'smp-d1-s1',
              type: 'EXAM',
              waktu: '07.30-08.30',
              ket: '',
              mapelByColumn: { [col1]: 'Pend. Agama', [col2]: 'Pend. Agama' },
            },
            {
              id: 'smp-d1-s2',
              type: 'EXAM',
              waktu: '08.30-09.30',
              ket: '',
              mapelByColumn: { [col1]: 'Bahasa Indonesia', [col2]: 'Bahasa Indonesia' },
            },
            {
              id: 'smp-d1-b1',
              type: 'BREAK',
              waktu: '09.30-09.50',
              ket: '',
              mapelByColumn: {},
            },
            {
              id: 'smp-d1-s3',
              type: 'EXAM',
              waktu: '09.50-10.50',
              ket: '',
              mapelByColumn: {
                [col1]: 'Seni Budaya & Prakarya',
                [col2]: 'Seni Budaya & Prakarya',
              },
            },
          ],
        },
        {
          id: 'smp-day-2',
          hariTanggal: 'Selasa, 24 November 2026',
          slots: [
            {
              id: 'smp-d2-s1',
              type: 'EXAM',
              waktu: '07.30-08.30',
              ket: '',
              mapelByColumn: { [col1]: 'Matematika', [col2]: 'Matematika' },
            },
            {
              id: 'smp-d2-s2',
              type: 'EXAM',
              waktu: '08.30-09.30',
              ket: '',
              mapelByColumn: { [col1]: 'PPKn', [col2]: 'PPKn' },
            },
            {
              id: 'smp-d2-b1',
              type: 'BREAK',
              waktu: '09.30-09.50',
              ket: '',
              mapelByColumn: {},
            },
            {
              id: 'smp-d2-s3',
              type: 'EXAM',
              waktu: '09.50-10.50',
              ket: '',
              mapelByColumn: { [col1]: 'Bahasa Inggris', [col2]: 'Bahasa Inggris' },
            },
          ],
        },
        {
          id: 'smp-day-3',
          hariTanggal: 'Rabu, 25 November 2026',
          slots: [
            {
              id: 'smp-d3-s1',
              type: 'EXAM',
              waktu: '07.30-08.30',
              ket: '',
              mapelByColumn: { [col1]: 'IPS', [col2]: 'IPS' },
            },
            {
              id: 'smp-d3-s2',
              type: 'EXAM',
              waktu: '08.30-09.30',
              ket: '',
              mapelByColumn: { [col1]: 'PJOK', [col2]: 'PJOK' },
            },
            {
              id: 'smp-d3-b1',
              type: 'BREAK',
              waktu: '09.30-09.50',
              ket: '',
              mapelByColumn: {},
            },
            {
              id: 'smp-d3-s3',
              type: 'EXAM',
              waktu: '09.50-10.50',
              ket: '',
              mapelByColumn: { [col1]: 'Pathfinder', [col2]: 'Pathfinder' },
            },
          ],
        },
        {
          id: 'smp-day-4',
          hariTanggal: 'Kamis, 26 November 2026',
          slots: [
            {
              id: 'smp-d4-s1',
              type: 'EXAM',
              waktu: '07.30-08.30',
              ket: '',
              mapelByColumn: { [col1]: 'IPA', [col2]: 'IPA' },
            },
            {
              id: 'smp-d4-s2',
              type: 'EXAM',
              waktu: '08.30-09.30',
              ket: '',
              mapelByColumn: { [col1]: 'Informatika', [col2]: 'Informatika' },
            },
            {
              id: 'smp-d4-b1',
              type: 'BREAK',
              waktu: '09.30-09.50',
              ket: '',
              mapelByColumn: {},
            },
            {
              id: 'smp-d4-s3',
              type: 'EXAM',
              waktu: '09.50-10.50',
              ket: '',
              mapelByColumn: { [col1]: 'Kesehatan', [col2]: 'Kesehatan' },
            },
          ],
        },
        {
          id: 'smp-day-5',
          hariTanggal: 'Jumat, 27 November 2026',
          slots: [
            {
              id: 'smp-d5-s1',
              type: 'EXAM',
              waktu: '07.30-08.30',
              ket: '',
              mapelByColumn: { [col1]: 'Coding & AI', [col2]: 'Coding & AI' },
            },
          ],
        },
      ],
      kotaTanggal: `${kota}, ${todayStr}`,
      signerSource: 'SETTINGS_PANITIA',
      jabatanPenandatangan: 'Ketua Panitia',
      namaPenandatangan: panitiaNama,
      nipPenandatangan: settings[`${prefix}_panitia_nip`] || '',
      ttdUrl: panitiaTtd,
      keteranganLines: defaultKeterangan,
    };
  }

  // Unit SMA (3 Kolom Tingkat: KELAS X | KELAS XI | KELAS XII)
  const colX = 'KELAS X';
  const colXI = 'KELAS XI';
  const colXII = 'KELAS XII';
  return {
    unit: 'SMA',
    judulUjian: judulDefault,
    subJudul: subJudulDefault,
    columns: [colX, colXI, colXII],
    days: [
      {
        id: 'sma-day-1',
        hariTanggal: 'Senin, 23 November 2026',
        slots: [
          {
            id: 'sma-d1-s1',
            type: 'EXAM',
            waktu: '07.30-08.30',
            ket: '',
            mapelByColumn: { [colX]: 'Agama', [colXI]: 'Agama', [colXII]: 'Agama' },
          },
          {
            id: 'sma-d1-s2',
            type: 'EXAM',
            waktu: '08.30-09.30',
            ket: '',
            mapelByColumn: {
              [colX]: 'Bahasa Indonesia',
              [colXI]: 'Bahasa Indonesia',
              [colXII]: 'Bahasa Indonesia',
            },
          },
          {
            id: 'sma-d1-b1',
            type: 'BREAK',
            waktu: '09.30-09.50',
            ket: '',
            mapelByColumn: {},
          },
          {
            id: 'sma-d1-s3',
            type: 'EXAM',
            waktu: '09.50-10.50',
            ket: '',
            mapelByColumn: {
              [colX]: 'Seni Budaya & Prakarya',
              [colXI]: 'Seni & Budaya',
              [colXII]: 'Seni & Budaya',
            },
          },
          {
            id: 'sma-d1-s4',
            type: 'EXAM',
            waktu: '10.50-11.50',
            ket: '',
            mapelByColumn: { [colX]: '-', [colXI]: 'Ekonomi', [colXII]: 'Ekonomi' },
          },
        ],
      },
      {
        id: 'sma-day-2',
        hariTanggal: 'Selasa, 24 November 2026',
        slots: [
          {
            id: 'sma-d2-s1',
            type: 'EXAM',
            waktu: '07.30-08.30',
            ket: '',
            mapelByColumn: { [colX]: 'Matematika', [colXI]: 'Matematika', [colXII]: 'Matematika' },
          },
          {
            id: 'sma-d2-s2',
            type: 'EXAM',
            waktu: '08.30-09.30',
            ket: '',
            mapelByColumn: { [colX]: 'PKN', [colXI]: 'PKN', [colXII]: 'PKN' },
          },
          {
            id: 'sma-d2-b1',
            type: 'BREAK',
            waktu: '09.30-09.50',
            ket: '',
            mapelByColumn: {},
          },
          {
            id: 'sma-d2-s3',
            type: 'EXAM',
            waktu: '09.50-10.50',
            ket: '',
            mapelByColumn: {
              [colX]: 'Bahasa Inggris',
              [colXI]: 'Bahasa Inggris',
              [colXII]: 'Bahasa Inggris',
            },
          },
        ],
      },
      {
        id: 'sma-day-3',
        hariTanggal: 'Rabu, 25 November 2026',
        slots: [
          {
            id: 'sma-d3-s1',
            type: 'EXAM',
            waktu: '07.30-08.30',
            ket: '',
            mapelByColumn: { [colX]: 'IPS', [colXI]: 'Sejarah', [colXII]: 'Sejarah' },
          },
          {
            id: 'sma-d3-s2',
            type: 'EXAM',
            waktu: '08.30-09.30',
            ket: '',
            mapelByColumn: { [colX]: 'PJOK', [colXI]: 'PJOK', [colXII]: 'PJOK' },
          },
          {
            id: 'sma-d3-b1',
            type: 'BREAK',
            waktu: '09.30-09.50',
            ket: '',
            mapelByColumn: {},
          },
          {
            id: 'sma-d3-s3',
            type: 'EXAM',
            waktu: '09.50-10.50',
            ket: '',
            mapelByColumn: { [colX]: 'Pathfinder', [colXI]: 'Pathfinder', [colXII]: 'Pathfinder' },
          },
          {
            id: 'sma-d3-s4',
            type: 'EXAM',
            waktu: '10.50-11.50',
            ket: '',
            mapelByColumn: { [colX]: '-', [colXI]: '-', [colXII]: 'Sosiologi' },
          },
        ],
      },
      {
        id: 'sma-day-4',
        hariTanggal: 'Kamis, 26 November 2026',
        slots: [
          {
            id: 'sma-d4-s1',
            type: 'EXAM',
            waktu: '07.30-08.30',
            ket: '',
            mapelByColumn: { [colX]: 'IPA', [colXI]: 'Biologi', [colXII]: 'Biologi' },
          },
          {
            id: 'sma-d4-s2',
            type: 'EXAM',
            waktu: '08.30-09.30',
            ket: '',
            mapelByColumn: { [colX]: 'Informatika', [colXI]: 'Informatika', [colXII]: 'Informatika' },
          },
          {
            id: 'sma-d4-b1',
            type: 'BREAK',
            waktu: '09.30-09.50',
            ket: '',
            mapelByColumn: {},
          },
          {
            id: 'sma-d4-s3',
            type: 'EXAM',
            waktu: '09.50-10.50',
            ket: '',
            mapelByColumn: { [colX]: 'Kesehatan', [colXI]: 'Kesehatan', [colXII]: 'Kesehatan' },
          },
        ],
      },
      {
        id: 'sma-day-5',
        hariTanggal: 'Jumat, 27 November 2026',
        slots: [
          {
            id: 'sma-d5-s1',
            type: 'EXAM',
            waktu: '07.30-08.30',
            ket: '',
            mapelByColumn: { [colX]: 'Coding & AI', [colXI]: 'Coding & AI', [colXII]: 'Coding & AI' },
          },
          {
            id: 'sma-d5-s2',
            type: 'EXAM',
            waktu: '08.30-09.30',
            ket: '',
            mapelByColumn: { [colX]: 'Fisika', [colXI]: 'Fisika', [colXII]: 'Fisika' },
          },
          {
            id: 'sma-d5-b1',
            type: 'BREAK',
            waktu: '09.30-09.50',
            ket: '',
            mapelByColumn: {},
          },
          {
            id: 'sma-d5-s3',
            type: 'EXAM',
            waktu: '09.50-10.50',
            ket: '',
            mapelByColumn: { [colX]: '-', [colXI]: 'KIMIA', [colXII]: 'KIMIA' },
          },
        ],
      },
    ],
    kotaTanggal: `${kota}, ${todayStr}`,
    signerSource: 'SETTINGS_PANITIA',
    jabatanPenandatangan: 'Ketua Panitia',
    namaPenandatangan: panitiaNama,
    nipPenandatangan: settings[`${prefix}_panitia_nip`] || '',
    ttdUrl: panitiaTtd,
    keteranganLines: defaultKeterangan,
  };
}

export function parseJadwalUnitFromSettings(
  unit: JadwalUnit,
  settings: Record<string, string> = {},
  tahunAjaran?: string,
  semester?: string
): JadwalUjianUnitConfig {
  const defaults = getDefaultJadwalUnitConfig(
    unit,
    settings,
    tahunAjaran || settings['tahun_ajaran'] || '2026/2027',
    semester || settings['semester'] || 'GANJIL'
  );
  const key = unit === 'SMP' ? 'jadwal_ujian_smp_json' : 'jadwal_ujian_sma_json';
  const raw = settings[key];
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const columns =
      Array.isArray(parsed.columns) && parsed.columns.length > 0
        ? parsed.columns.map((c: any) => String(c || '').trim()).filter(Boolean)
        : defaults.columns;

    const days: JadwalDay[] = Array.isArray(parsed.days)
      ? parsed.days.map((d: any, dIdx: number) => ({
          id: String(d?.id || `day-${dIdx + 1}`),
          hariTanggal: String(d?.hariTanggal || ''),
          slots: Array.isArray(d?.slots)
            ? d.slots.map((s: any, sIdx: number) => ({
                id: String(s?.id || `slot-${dIdx + 1}-${sIdx + 1}`),
                type: s?.type === 'BREAK' ? 'BREAK' : 'EXAM',
                waktu: String(s?.waktu || ''),
                ket: String(s?.ket || ''),
                mapelByColumn:
                  s?.mapelByColumn && typeof s.mapelByColumn === 'object'
                    ? Object.fromEntries(
                        Object.entries(s.mapelByColumn).map(([k, v]) => [k, String(v ?? '')])
                      )
                    : {},
              }))
            : [],
        }))
      : defaults.days;

    const rawSigner = String(parsed.signerSource || '').toUpperCase();
    const signerSource: JadwalSignerSource =
      rawSigner === 'SETTINGS_KEPSEK'
        ? 'SETTINGS_KEPSEK'
        : rawSigner === 'CUSTOM'
          ? 'CUSTOM'
          : 'SETTINGS_PANITIA';

    return {
      unit,
      judulUjian: String(parsed.judulUjian || defaults.judulUjian),
      subJudul: String(parsed.subJudul || defaults.subJudul),
      columns,
      days,
      kotaTanggal: String(parsed.kotaTanggal || defaults.kotaTanggal),
      signerSource,
      jabatanPenandatangan: String(parsed.jabatanPenandatangan || defaults.jabatanPenandatangan),
      namaPenandatangan: String(parsed.namaPenandatangan || defaults.namaPenandatangan),
      nipPenandatangan: String(parsed.nipPenandatangan ?? defaults.nipPenandatangan ?? ''),
      ttdUrl: String(parsed.ttdUrl || '').trim() || defaults.ttdUrl,
      keteranganLines: Array.isArray(parsed.keteranganLines)
        ? parsed.keteranganLines.map((l: any) => String(l ?? '')).filter(Boolean)
        : defaults.keteranganLines,
    };
  } catch {
    return defaults;
  }
}

/**
 * Mengambil identitas penandatangan aktif yang terintegrasi dengan Pengaturan Sekolah.
 * Jika signerSource !== 'CUSTOM', selalu mengambil Nama, NIP, dan TTD terbaru dari SETTINGS.
 */
export function resolveJadwalSigner(
  config: JadwalUjianUnitConfig,
  settings: Record<string, string> = {}
): {
  jabatan: string;
  nama: string;
  nip: string;
  ttdUrl: string;
  source: JadwalSignerSource;
} {
  const prefix = config.unit === 'SMP' ? 'smp' : 'sma';
  const source: JadwalSignerSource = config.signerSource || 'SETTINGS_PANITIA';

  if (source === 'SETTINGS_PANITIA') {
    return {
      source,
      jabatan: config.jabatanPenandatangan || 'Ketua Panitia',
      nama: settings[`${prefix}_panitia_nama`] || config.namaPenandatangan || 'Ketua Panitia',
      nip: settings[`${prefix}_panitia_nip`] ?? config.nipPenandatangan ?? '',
      ttdUrl: settings[`${prefix}_panitia_ttd_url`] || config.ttdUrl || '',
    };
  }

  if (source === 'SETTINGS_KEPSEK') {
    return {
      source,
      jabatan:
        config.jabatanPenandatangan && config.jabatanPenandatangan !== 'Ketua Panitia'
          ? config.jabatanPenandatangan
          : 'Kepala Sekolah',
      nama: settings[`${prefix}_kepsek_nama`] || config.namaPenandatangan || 'Kepala Sekolah',
      nip: settings[`${prefix}_kepsek_nip`] ?? config.nipPenandatangan ?? '',
      ttdUrl: settings[`${prefix}_kepsek_ttd_url`] || config.ttdUrl || '',
    };
  }

  return {
    source,
    jabatan: config.jabatanPenandatangan || 'Ketua Panitia',
    nama: config.namaPenandatangan || '',
    nip: config.nipPenandatangan || '',
    ttdUrl: config.ttdUrl || '',
  };
}

/**
 * Mencocokkan kolom jadwal yang paling tepat untuk nama kelas siswa
 * (mis. "KELAS IX" -> "KELAS VIII - IX", "KELAS X" -> "KELAS X").
 */
export function resolveMatchingScheduleColumn(
  namaKelas: string,
  columns: string[]
): string | null {
  if (!columns || columns.length === 0) return null;
  const rawUpper = String(namaKelas || '').toUpperCase().trim();

  // Ekstrak token tingkat kelas (XII, XI, X, IX, VIII, VII, 12, 11, 10, 9, 8, 7)
  const levelMatch = rawUpper.match(/\b(XII|XI|IX|VIII|VII|X|12|11|10|9|8|7)\b/);
  const levelToken = levelMatch ? levelMatch[1] : '';
  const arabicToRoman: Record<string, string> = {
    '7': 'VII',
    '8': 'VIII',
    '9': 'IX',
    '10': 'X',
    '11': 'XI',
    '12': 'XII',
  };
  const romanLevel = arabicToRoman[levelToken] || levelToken;

  if (romanLevel) {
    // 1. Exact/boundary match in column name (perhatikan urutan XI/XII vs X dan VIII vs VII)
    for (const col of columns) {
      const tokens = col.toUpperCase().match(/\b(XII|XI|IX|VIII|VII|X|12|11|10|9|8|7)\b/g) || [];
      const normalizedTokens = tokens.map((t) => arabicToRoman[t] || t);
      if (normalizedTokens.includes(romanLevel)) {
        return col;
      }
    }
  }

  return columns[0];
}

/**
 * Mengubah matriks Jadwal Ujian SMP/SMA menjadi daftar jadwal ringkas khusus
 * untuk satu siswa (menyaring baris Istirahat dan mapel kosong "-").
 */
export function extractStudentScheduleFromMaster(
  namaKelas: string,
  jenjang: 'SMP' | 'SMA',
  master: { SMP?: JadwalUjianUnitConfig; SMA?: JadwalUjianUnitConfig }
): SimpleStudentJadwalRow[] {
  const unitConfig = jenjang === 'SMP' ? master.SMP : master.SMA;
  if (!unitConfig || !Array.isArray(unitConfig.days)) return [];

  const targetCol = resolveMatchingScheduleColumn(namaKelas, unitConfig.columns);
  if (!targetCol) return [];

  const rows: SimpleStudentJadwalRow[] = [];
  for (const day of unitConfig.days) {
    for (const slot of day.slots || []) {
      if (slot.type === 'BREAK') continue;
      const mapel = String(slot.mapelByColumn?.[targetCol] || '').trim();
      if (!mapel || mapel === '-' || mapel === '—') continue;
      rows.push({
        id: `${day.id}-${slot.id}`,
        hariTanggal: day.hariTanggal,
        mapel,
        waktu: slot.waktu,
      });
    }
  }
  return rows;
}
