export type TagihanKategori = 'SALDO_AWAL' | 'SPP' | 'UJIAN' | 'ASRAMA' | 'LAINNYA';
export type TagihanStatus = 'BELUM_BAYAR' | 'CICILAN' | 'LUNAS';
export type MetodePembayaran = 'TUNAI' | 'TRANSFER' | 'LAINNYA';
export type TransaksiStatus = 'VALID' | 'BATAL';

export type ExamClearanceStatus =
  | 'LUNAS'
  | 'MEMENUHI_SYARAT'
  | 'DISPENSASI'
  | 'BELUM_LAYAK'
  | 'BELUM_ADA_TAGIHAN';

export const TAGIHAN_HEADERS = [
  'id_tagihan',
  'id_siswa',
  'tahun_ajaran',
  'semester',
  'kategori',
  'periode_bulan',
  'nama_tagihan',
  'nominal',
  'potongan',
  'nominal_akhir',
  'terbayar',
  'status',
  'jatuh_tempo',
  'catatan',
  'updated_at',
];

export const PEMBAYARAN_HEADERS = [
  'id_pembayaran',
  'no_kwitansi',
  'id_tagihan',
  'id_siswa',
  'tanggal_bayar',
  'nominal_bayar',
  'metode',
  'status_transaksi',
  'id_petugas',
  'nama_petugas',
  'catatan',
  'timestamp',
];

export interface TagihanRecord {
  id_tagihan: string;
  id_siswa: string;
  tahun_ajaran: string;
  semester: string;
  kategori: TagihanKategori;
  periode_bulan: string; // e.g. '2026-07' or 'UJIAN-SAS'
  nama_tagihan: string;
  nominal: number;
  potongan: number;
  nominal_akhir: number;
  terbayar: number;
  status: TagihanStatus;
  jatuh_tempo: string;
  catatan: string;
  updated_at: string;
}

export interface PembayaranRecord {
  id_pembayaran: string;
  no_kwitansi: string;
  id_tagihan: string;
  id_siswa: string;
  tanggal_bayar: string; // YYYY-MM-DD
  nominal_bayar: number;
  metode: MetodePembayaran;
  status_transaksi: TransaksiStatus;
  id_petugas: string;
  nama_petugas: string;
  catatan: string;
  timestamp: string;
}

export interface StudentDispensasi {
  alasan: string;
  berlakuSampai?: string; // YYYY-MM-DD
  oleh: string;
  createdAt: string;
}

export interface KeuanganConfig {
  /** Tarif default bulanan SMP — fleksibel diisi bendahara (0 = belum diset) */
  tarifSppSmp: number;
  /** Tarif default bulanan SMA — fleksibel diisi bendahara (0 = belum diset) */
  tarifSppSma: number;
  /** Ambang minimal persentase terbayar agar layak cetak kartu ujian (default 50%) */
  minPercentForExamCard: number;
  /** Aktifkan kunci cetak kartu ujian untuk siswa di bawah ambang batas */
  enforceOnKartuPeserta: boolean;
  /** Daftar periode_bulan yang menjadi syarat ujian; kosong = seluruh tagihan semester aktif */
  examRequiredPeriods: string[];
  /** Bendahara tunggal (1 orang untuk SMP & SMA) */
  bendaharaNama: string;
  bendaharaNip: string;
  bendaharaJabatan: string;
  bendaharaTtdUrl: string;
  rekeningInfo: string;
  catatanKwitansi: string;
  dispensasiBySiswaId: Record<string, StudentDispensasi>;
}

export interface StudentExamEligibility {
  id_siswa: string;
  totalTagihan: number;
  totalTerbayar: number;
  sisaTunggakan: number;
  persentaseTerbayar: number; // 0..100
  minPercentRequired: number;
  minimalAgarLayak: number; // tambahan rupiah minimal untuk mencapai ambang %
  status: ExamClearanceStatus;
  eligibleForExamCard: boolean;
  dispensasi?: StudentDispensasi;
  jumlahTagihanSyarat: number;
  bulanMenunggak: string[];
}

export interface SemesterMonthSlot {
  periode: string; // YYYY-MM
  bulanNum: number; // 1..12
  shortLabel: string; // Jul, Agu, Sep...
  fullLabel: string; // Juli 2026
  defaultDueDate: string; // YYYY-MM-10
}

