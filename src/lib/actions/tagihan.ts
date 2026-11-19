'use server';

import {
  dbAppendRow,
  dbBatchAppendRows,
  dbBatchUpdateRows,
  dbEnsureTableExists,
  dbFindAndDeleteRow,
  dbGetAll,
  dbUpdateRow,
  generateId,
  sanitizeInput,
} from '@/lib/google-sheets';
import { checkUserMenuAccess } from '@/lib/rbac-server';
import { requireAuth } from '@/lib/session-server';
import { getSiswaAction } from '@/lib/actions/siswa';
import { getAcademicSessionAction, getSettingsAction } from '@/lib/actions/settings';
import { persistSettingsUpdates } from '@/lib/settings-server';
import {
  allocatePaymentFifo,
  buildDefaultPostingPeriode,
  computeExamEligibilityMap,
  computeTagihanStatus,
  formatRupiah,
  generateNextReceiptNumber,
  getSemesterMonths,
  getTodayYmd,
  KeuanganConfig,
  MetodePembayaran,
  normalizePembayaranRow,
  normalizeTagihanRow,
  parseKeuanganConfigFromSettings,
  PEMBAYARAN_HEADERS,
  PembayaranRecord,
  pembayaranToDbRow,
  serializeKeuanganConfigToSettings,
  StudentExamEligibility,
  TAGIHAN_HEADERS,
  TagihanKategori,
  TagihanRecord,
  tagihanToDbRow,
} from '@/lib/tagihan-utils';

export interface TagihanStudentItem {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
  nama_kelas: string;
  jenjang: 'SMP' | 'SMA';
  tahun_ajaran: string;
  semester: string;
}

export interface TagihanKelasItem {
  id_kelas: string;
  nama_kelas: string;
  jenjang: 'SMP' | 'SMA';
}

async function ensureKeuanganTables(): Promise<void> {
  await Promise.all([
    dbEnsureTableExists('TAGIHAN', TAGIHAN_HEADERS),
    dbEnsureTableExists('PEMBAYARAN', PEMBAYARAN_HEADERS),
  ]);
}

async function appendKeuanganLog(
  level: 'INFO' | 'WARN',
  action: string,
  message: string,
  userId: string
) {
  try {
    await dbAppendRow('LOG', [new Date().toISOString(), level, action, message, userId]);
  } catch {
    // Non-blocking audit log write
  }
}

/**
 * Helper server ringan untuk dipakai oleh modul Kartu Peserta Ujian & Daftar Hadir
 * agar status kelayakan biaya sekolah (Lunas / >=50% / Dispensasi / Belum Layak) selalu konsisten.
 */
export async function getExamEligibilityForStudents(
  studentIds: string[],
  tahunAjaran: string,
  semester: string,
  settings: Record<string, string>
): Promise<{
  config: KeuanganConfig;
  eligibilityMap: Record<string, StudentExamEligibility>;
  totalBillsCount: number;
}> {
  const config = parseKeuanganConfigFromSettings(settings);
  try {
    await ensureKeuanganTables();
    const rawBills = await dbGetAll('TAGIHAN');
    const bills = rawBills.map((r) => normalizeTagihanRow(r)).filter((b) => b.id_tagihan);
    const eligibilityMap = computeExamEligibilityMap(
      studentIds,
      bills,
      config,
      tahunAjaran,
      semester
    );
    return {
      config,
      eligibilityMap,
      totalBillsCount: bills.length,
    };
  } catch {
    // Fallback aman bila tabel belum terinisialisasi
    const eligibilityMap = computeExamEligibilityMap(
      studentIds,
      [],
      config,
      tahunAjaran,
      semester
    );
    return {
      config,
      eligibilityMap,
      totalBillsCount: 0,
    };
  }
}

async function resolveKeuanganAuth() {
  const auth = await requireAuth();
  const isAdmin = auth.role === 'ADMIN';
  const [hasBendaharaFull, hasTagihanRead, hasKasirFull] = isAdmin
    ? [true, true, true]
    : await Promise.all([
        checkUserMenuAccess(auth, 'tagihan', 'full'),
        checkUserMenuAccess(auth, 'tagihan', 'read'),
        checkUserMenuAccess(auth, 'tagihan-kasir', 'full'),
      ]);

  const canManageBendahara = isAdmin || hasBendaharaFull;
  const canInputKasir = canManageBendahara || hasKasirFull;
  const canView = canInputKasir || hasTagihanRead;

  if (!canView) {
    throw new Error('Forbidden: Anda tidak memiliki izin akses untuk menu Tagihan & Biaya Sekolah.');
  }

  const financeRoleLabel = isAdmin
    ? 'Administrator'
    : canManageBendahara
    ? 'Bendahara Sekolah'
    : canInputKasir
    ? 'Kasir Loket SPP'
    : 'Lihat Saja (Read-Only)';

  return { auth, canManageBendahara, canInputKasir, financeRoleLabel };
}

