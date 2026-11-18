export type KartuSignerMode = 'PANITIA' | 'KEPALA';
export type KartuRoomMode = 'DEFAULT' | 'PER_KELAS' | 'AUTO_CAPACITY';
export type KartuLayoutMode = 'FRONT_ONLY' | 'BACK_ONLY' | 'FRONT_BACK_JADWAL';
export type KartuThemeMode = 'AUTO_JENJANG' | 'NAVY_BLUE' | 'MAROON';
export type KartuRowDensity = 3 | 4; // 3 rows = 86mm tall cards (6/A4), 4 rows = 64mm tall cards (8/A4 or 4 pairs/A4)

export interface KartuScheduleRow {
  id: string;
  hariTanggal: string;
  mapel: string;
  waktu: string;
}

export interface KartuScheduleNumberedItem extends KartuScheduleRow {
  noUrut: number;
}

export interface KartuScheduleDayGroup {
  key: string;
  hariTanggal: string;
  dayName: string;
  dateLabel: string;
  items: KartuScheduleNumberedItem[];
}

export interface KartuPesertaConfig {
  judulUjian: string; // e.g. "SAS (Sumatif Akhir Semester)"
  kurikulumLabel: string; // e.g. "Kurikulum Merdeka"
  prefixNomor: string; // e.g. "2026-SAS-"
  kopYayasan: string; // empty = otomatis mengikuti Pengaturan Sekolah
  kopAkademi: string; // empty = otomatis mengikuti Pengaturan Sekolah
  kopNamaSekolah: string; // empty = otomatis per unit SMP/SMA dari Pengaturan Sekolah
  kopAlamat: string; // empty = otomatis mengikuti Pengaturan Sekolah
  kotaCetak: string; // empty = otomatis mengikuti Pengaturan Sekolah (kota_sekolah)
  roomMode: KartuRoomMode;
  ruangDefault: string;
  kapasitasRuang: number;
  tanggalCetak: string;
  signerMode: KartuSignerMode;
  layoutMode: KartuLayoutMode;
  backMirrorDuplex: boolean;
  themeMode: KartuThemeMode;
  rowsPerPage: KartuRowDensity;
  showInitialsBadge: boolean;
  portalEnabled: boolean;
  portalShowScore: boolean;
  publicBaseUrl: string; // empty = otomatis deteksi domain / origin aktif + basePath
  qrTokenEpoch: number;
  jadwalSource: 'MASTER_JADWAL' | 'CUSTOM';
  jadwalRows: KartuScheduleRow[];
}

export interface KartuStudentOverride {
  noAbsen?: string;
  noPeserta?: string;
  ruang?: string;
  meja?: string;
}

export interface KartuStudentItem {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
  nama_kelas: string;
  jenjang: 'SMP' | 'SMA';
  tahun_ajaran?: string;
  semester?: string;
}

export interface CardThemePalette {
  variant: 'NAVY_BLUE' | 'MAROON';
  primaryDark: string;
  primaryMid: string;
  goldAccent: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  mountainFillTop: string;
  mountainFillBack: string;
  mountainFillBottom: string;
  tableHeaderBg: string;
  tableStripeBg: string;
}

export interface ResolvedKartuMeta {
  noAbsen: string;
  noPeserta: string;
  ruang: string;
  meja: string;
  initials: string;
  qrPayload: string;
  theme: CardThemePalette;
  avatarColors: {
    bg: string;
    text: string;
  };
}

export const NAVY_CARD_THEME: CardThemePalette = {
  variant: 'NAVY_BLUE',
  primaryDark: '#122c55',
  primaryMid: '#1e40af',
  goldAccent: '#d4a017',
  pillBg: '#eff6ff',
  pillBorder: '#93c5fd',
  pillText: '#1e3a8a',
  mountainFillTop: '#dbeafe',
  mountainFillBack: '#93c5fd',
  mountainFillBottom: '#1d4ed8',
  tableHeaderBg: '#122c55',
  tableStripeBg: '#f8fafc',
};