const MONTH_SHORT_ID = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const MONTH_FULL_ID = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function getSemesterMonths(
  tahunAjaran: string = '2026/2027',
  semester: string = 'GANJIL'
): SemesterMonthSlot[] {
  const parts = String(tahunAjaran || '2026/2027').split('/');
  const startYear = Number(parts[0]) || 2026;
  const endYear = Number(parts[1]) || startYear + 1;
  const isGenap = String(semester || 'GANJIL').trim().toUpperCase() === 'GENAP';

  const months = isGenap ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  const year = isGenap ? endYear : startYear;

  return months.map((m) => {
    const mm = String(m).padStart(2, '0');
    return {
      periode: `${year}-${mm}`,
      bulanNum: m,
      shortLabel: MONTH_SHORT_ID[m] || mm,
      fullLabel: `${MONTH_FULL_ID[m] || mm} ${year}`,
      defaultDueDate: `${year}-${mm}-10`,
    };
  });
}

export function formatRupiah(amount: number, withPrefix: boolean = true): string {
  const safe = Math.round(Number(amount) || 0);
  const abs = Math.abs(safe);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = safe < 0 ? '-' : '';
  return withPrefix ? `${sign}Rp ${formatted}` : `${sign}${formatted}`;
}

/**
 * Mengurai nominal Rupiah dari berbagai format Excel / input manual:
 * "Rp 450.000", "450,000", "450.000,00", 450000, "", "-", "Lunas" -> angka bulat >= 0.
 */