async function requireBendaharaAccess() {
  const { auth, canManageBendahara } = await resolveKeuanganAuth();
  if (!canManageBendahara) {
    throw new Error(
      'Forbidden: Tindakan ini khusus jabatan Bendahara Sekolah / Admin. Akun Kasir Loket hanya dapat menerima pembayaran & mencetak kwitansi.'
    );
  }
  return auth;
}

async function requireKasirAccess() {
  const { auth, canInputKasir } = await resolveKeuanganAuth();
  if (!canInputKasir) {
    throw new Error(
      'Forbidden: Akun Anda berstatus Lihat Saja (Read-Only). Hubungi Admin untuk akses Kasir Loket atau Bendahara.'
    );
  }
  return auth;
}

export async function getTagihanBundleAction() {
  try {
    const { auth, canManageBendahara, canInputKasir, financeRoleLabel } =
      await resolveKeuanganAuth();

    await ensureKeuanganTables();

    const [siswaRes, kelasRaw, settingsRes, sessionRes, rawBills, rawPayments] =
      await Promise.all([
        getSiswaAction(undefined, 'DELEGATED_ALL'),
        dbGetAll('KELAS'),
        getSettingsAction(),
        getAcademicSessionAction(),
        dbGetAll('TAGIHAN', false),
        dbGetAll('PEMBAYARAN', false),
      ]);

    if (!siswaRes.success) {
      throw new Error(siswaRes.message || 'Gagal memuat daftar siswa.');
    }
    if (!settingsRes.success || !settingsRes.data) {
      throw new Error(settingsRes.message || 'Gagal memuat pengaturan sekolah.');
    }

    const settings = settingsRes.data;
    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';
    const config = parseKeuanganConfigFromSettings(settings);

    const students: TagihanStudentItem[] = (siswaRes.data || [])
      .map((s: any) => ({
        id_siswa: String(s.id_siswa || ''),
        nis: String(s.nis || ''),
        nama: String(s.nama || ''),
        id_kelas: String(s.id_kelas || ''),
        nama_kelas: String(s.nama_kelas || s.id_kelas || ''),
        jenjang: (String(s.jenjang || 'SMA').toUpperCase() === 'SMP' ? 'SMP' : 'SMA') as
          | 'SMP'
          | 'SMA',
        tahun_ajaran: s.tahun_ajaran ? String(s.tahun_ajaran) : tahunAjaran,
        semester: s.semester ? String(s.semester) : semester,
      }))
      .sort((a: TagihanStudentItem, b: TagihanStudentItem) => {
        if (a.jenjang !== b.jenjang) return a.jenjang.localeCompare(b.jenjang);
        const kCmp = a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true });
        if (kCmp !== 0) return kCmp;
        return a.nama.localeCompare(b.nama, 'id');
      });

    const kelasList: TagihanKelasItem[] = kelasRaw
      .filter((k: any) => k.id_kelas)
      .map((k: any) => ({
        id_kelas: String(k.id_kelas),
        nama_kelas: String(k.nama_kelas || k.id_kelas),
        jenjang: (String(k.jenjang || 'SMA').toUpperCase() === 'SMP' ? 'SMP' : 'SMA') as
          | 'SMP'
          | 'SMA',
      }))
      .sort((a, b) => {
        if (a.jenjang !== b.jenjang) return a.jenjang.localeCompare(b.jenjang);
        return a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true });
      });

    const bills: TagihanRecord[] = rawBills
      .map((r) => normalizeTagihanRow(r))
      .filter((b) => Boolean(b.id_tagihan));

    const payments: PembayaranRecord[] = rawPayments
      .map((r) => normalizePembayaranRow(r))
      .filter((p) => Boolean(p.id_pembayaran))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const eligibilityMap = computeExamEligibilityMap(
      students.map((s) => s.id_siswa),
      bills,
      config,
      tahunAjaran,
      semester
    );

    return {
      success: true,
      data: {
        students,
        kelasList,
        bills,
        payments,
        config,
        settings,
        academicSession: { tahunAjaran, semester },
        eligibilityMap,
        canEdit: canManageBendahara,
        canManageBendahara,
        canInputKasir,
        financeRoleLabel,
        currentUser: {
          id: auth.id,
          nama: auth.nama,
          role: auth.role,
        },
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal memuat modul tagihan.',
    };
  }
}

export async function saveKeuanganConfigAction(config: KeuanganConfig) {
  try {
    const auth = await requireBendaharaAccess();
    const serialized = serializeKeuanganConfigToSettings(config);
    await persistSettingsUpdates(serialized, auth.id);
    await appendKeuanganLog(
      'INFO',
      'UPD_KEUANGAN_CONFIG',
      `Perbarui pengaturan tagihan (Ambang Kartu: ${config.minPercentForExamCard}%, Kunci Cetak: ${config.enforceOnKartuPeserta ? 'Aktif' : 'Nonaktif'})`,
      auth.id
    );
    return { success: true, message: 'Pengaturan biaya sekolah & syarat kartu ujian berhasil disimpan.' };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan keuangan.',
    };
  }
}