export const MAROON_CARD_THEME: CardThemePalette = {
  variant: 'MAROON',
  primaryDark: '#6f1426',
  primaryMid: '#9f1239',
  goldAccent: '#d99b26',
  pillBg: '#fff1f2',
  pillBorder: '#fda4af',
  pillText: '#881337',
  mountainFillTop: '#ffe4e6',
  mountainFillBack: '#fda4af',
  mountainFillBottom: '#881337',
  tableHeaderBg: '#6f1426',
  tableStripeBg: '#fff8f8',
};

export function formatIndonesianDate(date: Date = new Date()): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function parseWaktuStartMinutes(waktu: string): number {
  const m = String(waktu || '').match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return Number.POSITIVE_INFINITY;
  return h * 60 + min;
}

function splitHariTanggalParts(raw: string): { dayName: string; dateLabel: string } {
  const clean = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { dayName: '-', dateLabel: '' };
  const commaIdx = clean.indexOf(',');
  if (commaIdx > 0) {
    return {
      dayName: clean.slice(0, commaIdx).trim(),
      dateLabel: clean.slice(commaIdx + 1).trim(),
    };
  }
  return { dayName: clean, dateLabel: '' };
}

/**
 * Mengelompokkan jadwal berdasarkan hari & tanggal agar tanggal yang sama
 * tidak ditulis berulang (digabung menjadi 1 sel merge), serta mengurutkan
 * mata pelajaran per hari dengan nomor urut (1, 2, 3...).
 */
export function groupScheduleRowsByDay(rows: KartuScheduleRow[]): KartuScheduleDayGroup[] {
  const buckets = new Map<
    string,
    { hariTanggal: string; entries: Array<{ row: KartuScheduleRow; origIdx: number }> }
  >();

  rows.forEach((row, origIdx) => {
    const displayHari = String(row.hariTanggal || '').trim().replace(/\s+/g, ' ') || '-';
    const key = displayHari.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.entries.push({ row, origIdx });
    } else {
      buckets.set(key, { hariTanggal: displayHari, entries: [{ row, origIdx }] });
    }
  });

  const groups: KartuScheduleDayGroup[] = [];
  buckets.forEach((bucket, key) => {
    const sorted = [...bucket.entries].sort((a, b) => {
      const diff = parseWaktuStartMinutes(a.row.waktu) - parseWaktuStartMinutes(b.row.waktu);
      return diff !== 0 ? diff : a.origIdx - b.origIdx;
    });
    const { dayName, dateLabel } = splitHariTanggalParts(bucket.hariTanggal);
    groups.push({
      key,
      hariTanggal: bucket.hariTanggal,
      dayName,
      dateLabel,
      items: sorted.map(({ row }, idx) => ({
        ...row,
        noUrut: idx + 1,
      })),
    });
  });

  return groups;
}

/**
 * Membagi grup jadwal ke kolom kiri & kanan pada layout 2 kolom
 * di batas pergantian hari agar sel merge hari/tanggal tidak terpotong.
 */
export function splitDayGroupsBalanced(groups: KartuScheduleDayGroup[]): {
  leftGroups: KartuScheduleDayGroup[];
  rightGroups: KartuScheduleDayGroup[];
} {
  if (groups.length === 0) return { leftGroups: [], rightGroups: [] };
  if (groups.length === 1) {
    const only = groups[0];
    if (only.items.length <= 1) return { leftGroups: groups, rightGroups: [] };
    const mid = Math.ceil(only.items.length / 2);
    return {
      leftGroups: [{ ...only, key: `${only.key}-l`, items: only.items.slice(0, mid) }],
      rightGroups: [{ ...only, key: `${only.key}-r`, items: only.items.slice(mid) }],
    };
  }

  const total = groups.reduce((acc, g) => acc + g.items.length, 0);
  let bestIdx = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  let running = 0;

  for (let i = 0; i < groups.length - 1; i++) {
    running += groups[i].items.length;
    const right = total - running;
    const diff = Math.abs(running - right);
    // Prefer left >= right on exact ties so left column is balanced cleanly
    if (diff < bestDiff || (diff === bestDiff && running >= right)) {
      bestDiff = diff;
      bestIdx = i + 1;
    }
  }

  return {
    leftGroups: groups.slice(0, bestIdx),
    rightGroups: groups.slice(bestIdx),
  };
}