export function parseRupiahNumber(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  const str = String(raw).trim();
  if (!str || str === '-' || /^lunas$/i.test(str)) return 0;

  // Hilangkan prefix Rp / IDR dan spasi
  let cleaned = str.replace(/^(rp\.?|idr)\s*/i, '').replace(/\s+/g, '');

  // Tangani desimal gaya Indonesia (",00") atau Inggris (".00") di akhir string
  if (/,\d{1,2}$/.test(cleaned) && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(/,\d{1,2}$/, '');
  } else if (/\.\d{1,2}$/.test(cleaned) && cleaned.includes(',')) {
    cleaned = cleaned.replace(/,/g, '').replace(/\.\d{1,2}$/, '');
  } else if (/,\d{1,2}$/.test(cleaned) && !cleaned.includes('.')) {
    cleaned = cleaned.replace(/,\d{1,2}$/, '');
  } else if (/\.\d{1,2}$/.test(cleaned) && !cleaned.includes(',')) {
    // Jika format 150000.00 (2 digit di belakang titik tunggal), ambil bagian bulatnya
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = parts[0];
    }
  }

  const digits = cleaned.replace(/[^\d]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Menghasilkan kode periode default untuk Posting Sisa Tagihan (dari Excel) per semester aktif.
 */
export function buildDefaultPostingPeriode(
  tahunAjaran: string = '2026/2027',
  semester: string = 'GANJIL'
): string {
  const parts = String(tahunAjaran || '2026/2027').split('/');
  const semUpper = String(semester || 'GANJIL').trim().toUpperCase() === 'GENAP' ? 'GENAP' : 'GANJIL';
  const yr = semUpper === 'GENAP' ? (parts[1] || parts[0] || '2027') : (parts[0] || '2026');
  return `SALDO-${yr}-${semUpper}`;
}

export interface CashierHandoverSummary {
  namaPetugas: string;
  idPetugas: string;
  receiptCount: number;
  tunai: number;
  transfer: number;
  lainnya: number;
  total: number;
}

/**
 * Rekap setoran kas per petugas kasir untuk tutup kas harian / laporan pemasukan.
 */
export function summarizeCashierHandover(
  validPayments: PembayaranRecord[]
): CashierHandoverSummary[] {
  const byCashier = new Map<
    string,
    CashierHandoverSummary & { receiptSet: Set<string> }
  >();

  for (const p of validPayments) {
    if (p.status_transaksi !== 'VALID') continue;
    const name = (p.nama_petugas || 'Petugas Keuangan').trim();
    const key = name.toLowerCase();
    let entry = byCashier.get(key);
    if (!entry) {
      entry = {
        namaPetugas: name,
        idPetugas: p.id_petugas || '',
        receiptCount: 0,
        tunai: 0,
        transfer: 0,
        lainnya: 0,
        total: 0,
        receiptSet: new Set<string>(),
      };
      byCashier.set(key, entry);
    }
    if (p.no_kwitansi) entry.receiptSet.add(p.no_kwitansi);
    if (p.metode === 'TUNAI') entry.tunai += p.nominal_bayar;
    else if (p.metode === 'TRANSFER') entry.transfer += p.nominal_bayar;
    else entry.lainnya += p.nominal_bayar;
    entry.total += p.nominal_bayar;
    entry.receiptCount = entry.receiptSet.size;
  }

  return Array.from(byCashier.values())
    .map((e) => ({
      namaPetugas: e.namaPetugas,
      idPetugas: e.idPetugas,
      receiptCount: e.receiptCount,
      tunai: e.tunai,
      transfer: e.transfer,
      lainnya: e.lainnya,
      total: e.total,
    }))
    .sort((a, b) => b.total - a.total);
}

export function formatDateIdShort(isoOrYmd?: string): string {
  if (!isoOrYmd) return '-';
  const clean = String(isoOrYmd).trim();
  const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const m = Number(ymd[2]);
    return `${Number(ymd[3])} ${MONTH_SHORT_ID[m] || ymd[2]} ${ymd[1]}`;
  }
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return clean;
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDefaultKeuanganConfig(): KeuanganConfig {
  return {
    tarifSppSmp: 0,
    tarifSppSma: 0,
    minPercentForExamCard: 50,
    enforceOnKartuPeserta: true,
    examRequiredPeriods: [],
    bendaharaNama: '',
    bendaharaNip: '',
    bendaharaJabatan: 'Bendahara Sekolah',
    bendaharaTtdUrl: '',
    rekeningInfo: '',
    catatanKwitansi: 'Simpan kwitansi ini sebagai bukti pembayaran resmi biaya sekolah.',
    dispensasiBySiswaId: {},
  };
}

export function parseKeuanganConfigFromSettings(
  settings: Record<string, string> = {}
): KeuanganConfig {
  const defaults = getDefaultKeuanganConfig();
  const raw = settings['keuangan_config_json'];
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const minPct = Number(parsed.minPercentForExamCard);
    const cleanDispensasi: Record<string, StudentDispensasi> = {};
    if (parsed.dispensasiBySiswaId && typeof parsed.dispensasiBySiswaId === 'object') {
      for (const [sid, d] of Object.entries(parsed.dispensasiBySiswaId)) {
        if (!sid || !d || typeof d !== 'object') continue;
        const dd = d as Partial<StudentDispensasi>;
        if (!dd.alasan) continue;
        cleanDispensasi[sid] = {
          alasan: String(dd.alasan).trim(),
          berlakuSampai: dd.berlakuSampai ? String(dd.berlakuSampai).trim() : '',
          oleh: String(dd.oleh || 'Bendahara').trim(),
          createdAt: String(dd.createdAt || ''),
        };
      }
    }

    return {
      tarifSppSmp: Math.max(0, Math.round(Number(parsed.tarifSppSmp) || 0)),
      tarifSppSma: Math.max(0, Math.round(Number(parsed.tarifSppSma) || 0)),
      minPercentForExamCard: Number.isFinite(minPct)
        ? Math.max(1, Math.min(100, Math.round(minPct)))
        : defaults.minPercentForExamCard,
      enforceOnKartuPeserta:
        parsed.enforceOnKartuPeserta !== undefined
          ? Boolean(parsed.enforceOnKartuPeserta)
          : defaults.enforceOnKartuPeserta,
      examRequiredPeriods: Array.isArray(parsed.examRequiredPeriods)
        ? parsed.examRequiredPeriods.map((p: unknown) => String(p || '').trim()).filter(Boolean)
        : [],
      bendaharaNama: String(parsed.bendaharaNama || '').trim(),
      bendaharaNip: String(parsed.bendaharaNip || '').trim(),
      bendaharaJabatan: String(parsed.bendaharaJabatan || defaults.bendaharaJabatan).trim(),
      bendaharaTtdUrl: String(parsed.bendaharaTtdUrl || '').trim(),
      rekeningInfo: String(parsed.rekeningInfo || '').trim(),
      catatanKwitansi:
        String(parsed.catatanKwitansi || '').trim() || defaults.catatanKwitansi,
      dispensasiBySiswaId: cleanDispensasi,
    };
  } catch {
    return defaults;
  }
}