export async function generateTagihanBulananAction(input: {
  periodes: string[];
  targetScope: 'ALL' | 'SMP' | 'SMA' | string; // 'ALL' | 'SMP' | 'SMA' | id_kelas
  nominalSmp: number;
  nominalSma: number;
  kategori?: TagihanKategori;
  customNama?: string;
  jatuhTempo?: string;
  saveAsDefaultTarif?: boolean;
}) {
  try {
    const auth = await requireBendaharaAccess();
    await ensureKeuanganTables();

    const periodes = Array.from(
      new Set((input.periodes || []).map((p) => String(p || '').trim()).filter(Boolean))
    );
    if (periodes.length === 0) {
      return { success: false, message: 'Pilih minimal 1 bulan / periode tagihan.' };
    }

    const kategori: TagihanKategori = input.kategori || 'SPP';
    const nominalSmp = Math.max(0, Math.round(Number(input.nominalSmp) || 0));
    const nominalSma = Math.max(0, Math.round(Number(input.nominalSma) || 0));

    const [siswaRes, sessionRes, settingsRes, rawBills] = await Promise.all([
      getSiswaAction(undefined, 'DELEGATED_ALL'),
      getAcademicSessionAction(),
      getSettingsAction(),
      dbGetAll('TAGIHAN', false),
    ]);

    if (!siswaRes.success) {
      throw new Error(siswaRes.message || 'Gagal memuat daftar siswa.');
    }

    const settings = settingsRes.data || {};
    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';

    const semMonths = getSemesterMonths(tahunAjaran, semester);
    const monthLookup = new Map(semMonths.map((m) => [m.periode, m]));

    const allStudents: TagihanStudentItem[] = (siswaRes.data || []).map((s: any) => ({
      id_siswa: String(s.id_siswa || ''),
      nis: String(s.nis || ''),
      nama: String(s.nama || ''),
      id_kelas: String(s.id_kelas || ''),
      nama_kelas: String(s.nama_kelas || s.id_kelas || ''),
      jenjang: (String(s.jenjang || 'SMA').toUpperCase() === 'SMP' ? 'SMP' : 'SMA') as
        | 'SMP'
        | 'SMA',
      tahun_ajaran: s.tahun_ajaran ? String(s.tahun_ajaran) : tahunAjaran,
      semester: s.semester ? String(s.semester) : semester,
    }));

    const targetStudents = allStudents.filter((s) => {
      if (!s.id_siswa) return false;
      if (input.targetScope === 'ALL') return true;
      if (input.targetScope === 'SMP' || input.targetScope === 'SMA') {
        return s.jenjang === input.targetScope;
      }
      return s.id_kelas === input.targetScope;
    });

    if (targetStudents.length === 0) {
      return { success: false, message: 'Tidak ada siswa yang sesuai dengan target kelas/jenjang.' };
    }

    const existingBills = rawBills.map((r) => normalizeTagihanRow(r)).filter((b) => b.id_tagihan);
    const existingKeys = new Set(
      existingBills.map(
        (b) => `${b.id_siswa}|${b.tahun_ajaran}|${b.semester.toUpperCase()}|${b.kategori}|${b.periode_bulan}`
      )
    );

    const nowIso = new Date().toISOString();
    const newRows: string[][] = [];
    let skippedCount = 0;

    for (const student of targetStudents) {
      const baseNominal = student.jenjang === 'SMP' ? nominalSmp : nominalSma;
      if (baseNominal <= 0) {
        skippedCount += periodes.length;
        continue;
      }

      for (const periode of periodes) {
        const dupKey = `${student.id_siswa}|${tahunAjaran}|${semester.toUpperCase()}|${kategori}|${periode}`;
        if (existingKeys.has(dupKey)) {
          skippedCount++;
          continue;
        }
        existingKeys.add(dupKey);

        const mInfo = monthLookup.get(periode);
        const namaTagihan =
          sanitizeInput(input.customNama || '', 150) ||
          (kategori === 'SPP'
            ? `SPP ${mInfo ? mInfo.fullLabel : periode}`
            : `${kategori} ${mInfo ? mInfo.fullLabel : periode}`);

        const bill: TagihanRecord = {
          id_tagihan: generateId('TGH'),
          id_siswa: student.id_siswa,
          tahun_ajaran: tahunAjaran,
          semester,
          kategori,
          periode_bulan: periode,
          nama_tagihan: namaTagihan,
          nominal: baseNominal,
          potongan: 0,
          nominal_akhir: baseNominal,
          terbayar: 0,
          status: 'BELUM_BAYAR',
          jatuh_tempo: input.jatuhTempo || mInfo?.defaultDueDate || '',
          catatan: '',
          updated_at: nowIso,
        };
        newRows.push(tagihanToDbRow(bill));
      }
    }

    if (newRows.length > 0) {
      await dbBatchAppendRows('TAGIHAN', newRows);
    }

    if (input.saveAsDefaultTarif && kategori === 'SPP') {
      const currentCfg = parseKeuanganConfigFromSettings(settings);
      const nextCfg: KeuanganConfig = {
        ...currentCfg,
        tarifSppSmp: nominalSmp > 0 ? nominalSmp : currentCfg.tarifSppSmp,
        tarifSppSma: nominalSma > 0 ? nominalSma : currentCfg.tarifSppSma,
      };
      await persistSettingsUpdates(serializeKeuanganConfigToSettings(nextCfg), auth.id);
    }

    await appendKeuanganLog(
      'INFO',
      'GENERATE_TAGIHAN',
      `Generate ${newRows.length} tagihan ${kategori} (dilewati/duplikat: ${skippedCount}) untuk periode ${periodes.join(', ')}`,
      auth.id
    );

    if (newRows.length === 0) {
      return {
        success: true,
        createdCount: 0,
        skippedCount,
        message:
          'Tidak ada tagihan baru dibuat (semua tagihan periode tersebut sudah tersedia atau nominal 0).',
      };
    }

    return {
      success: true,
      createdCount: newRows.length,
      skippedCount,
      message: `Berhasil membuat ${newRows.length} tagihan baru${skippedCount > 0 ? ` (${skippedCount} dilewati karena sudah ada)` : ''}.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal membuat tagihan massal.',
    };
  }
}

export async function createSingleTagihanAction(input: {
  id_siswa: string;
  kategori: TagihanKategori;
  periode_bulan: string;
  nama_tagihan: string;
  nominal: number;
  potongan?: number;
  jatuh_tempo?: string;
  catatan?: string;
}) {
  try {
    const auth = await requireBendaharaAccess();
    await ensureKeuanganTables();

    const nominal = Math.max(0, Math.round(Number(input.nominal) || 0));
    const potongan = Math.max(0, Math.min(nominal, Math.round(Number(input.potongan) || 0)));
    const nominalAkhir = Math.max(0, nominal - potongan);

    if (!input.id_siswa || !input.nama_tagihan.trim()) {
      return { success: false, message: 'Siswa dan nama tagihan wajib diisi.' };
    }
    if (nominal <= 0) {
      return { success: false, message: 'Nominal tagihan harus lebih besar dari Rp 0.' };
    }

    const [sessionRes, settingsRes] = await Promise.all([
      getAcademicSessionAction(),
      getSettingsAction(),
    ]);
    const settings = settingsRes.data || {};
    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';

    const bill: TagihanRecord = {
      id_tagihan: generateId('TGH'),
      id_siswa: sanitizeInput(input.id_siswa, 64),
      tahun_ajaran: tahunAjaran,
      semester,
      kategori: input.kategori || 'LAINNYA',
      periode_bulan: sanitizeInput(input.periode_bulan || getTodayYmd().slice(0, 7), 32),
      nama_tagihan: sanitizeInput(input.nama_tagihan, 150),
      nominal,
      potongan,
      nominal_akhir: nominalAkhir,
      terbayar: 0,
      status: computeTagihanStatus(nominalAkhir, 0),
      jatuh_tempo: sanitizeInput(input.jatuh_tempo || '', 32),
      catatan: sanitizeInput(input.catatan || '', 300),
      updated_at: new Date().toISOString(),
    };

    await dbAppendRow('TAGIHAN', tagihanToDbRow(bill));
    await appendKeuanganLog(
      'INFO',
      'ADD_TAGIHAN',
      `Tambah tagihan ${bill.nama_tagihan} (${formatRupiah(bill.nominal_akhir)}) untuk ${bill.id_siswa}`,
      auth.id
    );

    return { success: true, message: 'Tagihan siswa berhasil ditambahkan.', data: bill };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal menambah tagihan.',
    };
  }
}

export async function updateTagihanAction(input: {
  id_tagihan: string;
  nominal: number;
  potongan: number;
  nama_tagihan?: string;
  jatuh_tempo?: string;
  catatan?: string;
}) {
  try {
    const auth = await requireBendaharaAccess();
    await ensureKeuanganTables();

    const rawBills = await dbGetAll('TAGIHAN', false);
    const existing = rawBills
      .map((r) => normalizeTagihanRow(r))
      .find((b) => b.id_tagihan === input.id_tagihan);

    if (!existing) {
      return { success: false, message: 'Tagihan tidak ditemukan.' };
    }

    const nominal = Math.max(0, Math.round(Number(input.nominal) || 0));
    const potongan = Math.max(0, Math.min(nominal, Math.round(Number(input.potongan) || 0)));
    const nominalAkhir = Math.max(0, nominal - potongan);

    if (nominalAkhir < existing.terbayar) {
      return {
        success: false,
        message: `Nominal setelah potongan (${formatRupiah(nominalAkhir)}) tidak boleh lebih kecil dari jumlah yang sudah dibayar (${formatRupiah(existing.terbayar)}).`,
      };
    }

    const updated: TagihanRecord = {
      ...existing,
      nama_tagihan: input.nama_tagihan
        ? sanitizeInput(input.nama_tagihan, 150)
        : existing.nama_tagihan,
      nominal,
      potongan,
      nominal_akhir: nominalAkhir,
      status: computeTagihanStatus(nominalAkhir, existing.terbayar),
      jatuh_tempo:
        input.jatuh_tempo !== undefined
          ? sanitizeInput(input.jatuh_tempo, 32)
          : existing.jatuh_tempo,
      catatan:
        input.catatan !== undefined ? sanitizeInput(input.catatan, 300) : existing.catatan,
      updated_at: new Date().toISOString(),
    };

    await dbUpdateRow('TAGIHAN', updated.id_tagihan, tagihanToDbRow(updated));
    await appendKeuanganLog(
      'INFO',
      'EDIT_TAGIHAN',
      `Ubah tagihan ${updated.id_tagihan}: nominal ${formatRupiah(updated.nominal)}, potongan ${formatRupiah(updated.potongan)}`,
      auth.id
    );

    return { success: true, message: 'Tagihan & potongan/beasiswa berhasil diperbarui.', data: updated };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal memperbarui tagihan.',
    };
  }
}

export async function deleteTagihanAction(idTagihan: string) {
  try {
    const auth = await requireBendaharaAccess();
    await ensureKeuanganTables();

    const rawBills = await dbGetAll('TAGIHAN', false);
    const existing = rawBills
      .map((r) => normalizeTagihanRow(r))
      .find((b) => b.id_tagihan === idTagihan);

    if (!existing) {
      return { success: false, message: 'Tagihan tidak ditemukan.' };
    }
    if (existing.terbayar > 0) {
      return {
        success: false,
        message:
          'Tagihan yang sudah memiliki pembayaran tidak dapat dihapus. Batalkan (Void) transaksinya terlebih dahulu demi integritas audit kas.',
      };
    }

    await dbFindAndDeleteRow('TAGIHAN', idTagihan);
    await appendKeuanganLog(
      'WARN',
      'DEL_TAGIHAN',
      `Hapus tagihan belum dibayar: ${existing.nama_tagihan} (${existing.id_siswa})`,
      auth.id
    );

    return { success: true, message: 'Tagihan berhasil dihapus.' };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal menghapus tagihan.',
    };
  }
}

export async function recordPembayaranAction(input: {
  id_siswa: string;
  studentName?: string;
  amount: number;
  tanggal_bayar: string;
  metode: MetodePembayaran;
  catatan?: string;
  selectedTagihanIds?: string[];
}) {
  try {
    const auth = await requireKasirAccess();
    await ensureKeuanganTables();

    const amount = Math.max(0, Math.round(Number(input.amount) || 0));
    if (!input.id_siswa) {
      return { success: false, message: 'Siswa wajib dipilih.' };
    }
    if (amount <= 0) {
      return { success: false, message: 'Nominal pembayaran harus lebih besar dari Rp 0.' };
    }

    const [rawBills, rawPayments] = await Promise.all([
      dbGetAll('TAGIHAN', false),
      dbGetAll('PEMBAYARAN', false),
    ]);

    const allBills = rawBills.map((r) => normalizeTagihanRow(r)).filter((b) => b.id_tagihan);
    const studentBills = allBills.filter((b) => b.id_siswa === input.id_siswa);
    const existingPayments = rawPayments
      .map((r) => normalizePembayaranRow(r))
      .filter((p) => p.id_pembayaran);

    const { allocations, totalAllocated, unallocatedRemainder } = allocatePaymentFifo(
      studentBills,
      amount,
      input.selectedTagihanIds
    );

    if (allocations.length === 0 || totalAllocated <= 0) {
      return {
        success: false,
        message: 'Siswa tidak memiliki tunggakan pada tagihan yang dipilih.',
      };
    }

    const tanggalBayar = sanitizeInput(input.tanggal_bayar || getTodayYmd(), 32);
    const noKwitansi = generateNextReceiptNumber(existingPayments, tanggalBayar);
    const nowIso = new Date().toISOString();
    const metode: MetodePembayaran =
      input.metode === 'TRANSFER' || input.metode === 'LAINNYA' ? input.metode : 'TUNAI';
    const cleanNote = sanitizeInput(input.catatan || '', 300);

    const createdPayments: PembayaranRecord[] = [];
    const paymentRowsToAppend: string[][] = [];
    const billUpdates: Array<{ id: string; values: string[] }> = [];

    for (const item of allocations) {
      const payment: PembayaranRecord = {
        id_pembayaran: generateId('BYR'),
        no_kwitansi: noKwitansi,
        id_tagihan: item.tagihan.id_tagihan,
        id_siswa: input.id_siswa,
        tanggal_bayar: tanggalBayar,
        nominal_bayar: item.allocatedAmount,
        metode,
        status_transaksi: 'VALID',
        id_petugas: auth.id,
        nama_petugas: auth.nama || auth.username,
        catatan: cleanNote,
        timestamp: nowIso,
      };
      createdPayments.push(payment);
      paymentRowsToAppend.push(pembayaranToDbRow(payment));

      const updatedBill: TagihanRecord = {
        ...item.tagihan,
        terbayar: item.newTerbayar,
        status: item.newStatus,
        updated_at: nowIso,
      };
      billUpdates.push({
        id: updatedBill.id_tagihan,
        values: tagihanToDbRow(updatedBill),
      });
    }

    await dbBatchAppendRows('PEMBAYARAN', paymentRowsToAppend);
    await dbBatchUpdateRows('TAGIHAN', billUpdates);

    await appendKeuanganLog(
      'INFO',
      'BAYAR_TAGIHAN',
      `Kwitansi ${noKwitansi}: ${input.studentName || input.id_siswa} bayar ${formatRupiah(totalAllocated)} (${metode}, ${allocations.length} pos tagihan)`,
      auth.id
    );

    return {
      success: true,
      message:
        unallocatedRemainder > 0
          ? `Pembayaran ${formatRupiah(totalAllocated)} dicatat (Kwitansi ${noKwitansi}). Kelebihan ${formatRupiah(unallocatedRemainder)} tidak dibebankan karena semua tagihan dipilih sudah lunas.`
          : `Pembayaran ${formatRupiah(totalAllocated)} berhasil dicatat (Kwitansi ${noKwitansi}).`,
      data: {
        no_kwitansi: noKwitansi,
        totalAllocated,
        unallocatedRemainder,
        payments: createdPayments,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal mencatat pembayaran.',
    };
  }
}

export async function voidPembayaranAction(input: {
  no_kwitansi?: string;
  id_pembayaran?: string;
  alasan: string;
}) {
  try {
    const auth = await requireBendaharaAccess();
    await ensureKeuanganTables();

    const alasan = sanitizeInput(input.alasan || '', 240);
    if (!alasan) {
      return { success: false, message: 'Alasan pembatalan (void) transaksi wajib diisi.' };
    }

    const [rawBills, rawPayments] = await Promise.all([
      dbGetAll('TAGIHAN', false),
      dbGetAll('PEMBAYARAN', false),
    ]);

    const allPayments = rawPayments
      .map((r) => normalizePembayaranRow(r))
      .filter((p) => p.id_pembayaran);
    const allBills = rawBills
      .map((r) => normalizeTagihanRow(r))
      .filter((b) => b.id_tagihan);

    const targets = allPayments.filter(
      (p) =>
        p.status_transaksi === 'VALID' &&
        ((input.id_pembayaran && p.id_pembayaran === input.id_pembayaran) ||
          (input.no_kwitansi && p.no_kwitansi === input.no_kwitansi))
    );

    if (targets.length === 0) {
      return { success: false, message: 'Transaksi valid tidak ditemukan atau sudah dibatalkan.' };
    }

    const targetIds = new Set(targets.map((t) => t.id_pembayaran));
    const affectedTagihanIds = new Set(targets.map((t) => t.id_tagihan));
    const nowIso = new Date().toISOString();

    const paymentUpdates: Array<{ id: string; values: string[] }> = [];
    const nextPayments = allPayments.map((p) => {
      if (!targetIds.has(p.id_pembayaran)) return p;
      const voided: PembayaranRecord = {
        ...p,
        status_transaksi: 'BATAL',
        catatan: `${p.catatan ? `${p.catatan} | ` : ''}[VOID oleh ${auth.nama}: ${alasan}]`,
      };
      paymentUpdates.push({ id: voided.id_pembayaran, values: pembayaranToDbRow(voided) });
      return voided;
    });

    // Hitung ulang total terbayar untuk setiap tagihan terdampak dari transaksi VALID yang tersisa
    const validSumByTagihan = new Map<string, number>();
    for (const p of nextPayments) {
      if (p.status_transaksi !== 'VALID') continue;
      validSumByTagihan.set(
        p.id_tagihan,
        (validSumByTagihan.get(p.id_tagihan) || 0) + p.nominal_bayar
      );
    }

    const billUpdates: Array<{ id: string; values: string[] }> = [];
    for (const bill of allBills) {
      if (!affectedTagihanIds.has(bill.id_tagihan)) continue;
      const recomputedPaid = Math.max(0, validSumByTagihan.get(bill.id_tagihan) || 0);
      const updatedBill: TagihanRecord = {
        ...bill,
        terbayar: recomputedPaid,
        status: computeTagihanStatus(bill.nominal_akhir, recomputedPaid),
        updated_at: nowIso,
      };
      billUpdates.push({ id: updatedBill.id_tagihan, values: tagihanToDbRow(updatedBill) });
    }

    await dbBatchUpdateRows('PEMBAYARAN', paymentUpdates);
    if (billUpdates.length > 0) {
      await dbBatchUpdateRows('TAGIHAN', billUpdates);
    }

    const refLabel = input.no_kwitansi || input.id_pembayaran || '';
    await appendKeuanganLog(
      'WARN',
      'VOID_PEMBAYARAN',
      `Pembatalan transaksi ${refLabel} (${targets.length} item). Alasan: ${alasan}`,
      auth.id
    );

    return {
      success: true,
      message: `Transaksi ${refLabel} berhasil dibatalkan (VOID) dan saldo tagihan siswa telah disesuaikan otomatis.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal membatalkan transaksi.',
    };
  }
}