export function getDefaultScheduleRows(mapelSuggestions: string[] = []): KartuScheduleRow[] {
  const defaultMapels =
    mapelSuggestions.length >= 3
      ? mapelSuggestions.slice(0, 5)
      : ['Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'Pendidikan Agama', 'IPA / IPAS'];

  const slots = [
    { hari: 'Senin, Hari ke-1', waktu: '08.00 – 09.30' },
    { hari: 'Senin, Hari ke-1', waktu: '10.00 – 11.30' },
    { hari: 'Selasa, Hari ke-2', waktu: '08.00 – 09.30' },
    { hari: 'Selasa, Hari ke-2', waktu: '10.00 – 11.30' },
    { hari: 'Rabu, Hari ke-3', waktu: '08.00 – 09.30' },
  ];

  return defaultMapels.map((mapel, idx) => ({
    id: `sch-${idx + 1}`,
    hariTanggal: slots[idx % slots.length].hari,
    mapel,
    waktu: slots[idx % slots.length].waktu,
  }));
}

export function getDefaultKartuConfig(
  semester: string = 'GANJIL',
  tahunAjaran: string = '2026/2027',
  mapelSuggestions: string[] = []
): KartuPesertaConfig {
  const semUpper = String(semester || 'GANJIL').trim().toUpperCase();
  const yearToken = String(tahunAjaran || '2026/2027').split('/')[0]?.trim() || '2026';

  return {
    judulUjian:
      semUpper === 'GENAP'
        ? 'SAT (Sumatif Akhir Tahun)'
        : 'SAS (Sumatif Akhir Semester)',
    kurikulumLabel: 'Kurikulum Merdeka',
    prefixNomor: `${yearToken}-${semUpper === 'GENAP' ? 'SAT' : 'SAS'}-`,
    kopYayasan: '',
    kopAkademi: '',
    kopNamaSekolah: '',
    kopAlamat: '',
    kotaCetak: '',
    roomMode: 'PER_KELAS',
    ruangDefault: 'R. 01',
    kapasitasRuang: 24,
    tanggalCetak: formatIndonesianDate(),
    signerMode: 'PANITIA',
    layoutMode: 'FRONT_ONLY',
    backMirrorDuplex: true,
    themeMode: 'AUTO_JENJANG',
    rowsPerPage: 4,
    showInitialsBadge: true,
    portalEnabled: true,
    portalShowScore: true,
    publicBaseUrl: '',
    qrTokenEpoch: 1,
    jadwalSource: 'MASTER_JADWAL',
    jadwalRows: getDefaultScheduleRows(mapelSuggestions),
  };
}

export function parseKartuConfigFromSettings(
  settings: Record<string, string> = {},
  semester?: string,
  tahunAjaran?: string,
  mapelSuggestions: string[] = []
): KartuPesertaConfig {
  const defaults = getDefaultKartuConfig(
    semester || settings['semester'] || 'GANJIL',
    tahunAjaran || settings['tahun_ajaran'] || '2026/2027',
    mapelSuggestions
  );

  const rowsRaw = Number(settings['kartu_rows_per_page']);
  const capacityRaw = Number(settings['kartu_kapasitas_ruang']);
  const roomModeRaw = String(settings['kartu_room_mode'] || '').toUpperCase();
  const signerRaw = String(settings['kartu_signer_mode'] || '').toUpperCase();
  const layoutRaw = String(settings['kartu_layout_mode'] || '').toUpperCase();
  const themeRaw = String(settings['kartu_theme_mode'] || '').toUpperCase();

  let parsedJadwal: KartuScheduleRow[] = defaults.jadwalRows;
  if (settings['kartu_jadwal_json']) {
    try {
      const rawArr = JSON.parse(settings['kartu_jadwal_json']);
      if (Array.isArray(rawArr) && rawArr.length > 0) {
        parsedJadwal = rawArr.map((item: any, idx: number) => ({
          id: String(item?.id || `sch-${idx + 1}`),
          hariTanggal: String(item?.hariTanggal || ''),
          mapel: String(item?.mapel || ''),
          waktu: String(item?.waktu || ''),
        }));
      }
    } catch {
      // Keep default schedule rows if malformed
    }
  }

  return {
    judulUjian: settings['kartu_judul_ujian'] || defaults.judulUjian,
    kurikulumLabel: settings['kartu_kurikulum_label'] || defaults.kurikulumLabel,
    prefixNomor: settings['kartu_prefix_nomor'] ?? defaults.prefixNomor,
    kopYayasan:
      settings['kartu_kop_yayasan'] ||
      settings['nama_yayasan'] ||
      'YAYASAN PENDIDIKAN ADVENT PAPUA',
    kopAkademi:
      settings['kartu_kop_akademi'] ||
      settings['sma_nama_sekolah_1'] ||
      settings['smp_nama_sekolah_1'] ||
      settings['nama_sekolah_1'] ||
      'Wamena Mountain View Adventist Academy',
    kopNamaSekolah: settings['kartu_kop_nama_sekolah'] ?? '',
    kopAlamat:
      settings['kartu_kop_alamat'] ||
      settings['alamat_sekolah'] ||
      'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya',
    kotaCetak: settings['kartu_kota_cetak'] || settings['kota_sekolah'] || 'Wamena',
    roomMode:
      roomModeRaw === 'DEFAULT' || roomModeRaw === 'PER_KELAS' || roomModeRaw === 'AUTO_CAPACITY'
        ? (roomModeRaw as KartuRoomMode)
        : defaults.roomMode,
    ruangDefault: settings['kartu_ruang_default'] || defaults.ruangDefault,
    kapasitasRuang:
      Number.isFinite(capacityRaw) && capacityRaw >= 5 && capacityRaw <= 100
        ? capacityRaw
        : defaults.kapasitasRuang,
    tanggalCetak: settings['kartu_tanggal_cetak'] || defaults.tanggalCetak,
    signerMode: signerRaw === 'KEPALA' ? 'KEPALA' : 'PANITIA',
    layoutMode:
      layoutRaw === 'FRONT_ONLY' || layoutRaw === 'BACK_ONLY' || layoutRaw === 'FRONT_BACK_JADWAL'
        ? (layoutRaw as KartuLayoutMode)
        : defaults.layoutMode,
    backMirrorDuplex:
      settings['kartu_back_mirror_duplex'] !== undefined
        ? String(settings['kartu_back_mirror_duplex']).trim().toLowerCase() !== 'false'
        : defaults.backMirrorDuplex,
    themeMode:
      themeRaw === 'AUTO_JENJANG' || themeRaw === 'NAVY_BLUE' || themeRaw === 'MAROON'
        ? (themeRaw as KartuThemeMode)
        : defaults.themeMode,
    rowsPerPage: rowsRaw === 3 ? 3 : 4,
    showInitialsBadge:
      settings['kartu_show_initials'] !== undefined
        ? String(settings['kartu_show_initials']).trim().toLowerCase() !== 'false'
        : defaults.showInitialsBadge,
    portalEnabled:
      settings['kartu_portal_enabled'] !== undefined
        ? String(settings['kartu_portal_enabled']).trim().toLowerCase() !== 'false'
        : defaults.portalEnabled,
    portalShowScore:
      settings['kartu_portal_show_score'] !== undefined
        ? String(settings['kartu_portal_show_score']).trim().toLowerCase() !== 'false'
        : defaults.portalShowScore,
    publicBaseUrl: settings['kartu_public_base_url'] ?? '',
    qrTokenEpoch: Math.max(1, Number(settings['kartu_qr_token_epoch']) || 1),
    jadwalSource:
      String(settings['kartu_jadwal_source'] || '').toUpperCase() === 'CUSTOM'
        ? 'CUSTOM'
        : 'MASTER_JADWAL',
    jadwalRows: parsedJadwal,
  };
}

export function parseKartuOverridesFromSettings(
  settings: Record<string, string> = {}
): Record<string, KartuStudentOverride> {
  const raw = settings['kartu_overrides_json'];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, KartuStudentOverride>;
    }
  } catch {
    // Ignore malformed JSON
  }
  return {};
}