export function serializeKeuanganConfigToSettings(config: KeuanganConfig): Record<string, string> {
  return {
    keuangan_config_json: JSON.stringify({
      tarifSppSmp: Math.max(0, Math.round(Number(config.tarifSppSmp) || 0)),
      tarifSppSma: Math.max(0, Math.round(Number(config.tarifSppSma) || 0)),
      minPercentForExamCard: Math.max(
        1,
        Math.min(100, Math.round(Number(config.minPercentForExamCard) || 50))
      ),
      enforceOnKartuPeserta: Boolean(config.enforceOnKartuPeserta),
      examRequiredPeriods: (config.examRequiredPeriods || []).filter(Boolean),
      bendaharaNama: String(config.bendaharaNama || '').trim(),
      bendaharaNip: String(config.bendaharaNip || '').trim(),
      bendaharaJabatan: String(config.bendaharaJabatan || 'Bendahara Sekolah').trim(),
      bendaharaTtdUrl: String(config.bendaharaTtdUrl || '').trim(),
      rekeningInfo: String(config.rekeningInfo || '').trim(),
      catatanKwitansi:
        String(config.catatanKwitansi || '').trim() ||
        'Simpan kwitansi ini sebagai bukti pembayaran resmi biaya sekolah.',
      dispensasiBySiswaId: config.dispensasiBySiswaId || {},
    }),
  };
}

export function computeTagihanStatus(nominalAkhir: number, terbayar: number): TagihanStatus {
  const target = Math.max(0, Math.round(nominalAkhir));
  const paid = Math.max(0, Math.round(terbayar));
  if (target === 0 || paid >= target) return 'LUNAS';
  if (paid > 0) return 'CICILAN';
  return 'BELUM_BAYAR';
}

export function normalizeTagihanRow(raw: Record<string, unknown>): TagihanRecord {
  const nominal = Math.max(0, Math.round(Number(raw.nominal) || 0));
  const potongan = Math.max(0, Math.min(nominal, Math.round(Number(raw.potongan) || 0)));
  const nominalAkhir =
    raw.nominal_akhir !== undefined && raw.nominal_akhir !== ''
      ? Math.max(0, Math.round(Number(raw.nominal_akhir) || 0))
      : Math.max(0, nominal - potongan);
  const terbayar = Math.max(0, Math.round(Number(raw.terbayar) || 0));
  const kategoriRaw = String(raw.kategori || 'SPP').toUpperCase();
  const kategori: TagihanKategori =
    kategoriRaw === 'SALDO_AWAL' ||
    kategoriRaw === 'UJIAN' ||
    kategoriRaw === 'ASRAMA' ||
    kategoriRaw === 'LAINNYA'
      ? (kategoriRaw as TagihanKategori)
      : 'SPP';

  return {
    id_tagihan: String(raw.id_tagihan || ''),
    id_siswa: String(raw.id_siswa || ''),
    tahun_ajaran: String(raw.tahun_ajaran || ''),
    semester: String(raw.semester || ''),
    kategori,
    periode_bulan: String(raw.periode_bulan || ''),
    nama_tagihan: String(raw.nama_tagihan || ''),
    nominal,
    potongan,
    nominal_akhir: nominalAkhir,
    terbayar,
    status: computeTagihanStatus(nominalAkhir, terbayar),
    jatuh_tempo: String(raw.jatuh_tempo || ''),
    catatan: String(raw.catatan || ''),
    updated_at: String(raw.updated_at || ''),
  };
}