export async function setStudentDispensasiAction(input: {
  id_siswa: string;
  studentName?: string;
  active: boolean;
  alasan?: string;
  berlakuSampai?: string;
}) {
  try {
    const auth = await requireBendaharaAccess();
    const settingsRes = await getSettingsAction();
    const settings = settingsRes.data || {};
    const cfg = parseKeuanganConfigFromSettings(settings);
    const nextMap = { ...(cfg.dispensasiBySiswaId || {}) };

    if (input.active) {
      const alasan = sanitizeInput(input.alasan || '', 240);
      if (!alasan) {
        return { success: false, message: 'Alasan dispensasi wajib diisi.' };
      }
      nextMap[input.id_siswa] = {
        alasan,
        berlakuSampai: sanitizeInput(input.berlakuSampai || '', 32),
        oleh: auth.nama || auth.username,
        createdAt: new Date().toISOString(),
      };
    } else {
      delete nextMap[input.id_siswa];
    }

    const updatedCfg: KeuanganConfig = {
      ...cfg,
      dispensasiBySiswaId: nextMap,
    };
    await persistSettingsUpdates(serializeKeuanganConfigToSettings(updatedCfg), auth.id);

    await appendKeuanganLog(
      'INFO',
      'SET_DISPENSASI_UJIAN',
      input.active
        ? `Berikan dispensasi kartu ujian untuk ${input.studentName || input.id_siswa}: ${input.alasan}`
        : `Cabut dispensasi kartu ujian untuk ${input.studentName || input.id_siswa}`,
      auth.id
    );

    return {
      success: true,
      message: input.active
        ? 'Dispensasi kartu ujian berhasil diaktifkan.'
        : 'Dispensasi kartu ujian berhasil dicabut.',
      data: updatedCfg,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal mengubah status dispensasi.',
    };
  }
}