export function serializeKartuConfigToSettings(
  config: KartuPesertaConfig,
  overrides: Record<string, KartuStudentOverride> = {}
): Record<string, string> {
  const cleanOverrides: Record<string, KartuStudentOverride> = {};
  for (const [id, ov] of Object.entries(overrides)) {
    if (!ov) continue;
    const cleaned: KartuStudentOverride = {};
    if (ov.noAbsen?.trim()) cleaned.noAbsen = ov.noAbsen.trim();
    if (ov.noPeserta?.trim()) cleaned.noPeserta = ov.noPeserta.trim();
    if (ov.ruang?.trim()) cleaned.ruang = ov.ruang.trim();
    if (ov.meja?.trim()) cleaned.meja = ov.meja.trim();
    if (cleaned.noAbsen || cleaned.noPeserta || cleaned.ruang || cleaned.meja) {
      cleanOverrides[id] = cleaned;
    }
  }

  const cleanJadwal = (config.jadwalRows || [])
    .filter((r) => r.hariTanggal.trim() || r.mapel.trim() || r.waktu.trim())
    .map((r, idx) => ({
      id: r.id || `sch-${idx + 1}`,
      hariTanggal: r.hariTanggal.trim(),
      mapel: r.mapel.trim(),
      waktu: r.waktu.trim(),
    }));

  return {
    kartu_judul_ujian: config.judulUjian.trim(),
    kartu_kurikulum_label: config.kurikulumLabel.trim() || 'Kurikulum Merdeka',
    kartu_prefix_nomor: config.prefixNomor.trim(),
    kartu_kop_yayasan: config.kopYayasan.trim(),
    kartu_kop_akademi: config.kopAkademi.trim(),
    kartu_kop_nama_sekolah: config.kopNamaSekolah.trim(),
    kartu_kop_alamat: config.kopAlamat.trim(),
    kartu_kota_cetak: config.kotaCetak.trim(),
    kartu_room_mode: config.roomMode,
    kartu_ruang_default: config.ruangDefault.trim() || 'R. 01',
    kartu_kapasitas_ruang: String(Math.max(5, Math.min(100, Number(config.kapasitasRuang) || 24))),
    kartu_tanggal_cetak: config.tanggalCetak.trim() || formatIndonesianDate(),
    kartu_signer_mode: config.signerMode,
    kartu_layout_mode: config.layoutMode,
    kartu_back_mirror_duplex: String(config.backMirrorDuplex),
    kartu_theme_mode: config.themeMode,
    kartu_rows_per_page: String(config.rowsPerPage === 3 ? 3 : 4),
    kartu_show_initials: String(config.showInitialsBadge),
    kartu_portal_enabled: String(config.portalEnabled),
    kartu_portal_show_score: String(config.portalShowScore),
    kartu_public_base_url: normalizePortalBaseUrl(config.publicBaseUrl),
    kartu_qr_token_epoch: String(Math.max(1, Number(config.qrTokenEpoch) || 1)),
    kartu_jadwal_source: config.jadwalSource === 'CUSTOM' ? 'CUSTOM' : 'MASTER_JADWAL',
    kartu_jadwal_json: JSON.stringify(cleanJadwal),
    kartu_overrides_json: JSON.stringify(cleanOverrides),
  };
}