export function normalizePembayaranRow(raw: Record<string, unknown>): PembayaranRecord {
  const metodeRaw = String(raw.metode || 'TUNAI').toUpperCase();
  const metode: MetodePembayaran =
    metodeRaw === 'TRANSFER' || metodeRaw === 'LAINNYA'
      ? (metodeRaw as MetodePembayaran)
      : 'TUNAI';
  const statusRaw = String(raw.status_transaksi || 'VALID').toUpperCase();
  return {
    id_pembayaran: String(raw.id_pembayaran || ''),
    no_kwitansi: String(raw.no_kwitansi || ''),
    id_tagihan: String(raw.id_tagihan || ''),
    id_siswa: String(raw.id_siswa || ''),
    tanggal_bayar: String(raw.tanggal_bayar || ''),
    nominal_bayar: Math.max(0, Math.round(Number(raw.nominal_bayar) || 0)),
    metode,
    status_transaksi: statusRaw === 'BATAL' ? 'BATAL' : 'VALID',
    id_petugas: String(raw.id_petugas || ''),
    nama_petugas: String(raw.nama_petugas || ''),
    catatan: String(raw.catatan || ''),
    timestamp: String(raw.timestamp || ''),
  };
}

export function tagihanToDbRow(t: TagihanRecord): string[] {
  return [
    t.id_tagihan,
    t.id_siswa,
    t.tahun_ajaran,
    t.semester,
    t.kategori,
    t.periode_bulan,
    t.nama_tagihan,
    String(Math.max(0, Math.round(t.nominal))),
    String(Math.max(0, Math.round(t.potongan))),
    String(Math.max(0, Math.round(t.nominal_akhir))),
    String(Math.max(0, Math.round(t.terbayar))),
    computeTagihanStatus(t.nominal_akhir, t.terbayar),
    t.jatuh_tempo,
    t.catatan,
    t.updated_at,
  ];
}

export function pembayaranToDbRow(p: PembayaranRecord): string[] {
  return [
    p.id_pembayaran,
    p.no_kwitansi,
    p.id_tagihan,
    p.id_siswa,
    p.tanggal_bayar,
    String(Math.max(0, Math.round(p.nominal_bayar))),
    p.metode,
    p.status_transaksi,
    p.id_petugas,
    p.nama_petugas,
    p.catatan,
    p.timestamp,
  ];
}

/**
 * Menghitung kelayakan cetak Kartu Peserta Ujian bagi 1 siswa berdasarkan
 * tagihan pada tahun ajaran & semester aktif + periode syarat ujian + dispensasi.
 */