export interface PostTagihanTersisaItemInput {
  id_siswa: string;
  nominal: number;
  potongan?: number;
  nama_tagihan?: string;
  catatan?: string;
  /** Jika true dan nominal=0, tetap buat baris saldo Rp 0 berstatus LUNAS agar terbedakan dari "Belum Diposting". */
  markZeroAsLunas?: boolean;
}

/**
 * Posting massal Tagihan Tersisa / Saldo Tunggakan Awal (dari Excel manual Bendahara atau input grid cepat per kelas).
 * Mendukung upsert aman (update bila belum melebihi nominal yang sudah terbayar di kasir, tidak menimbulkan duplikat).
 */
export async function postTagihanTersisaBatchAction(input: {
  periodeKey?: string;
  defaultNamaTagihan?: string;
  jatuhTempo?: string;
  replaceExistingMode?: 'UPDATE_UNPAID' | 'APPEND_NEW';
  items: PostTagihanTersisaItemInput[];
}) {
  try {
    const auth = await requireBendaharaAccess();
    await ensureKeuanganTables();

    const items = Array.isArray(input.items) ? input.items.filter((i) => i && i.id_siswa) : [];
    if (items.length === 0) {
      return { success: false, message: 'Tidak ada data siswa yang dikirim untuk diposting.' };
    }

    const [sessionRes, settingsRes, rawBills] = await Promise.all([
      getAcademicSessionAction(),
      getSettingsAction(),
      dbGetAll('TAGIHAN', false),
    ]);

    const settings = settingsRes.data || {};
    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';

    const periodeKey =
      sanitizeInput(input.periodeKey || '', 32) || buildDefaultPostingPeriode(tahunAjaran, semester);
    const defaultNama =
      sanitizeInput(input.defaultNamaTagihan || '', 150) ||
      `Sisa Tagihan Biaya Sekolah (${semester} ${tahunAjaran})`;
    const jatuhTempo = sanitizeInput(input.jatuhTempo || '', 32);
    const mode = input.replaceExistingMode || 'UPDATE_UNPAID';

    const existingBills = rawBills.map((r) => normalizeTagihanRow(r)).filter((b) => b.id_tagihan);
    // Index tagihan yang sudah ada di periode posting yang sama untuk upsert anti-duplikat
    const existingByStudent = new Map<string, TagihanRecord>();
    for (const b of existingBills) {
      if (
        b.tahun_ajaran === tahunAjaran &&
        b.semester.toUpperCase() === semester.toUpperCase() &&
        b.periode_bulan.toUpperCase() === periodeKey.toUpperCase()
      ) {
        existingByStudent.set(b.id_siswa, b);
      }
    }

    const nowIso = new Date().toISOString();
    const rowsToAppend: string[][] = [];
    const rowsToUpdate: Array<{ id: string; values: string[] }> = [];

    let createdCount = 0;
    let updatedCount = 0;
    let lunasZeroCount = 0;
    let protectedCount = 0;
    let skippedCount = 0;

    // Deduplikasi input per id_siswa (ambil baris terakhir bila ganda)
    const dedupMap = new Map<string, PostTagihanTersisaItemInput>();
    for (const item of items) {
      dedupMap.set(String(item.id_siswa).trim(), item);
    }

    for (const [sid, item] of dedupMap.entries()) {
      const nominal = Math.max(0, Math.round(Number(item.nominal) || 0));
      const potongan = Math.max(0, Math.min(nominal, Math.round(Number(item.potongan) || 0)));
      const nominalAkhir = Math.max(0, nominal - potongan);
      const customNama = sanitizeInput(item.nama_tagihan || '', 150);
      const customCatatan = sanitizeInput(item.catatan || '', 240);

      const finalNama =
        customNama ||
        (nominalAkhir === 0 ? 'Bebas Tunggakan / Lunas (Posting Excel)' : defaultNama);
      const finalCatatan =
        customCatatan ||
        (nominalAkhir === 0 ? 'Lunas di catatan Bendahara (Posting Saldo)' : 'Posting Sisa Tagihan Pra-Ujian');

      const existing = mode === 'UPDATE_UNPAID' ? existingByStudent.get(sid) : undefined;

      if (existing) {
        if (nominalAkhir < existing.terbayar) {
          // Proteksi kas: siswa sudah membayar lebih besar dari angka baru di loket kasir
          protectedCount++;
          continue;
        }
        const updated: TagihanRecord = {
          ...existing,
          kategori: 'SALDO_AWAL',
          nama_tagihan: finalNama,
          nominal,
          potongan,
          nominal_akhir: nominalAkhir,
          status: computeTagihanStatus(nominalAkhir, existing.terbayar),
          jatuh_tempo: jatuhTempo || existing.jatuh_tempo,
          catatan: finalCatatan,
          updated_at: nowIso,
        };
        rowsToUpdate.push({ id: updated.id_tagihan, values: tagihanToDbRow(updated) });
        updatedCount++;
        if (nominalAkhir === 0) lunasZeroCount++;
      } else {
        if (nominalAkhir === 0 && !item.markZeroAsLunas) {
          skippedCount++;
          continue;
        }
        const bill: TagihanRecord = {
          id_tagihan: generateId('TGH'),
          id_siswa: sanitizeInput(sid, 64),
          tahun_ajaran: tahunAjaran,
          semester,
          kategori: 'SALDO_AWAL',
          periode_bulan: periodeKey,
          nama_tagihan: finalNama,
          nominal,
          potongan,
          nominal_akhir: nominalAkhir,
          terbayar: 0,
          status: computeTagihanStatus(nominalAkhir, 0),
          jatuh_tempo: jatuhTempo,
          catatan: finalCatatan,
          updated_at: nowIso,
        };
        rowsToAppend.push(tagihanToDbRow(bill));
        createdCount++;
        if (nominalAkhir === 0) lunasZeroCount++;
      }
    }

    if (rowsToAppend.length > 0) {
      await dbBatchAppendRows('TAGIHAN', rowsToAppend);
    }
    if (rowsToUpdate.length > 0) {
      await dbBatchUpdateRows('TAGIHAN', rowsToUpdate);
    }

    await appendKeuanganLog(
      'INFO',
      'POST_TAGIHAN_TERSISA',
      `Posting saldo tagihan (${periodeKey}): ${createdCount} baru, ${updatedCount} diperbarui, ${lunasZeroCount} lunas Rp 0, ${protectedCount} dilindungi kas.`,
      auth.id
    );

    const parts: string[] = [];
    if (createdCount > 0) parts.push(`${createdCount} tagihan baru diposting`);
    if (updatedCount > 0) parts.push(`${updatedCount} tagihan diperbarui`);
    if (lunasZeroCount > 0) parts.push(`${lunasZeroCount} siswa ditandai Lunas Rp 0`);
    if (protectedCount > 0) {
      parts.push(`${protectedCount} dilewati karena sudah ada pembayaran kasir lebih besar`);
    }

    return {
      success: true,
      data: {
        createdCount,
        updatedCount,
        lunasZeroCount,
        protectedCount,
        skippedCount,
        periodeKey,
      },
      message:
        parts.length > 0
          ? `Berhasil: ${parts.join(' • ')}.`
          : 'Tidak ada perubahan tagihan yang perlu disimpan.',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal memposting tagihan tersisa.',
    };
  }
}