export function normalizePortalBaseUrl(rawUrl?: string): string {
  const clean = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (!/^https?:\/\//i.test(clean)) {
    return `https://${clean}`;
  }
  return clean;
}

export function getStudentInitials(nama: string): string {
  const words = String(nama || '')
    .trim()
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'PS';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function getCardTheme(jenjang: 'SMP' | 'SMA', themeMode: KartuThemeMode): CardThemePalette {
  if (themeMode === 'NAVY_BLUE') return NAVY_CARD_THEME;
  if (themeMode === 'MAROON') return MAROON_CARD_THEME;
  return jenjang === 'SMP' ? NAVY_CARD_THEME : MAROON_CARD_THEME;
}

/**
 * Menghitung nomor urut / absen siswa secara deterministik di dalam kelasnya masing-masing (01, 02, ...).
 */
export function buildClassAbsenMap(students: KartuStudentItem[]): Record<string, number> {
  const counters = new Map<string, number>();
  const result: Record<string, number> = {};
  students.forEach((s) => {
    const klsKey = String(s.id_kelas || s.nama_kelas || 'DEFAULT').trim();
    const nextNum = (counters.get(klsKey) || 0) + 1;
    counters.set(klsKey, nextNum);
    result[s.id_siswa] = nextNum;
  });
  return result;
}

export function resolveParticipantMeta(
  student: KartuStudentItem,
  indexInList: number,
  config: KartuPesertaConfig,
  overrides: Record<string, KartuStudentOverride> = {},
  classAbsenMap: Record<string, number> = {},
  settings: Record<string, string> = {},
  academicSession?: { tahunAjaran: string; semester: string },
  portalUrl?: string
): ResolvedKartuMeta {
  const ov = overrides[student.id_siswa] || {};
  const absenNum = classAbsenMap[student.id_siswa] ?? indexInList + 1;
  const noAbsen = ov.noAbsen?.trim() || String(absenNum).padStart(2, '0');

  const seqStr = String(indexInList + 1).padStart(3, '0');
  const nisToken = String(student.nis || seqStr).trim();
  const autoNomor = `${student.jenjang}-${config.prefixNomor}${nisToken || seqStr}`;
  const noPeserta = ov.noPeserta?.trim() || autoNomor;

  let computedRuang = config.ruangDefault || 'R. 01';
  let computedMejaNum = indexInList + 1;
  if (config.roomMode === 'PER_KELAS') {
    const kls = String(student.nama_kelas || '').trim();
    computedRuang = kls ? `R. ${kls}` : computedRuang;
    computedMejaNum = absenNum;
  } else if (config.roomMode === 'AUTO_CAPACITY') {
    const cap = Math.max(5, Number(config.kapasitasRuang) || 24);
    const roomNum = Math.floor(indexInList / cap) + 1;
    computedRuang = `R. ${String(roomNum).padStart(2, '0')}`;
    computedMejaNum = (indexInList % cap) + 1;
  }

  const ruang = ov.ruang?.trim() || computedRuang;
  const meja = ov.meja?.trim() || String(computedMejaNum).padStart(2, '0');
  const initials = getStudentInitials(student.nama);
  const theme = getCardTheme(student.jenjang, config.themeMode);

  const prefix = student.jenjang === 'SMP' ? 'smp_' : 'sma_';
  const sekolahName =
    config.kopNamaSekolah?.trim() ||
    settings[prefix + 'nama_sekolah_2'] ||
    settings['nama_sekolah_2'] ||
    (student.jenjang === 'SMP' ? 'SMP Advent Sogokmo' : 'SMA Advent Sogokmo');
  const taText =
    academicSession?.tahunAjaran ||
    student.tahun_ajaran ||
    settings['tahun_ajaran'] ||
    '2026/2027';
  const semText =
    academicSession?.semester ||
    student.semester ||
    settings['semester'] ||
    'GANJIL';

  const textVerificationPayload = [
    `PESERTA RESMI ${config.judulUjian}`,
    sekolahName,
    `Tahun Ajaran ${taText} (${semText})`,
    '',
    `Nama        : ${student.nama}`,
    `No. Urut    : ${noAbsen} (Meja ${meja})`,
    `No. Peserta : ${noPeserta}`,
    `NIS         : ${student.nis || '-'}`,
    `Kelas       : ${student.nama_kelas} (${student.jenjang})`,
    `Ruang Ujian : ${ruang}`,
    '',
    'Status      : Aktif (Terverifikasi)',
  ].join('\n');

  const qrPayload =
    config.portalEnabled && portalUrl ? portalUrl : textVerificationPayload;

  return {
    noAbsen,
    noPeserta,
    ruang,
    meja,
    initials,
    qrPayload,
    theme,
    avatarColors: {
      bg: `linear-gradient(135deg, ${theme.primaryDark} 0%, ${theme.primaryMid} 100%)`,
      text: '#ffffff',
    },
  };
}