export function computeStudentEligibility(
  idSiswa: string,
  studentBills: TagihanRecord[],
  config: KeuanganConfig,
  tahunAjaran: string,
  semester: string
): StudentExamEligibility {
  const semUpper = String(semester || 'GANJIL').trim().toUpperCase();
  const taClean = String(tahunAjaran || '').trim();
  const requiredSet = new Set(
    (config.examRequiredPeriods || []).map((p) => p.trim()).filter(Boolean)
  );

  // Filter tagihan sesuai TA/semester aktif
  const activeBills = studentBills.filter((b) => {
    const taOk = !taClean || !b.tahun_ajaran || b.tahun_ajaran === taClean;
    const semOk = !semUpper || !b.semester || b.semester.toUpperCase() === semUpper;
    return taOk && semOk;
  });

  // Jika bendahara memilih bulan syarat ujian tertentu, hitung syarat dari bulan tsb + kategori UJIAN + posting SALDO_AWAL
  const scopedBills =
    requiredSet.size > 0
      ? activeBills.filter(
          (b) =>
            requiredSet.has(b.periode_bulan) ||
            b.kategori === 'UJIAN' ||
            b.kategori === 'SALDO_AWAL' ||
            b.periode_bulan.toUpperCase().startsWith('SALDO-')
        )
      : activeBills;

  const totalTagihan = scopedBills.reduce((acc, b) => acc + Math.max(0, b.nominal_akhir), 0);
  const totalTerbayar = scopedBills.reduce(
    (acc, b) => acc + Math.min(Math.max(0, b.nominal_akhir), Math.max(0, b.terbayar)),
    0
  );
  const sisaTunggakan = Math.max(0, totalTagihan - totalTerbayar);
  const minPct = Math.max(1, Math.min(100, Number(config.minPercentForExamCard) || 50));
  const dispensasi = config.dispensasiBySiswaId?.[idSiswa];

  const bulanMenunggak = scopedBills
    .filter((b) => b.nominal_akhir > b.terbayar)
    .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan))
    .map((b) => b.nama_tagihan || b.periode_bulan);

  if (scopedBills.length === 0) {
    return {
      id_siswa: idSiswa,
      totalTagihan: 0,
      totalTerbayar: 0,
      sisaTunggakan: 0,
      persentaseTerbayar: 0,
      minPercentRequired: minPct,
      minimalAgarLayak: 0,
      status: dispensasi ? 'DISPENSASI' : 'BELUM_ADA_TAGIHAN',
      // Jika belum ada tagihan sama sekali yang di-generate, jangan blokir pencetakan kartu
      eligibleForExamCard: true,
      dispensasi,
      jumlahTagihanSyarat: 0,
      bulanMenunggak: [],
    };
  }

  const persentaseTerbayar =
    totalTagihan === 0
      ? 100
      : Math.min(100, Math.round((totalTerbayar / totalTagihan) * 1000) / 10);

  const targetMinimalRupiah = Math.ceil((totalTagihan * minPct) / 100);
  const minimalAgarLayak = Math.max(0, targetMinimalRupiah - totalTerbayar);

  let status: ExamClearanceStatus;
  let eligibleForExamCard: boolean;

  if (totalTagihan === 0 || sisaTunggakan === 0) {
    status = 'LUNAS';
    eligibleForExamCard = true;
  } else if (persentaseTerbayar >= minPct) {
    status = 'MEMENUHI_SYARAT';
    eligibleForExamCard = true;
  } else if (dispensasi) {
    status = 'DISPENSASI';
    eligibleForExamCard = true;
  } else {
    status = 'BELUM_LAYAK';
    eligibleForExamCard = false;
  }

  return {
    id_siswa: idSiswa,
    totalTagihan,
    totalTerbayar,
    sisaTunggakan,
    persentaseTerbayar,
    minPercentRequired: minPct,
    minimalAgarLayak,
    status,
    eligibleForExamCard,
    dispensasi,
    jumlahTagihanSyarat: scopedBills.length,
    bulanMenunggak,
  };
}

export function computeExamEligibilityMap(
  studentIds: string[],
  allBills: TagihanRecord[],
  config: KeuanganConfig,
  tahunAjaran: string,
  semester: string
): Record<string, StudentExamEligibility> {
  const byStudent = new Map<string, TagihanRecord[]>();
  for (const bill of allBills) {
    const arr = byStudent.get(bill.id_siswa);
    if (arr) arr.push(bill);
    else byStudent.set(bill.id_siswa, [bill]);
  }

  const out: Record<string, StudentExamEligibility> = {};
  for (const sid of studentIds) {
    out[sid] = computeStudentEligibility(
      sid,
      byStudent.get(sid) || [],
      config,
      tahunAjaran,
      semester
    );
  }
  return out;
}

export interface FifoAllocationItem {
  tagihan: TagihanRecord;
  allocatedAmount: number;
  newTerbayar: number;
  newStatus: TagihanStatus;
}

/**
 * Mengalokasikan nominal pembayaran ke tagihan yang belum lunas secara berurutan (FIFO: periode terlama dulu),
 * atau terbatas pada daftar `selectedTagihanIds` jika bendahara memilih tagihan spesifik.
 */
export function allocatePaymentFifo(
  studentBills: TagihanRecord[],
  amountToPay: number,
  selectedTagihanIds?: string[]
): {
  allocations: FifoAllocationItem[];
  totalAllocated: number;
  unallocatedRemainder: number;
} {
  let remaining = Math.max(0, Math.round(Number(amountToPay) || 0));
  const selectedSet =
    selectedTagihanIds && selectedTagihanIds.length > 0
      ? new Set(selectedTagihanIds)
      : null;

  const candidates = studentBills
    .filter((b) => b.nominal_akhir > b.terbayar && (!selectedSet || selectedSet.has(b.id_tagihan)))
    .sort((a, b) => {
      const pCmp = a.periode_bulan.localeCompare(b.periode_bulan);
      if (pCmp !== 0) return pCmp;
      return a.id_tagihan.localeCompare(b.id_tagihan);
    });

  const allocations: FifoAllocationItem[] = [];
  let totalAllocated = 0;

  for (const bill of candidates) {
    if (remaining <= 0) break;
    const due = Math.max(0, bill.nominal_akhir - bill.terbayar);
    if (due <= 0) continue;
    const alloc = Math.min(due, remaining);
    const newTerbayar = bill.terbayar + alloc;
    allocations.push({
      tagihan: bill,
      allocatedAmount: alloc,
      newTerbayar,
      newStatus: computeTagihanStatus(bill.nominal_akhir, newTerbayar),
    });
    totalAllocated += alloc;
    remaining -= alloc;
  }

  return {
    allocations,
    totalAllocated,
    unallocatedRemainder: remaining,
  };
}

/**
 * Membangun nomor kwitansi sekuensial unik per bulan: KW-YYYYMM-0001
 */
export function generateNextReceiptNumber(
  existingPayments: PembayaranRecord[],
  tanggalBayarYmd: string
): string {
  const ymMatch = String(tanggalBayarYmd || '').match(/^(\d{4})-(\d{2})/);
  const ym = ymMatch
    ? `${ymMatch[1]}${ymMatch[2]}`
    : getTodayYmd().slice(0, 7).replace('-', '');
  const prefix = `KW-${ym}-`;

  let maxSeq = 0;
  for (const p of existingPayments) {
    if (p.no_kwitansi && p.no_kwitansi.startsWith(prefix)) {
      const num = Number(p.no_kwitansi.slice(prefix.length));
      if (Number.isFinite(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/**
 * Membangun pesan WhatsApp resmi yang sopan untuk orang tua / wali siswa
 */
export function buildWhatsAppReminderText(params: {
  schoolName: string;
  studentName: string;
  kelasName: string;
  nis: string;
  tahunAjaran: string;
  semester: string;
  eligibility: StudentExamEligibility;
  rekeningInfo?: string;
  bendaharaNama?: string;
}): string {
  const {
    schoolName,
    studentName,
    kelasName,
    nis,
    tahunAjaran,
    semester,
    eligibility,
    rekeningInfo,
    bendaharaNama,
  } = params;

  const lines = [
    `Shalom / Selamat Pagi/Siang Bapak/Ibu Orang Tua/Wali dari:`,
    `*${studentName}* (${kelasName}${nis ? ` • NIS ${nis}` : ''})`,
    ``,
    `Informasi Administrasi Biaya Sekolah — *${schoolName}*`,
    `Tahun Ajaran ${tahunAjaran} (Semester ${semester})`,
    ``,
    `• Total Tagihan Periode Ujian : ${formatRupiah(eligibility.totalTagihan)}`,
    `• Sudah Terbayar             : ${formatRupiah(eligibility.totalTerbayar)} (${eligibility.persentaseTerbayar}%)`,
    `• Sisa Tunggakan             : *${formatRupiah(eligibility.sisaTunggakan)}*`,
  ];

  if (eligibility.bulanMenunggak.length > 0) {
    lines.push(`• Rincian Belum Lunas        : ${eligibility.bulanMenunggak.join(', ')}`);
  }

  if (!eligibility.eligibleForExamCard && eligibility.minimalAgarLayak > 0) {
    lines.push(``);
    lines.push(
      `Sebagai syarat pengambilan *Kartu Peserta Ujian* (minimal pelunasan ${eligibility.minPercentRequired}%), mohon dapat menyelesaikan pembayaran minimal *${formatRupiah(eligibility.minimalAgarLayak)}* (atau melunasi seluruh sisa tunggakan).`
    );
  } else if (eligibility.sisaTunggakan > 0) {
    lines.push(``);
    lines.push(
      `Status Kartu Ujian saat ini: *LAYAK* (${eligibility.persentaseTerbayar}%). Mohon pelunasan sisa tunggakan dapat dilanjutkan sesuai kemampuan.`
    );
  }

  if (rekeningInfo) {
    lines.push(``);
    lines.push(`Informasi Pembayaran:\n${rekeningInfo}`);
  }

  lines.push(``);
  lines.push(`Terima kasih atas kerja sama Bapak/Ibu.`);
  lines.push(`Hormat kami,\n${bendaharaNama || 'Bendahara Sekolah'} — ${schoolName}`);

  return lines.join('\n');
}
