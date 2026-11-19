'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Eye,
  FileSpreadsheet,
  FileText,
  IdCard,
  Lock,
  MessageSquare,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import {
  deleteTagihanAction,
  getTagihanBundleAction,
  recordPembayaranAction,
  setStudentDispensasiAction,
  TagihanKelasItem,
  TagihanStudentItem,
  updateTagihanAction,
  voidPembayaranAction,
} from '@/lib/actions/tagihan';
import {
  allocatePaymentFifo,
  buildWhatsAppReminderText,
  computeStudentEligibility,
  formatDateIdShort,
  formatRupiah,
  getDefaultKeuanganConfig,
  getSemesterMonths,
  getTodayYmd,
  KeuanganConfig,
  MetodePembayaran,
  parseRupiahNumber,
  PembayaranRecord,
  StudentExamEligibility,
  summarizeCashierHandover,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import { KwitansiGroupData, KwitansiPrintSheet } from '@/components/tagihan/KwitansiPrintSheet';
import { SuratTagihanItem, SuratTagihanSheet } from '@/components/tagihan/SuratTagihanSheet';
import {
  LaporanKeuanganMode,
  LaporanKeuanganSheet,
} from '@/components/tagihan/LaporanKeuanganSheet';
import { PostingTagihanPanel } from '@/components/tagihan/PostingTagihanPanel';
import { PanduanKeuanganModal } from '@/components/tagihan/PanduanKeuanganModal';
import { resolveKeuanganLeaderSigner } from '@/components/tagihan/KeuanganKopSurat';
import { appendObjectRows, createWorkbook, downloadWorkbook } from '@/lib/utils/excel';

type ActiveTab = 'MONITORING' | 'POSTING' | 'SURAT' | 'KASIR' | 'LAPORAN';

type PrintPayload =
  | { kind: 'KWITANSI'; data: KwitansiGroupData; copies: 1 | 2 }
  | { kind: 'SURAT'; items: SuratTagihanItem[] }
  | { kind: 'LAPORAN'; mode: LaporanKeuanganMode }
  | null;

export default function TagihanBiayaSekolahPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('MONITORING');
  const initialTabSetRef = useRef(false);

  // Core data from server
  const [students, setStudents] = useState<TagihanStudentItem[]>([]);
  const [kelasList, setKelasList] = useState<TagihanKelasItem[]>([]);
  const [bills, setBills] = useState<TagihanRecord[]>([]);
  const [payments, setPayments] = useState<PembayaranRecord[]>([]);
  const [config, setConfig] = useState<KeuanganConfig>(getDefaultKeuanganConfig);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [academicSession, setAcademicSession] = useState({
    tahunAjaran: '2026/2027',
    semester: 'GANJIL',
  });
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, StudentExamEligibility>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [canInputKasir, setCanInputKasir] = useState(false);
  const [financeRoleLabel, setFinanceRoleLabel] = useState('Lihat Saja (Read-Only)');
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Shared filters
  const [jenjangFilter, setJenjangFilter] = useState<'ALL' | 'SMP' | 'SMA'>('ALL');
  const [kelasFilter, setKelasFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'LAYAK' | 'BELUM_LAYAK' | 'LUNAS' | 'DISPENSASI' | 'BELUM_POSTING'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMonthlyMatrix, setShowMonthlyMatrix] = useState(false);

  // Kasir states
  const [kasirSearch, setKasirSearch] = useState('');
  const [kasirStudentId, setKasirStudentId] = useState('');
  const [kasirAmount, setKasirAmount] = useState('');
  const [kasirDate, setKasirDate] = useState(() => getTodayYmd());
  const [kasirMetode, setKasirMetode] = useState<MetodePembayaran>('TUNAI');
  const [kasirCatatan, setKasirCatatan] = useState('');
  const [kasirSelectedBillIds, setKasirSelectedBillIds] = useState<string[]>([]);
  const [kasirCopies, setKasirCopies] = useState<1 | 2>(2);
  const [showCashierHandover, setShowCashierHandover] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [lastKwitansiNo, setLastKwitansiNo] = useState<string | null>(null);

  // Surat Tagihan states
  const [suratSelectedIds, setSuratSelectedIds] = useState<Set<string>>(new Set());
  const [previewSuratStudentId, setPreviewSuratStudentId] = useState<string | null>(null);

  // Laporan states
  const [laporanMode, setLaporanMode] = useState<LaporanKeuanganMode>('REKAP_KELAS');
  const [laporanDateFrom, setLaporanDateFrom] = useState(() => `${getTodayYmd().slice(0, 7)}-01`);
  const [laporanDateTo, setLaporanDateTo] = useState(() => getTodayYmd());

  // Modals: Detail/Edit Tagihan, Dispensasi, Void
  const [detailStudent, setDetailStudent] = useState<TagihanStudentItem | null>(null);
  const [editingBill, setEditingBill] = useState<TagihanRecord | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editPotongan, setEditPotongan] = useState('');
  const [editCatatan, setEditCatatan] = useState('');

  const [dispensasiStudent, setDispensasiStudent] = useState<TagihanStudentItem | null>(null);
  const [dispensasiAlasan, setDispensasiAlasan] = useState('');
  const [dispensasiSampai, setDispensasiSampai] = useState('');

  const [voidTargetKwitansi, setVoidTargetKwitansi] = useState<string | null>(null);
  const [voidAlasan, setVoidAlasan] = useState('');

  // Print & Guide state
  const [printPayload, setPrintPayload] = useState<PrintPayload>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const loadData = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getTagihanBundleAction();
      if (!res.success || !res.data) {
        toast.error(res.message || 'Gagal memuat data tagihan biaya sekolah.');
        return;
      }
      const d = res.data;
      setStudents(d.students);
      setKelasList(d.kelasList);
      setBills(d.bills);
      setPayments(d.payments);
      setConfig(d.config);
      setSettings(d.settings);
      setAcademicSession(d.academicSession);
      setEligibilityMap(d.eligibilityMap);

      const bendaharaAllowed = Boolean(d.canManageBendahara ?? d.canEdit);
      const kasirAllowed = Boolean(d.canInputKasir ?? bendaharaAllowed);
      setCanEdit(bendaharaAllowed);
      setCanInputKasir(kasirAllowed);
      setFinanceRoleLabel(
        d.financeRoleLabel ||
          (bendaharaAllowed ? 'Bendahara Sekolah' : kasirAllowed ? 'Kasir Loket SPP' : 'Lihat Saja')
      );
      setIsAdminUser(d.currentUser?.role === 'ADMIN');

      // Pengalaman ramah jabatan: Kasir Loket otomatis langsung membuka Loket Kasir
      if (!initialTabSetRef.current) {
        initialTabSetRef.current = true;
        if (kasirAllowed && !bendaharaAllowed) {
          setActiveTab('KASIR');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat modul tagihan.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Safety guard: cegah non-Bendahara berada di tab POSTING
  useEffect(() => {
    if (!canEdit && activeTab === 'POSTING') {
      setActiveTab(canInputKasir ? 'KASIR' : 'MONITORING');
    }
  }, [canEdit, canInputKasir, activeTab]);

  // Trigger browser print reliably after printPayload mounts
  useEffect(() => {
    if (!printPayload) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [printPayload]);

  const semesterMonths = useMemo(
    () => getSemesterMonths(academicSession.tahunAjaran, academicSession.semester),
    [academicSession]
  );

  // Bills indexed by student for active TA/semester
  const billsByStudent = useMemo(() => {
    const map = new Map<string, TagihanRecord[]>();
    for (const b of bills) {
      const taOk = !b.tahun_ajaran || b.tahun_ajaran === academicSession.tahunAjaran;
      const semOk =
        !b.semester || b.semester.toUpperCase() === academicSession.semester.toUpperCase();
      if (!taOk || !semOk) continue;
      const arr = map.get(b.id_siswa);
      if (arr) arr.push(b);
      else map.set(b.id_siswa, [b]);
    }
    return map;
  }, [bills, academicSession]);

  const hasMonthlySppBills = useMemo(() => {
    const monthSet = new Set(semesterMonths.map((m) => m.periode));
    return bills.some((b) => b.kategori === 'SPP' && monthSet.has(b.periode_bulan));
  }, [bills, semesterMonths]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id_siswa, s])), [students]);
  const billMap = useMemo(() => new Map(bills.map((b) => [b.id_tagihan, b])), [bills]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (jenjangFilter !== 'ALL' && s.jenjang !== jenjangFilter) return false;
      if (kelasFilter !== 'ALL' && s.id_kelas !== kelasFilter) return false;
      if (q) {
        const hay = `${s.nama} ${s.nis} ${s.nama_kelas} ${s.jenjang}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'ALL') {
        const el = eligibilityMap[s.id_siswa];
        if (!el) return false;
        if (statusFilter === 'LAYAK' && !el.eligibleForExamCard) return false;
        if (statusFilter === 'BELUM_LAYAK' && el.eligibleForExamCard) return false;
        if (statusFilter === 'LUNAS' && el.status !== 'LUNAS') return false;
        if (statusFilter === 'DISPENSASI' && el.status !== 'DISPENSASI') return false;
        if (statusFilter === 'BELUM_POSTING' && el.status !== 'BELUM_ADA_TAGIHAN') return false;
      }
      return true;
    });
  }, [students, jenjangFilter, kelasFilter, statusFilter, searchQuery, eligibilityMap]);

  // Global KPI Stats
  const kpi = useMemo(() => {
    const scoped = students.filter(
      (s) => jenjangFilter === 'ALL' || s.jenjang === jenjangFilter
    );
    let totalTagihan = 0;
    let totalTerbayar = 0;
    let totalSisa = 0;
    let layakCount = 0;
    let lunasCount = 0;
    let dispensasiCount = 0;
    let belumLayakCount = 0;
    let postedCount = 0;

    for (const st of scoped) {
      const el = eligibilityMap[st.id_siswa];
      if (!el) continue;
      totalTagihan += el.totalTagihan;
      totalTerbayar += el.totalTerbayar;
      totalSisa += el.sisaTunggakan;
      if (el.status !== 'BELUM_ADA_TAGIHAN') postedCount++;
      if (el.status === 'LUNAS') lunasCount++;
      if (el.status === 'DISPENSASI') dispensasiCount++;
      if (el.eligibleForExamCard) layakCount++;
      else belumLayakCount++;
    }
    const pct = totalTagihan > 0 ? Math.round((totalTerbayar / totalTagihan) * 1000) / 10 : 0;
    return {
      totalStudents: scoped.length,
      postedCount,
      totalTagihan,
      totalTerbayar,
      totalSisa,
      pct,
      layakCount,
      lunasCount,
      dispensasiCount,
      belumLayakCount,
    };
  }, [students, jenjangFilter, eligibilityMap]);

  // Kas Hari Ini & Rekap Tutup Kas per Petugas Kasir
  const todayStats = useMemo(() => {
    const today = getTodayYmd();
    const todayValid = payments.filter(
      (p) => p.status_transaksi === 'VALID' && p.tanggal_bayar === today
    );
    const tunai = todayValid
      .filter((p) => p.metode === 'TUNAI')
      .reduce((acc, p) => acc + p.nominal_bayar, 0);
    const transfer = todayValid
      .filter((p) => p.metode !== 'TUNAI')
      .reduce((acc, p) => acc + p.nominal_bayar, 0);
    const receiptSet = new Set(todayValid.map((p) => p.no_kwitansi));
    const handover = summarizeCashierHandover(todayValid);
    return {
      today,
      total: tunai + transfer,
      tunai,
      transfer,
      receiptCount: receiptSet.size,
      handover,
    };
  }, [payments]);

  // Grouped Receipts (per no_kwitansi)
  const allReceiptGroups = useMemo(() => {
    const map = new Map<string, KwitansiGroupData & { isVoid: boolean; voidNominal: number }>();
    for (const p of payments) {
      const st = studentMap.get(p.id_siswa);
      if (!st) continue;
      const existing = map.get(p.no_kwitansi);
      const isValid = p.status_transaksi === 'VALID';
      if (existing) {
        existing.items.push({ payment: p, bill: billMap.get(p.id_tagihan) });
        if (isValid) {
          existing.totalBayar += p.nominal_bayar;
          existing.isVoid = false;
        } else {
          existing.voidNominal += p.nominal_bayar;
        }
      } else {
        map.set(p.no_kwitansi, {
          noKwitansi: p.no_kwitansi,
          tanggalBayar: p.tanggal_bayar,
          metode: p.metode,
          namaPetugas: p.nama_petugas,
          catatan: p.catatan,
          student: st,
          items: [{ payment: p, bill: billMap.get(p.id_tagihan) }],
          totalBayar: isValid ? p.nominal_bayar : 0,
          eligibility: eligibilityMap[st.id_siswa],
          isVoid: !isValid,
          voidNominal: isValid ? 0 : p.nominal_bayar,
        });
      }
    }
    return Array.from(map.values());
  }, [payments, studentMap, billMap, eligibilityMap]);

  const receiptGroups = useMemo(() => {
    const q = receiptSearch.trim().toLowerCase();
    if (!q) return allReceiptGroups;
    return allReceiptGroups.filter((g) =>
      `${g.noKwitansi} ${g.student.nama} ${g.student.nama_kelas} ${g.metode} ${g.namaPetugas || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [allReceiptGroups, receiptSearch]);

  // Kasir selected student & unpaid bills
  const kasirStudent = useMemo(
    () => studentMap.get(kasirStudentId) || null,
    [studentMap, kasirStudentId]
  );
  const kasirStudentBills = useMemo(() => {
    if (!kasirStudentId) return [];
    return (billsByStudent.get(kasirStudentId) || [])
      .filter((b) => b.nominal_akhir > b.terbayar)
      .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan));
  }, [billsByStudent, kasirStudentId]);

  const kasirFilteredStudents = useMemo(() => {
    const q = kasirSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.nama} ${s.nis} ${s.nama_kelas} ${s.jenjang}`.toLowerCase().includes(q)
    );
  }, [students, kasirSearch]);

  // Simulasi real-time alokasi FIFO & proyeksi status kartu ujian saat Kasir mengetik nominal
  const kasirSimulation = useMemo(() => {
    if (!kasirStudent) return null;
    const numericAmt = parseRupiahNumber(kasirAmount);
    if (numericAmt <= 0) return null;
    const allStudentBills = billsByStudent.get(kasirStudent.id_siswa) || [];
    const sim = allocatePaymentFifo(
      allStudentBills,
      numericAmt,
      kasirSelectedBillIds.length > 0 ? kasirSelectedBillIds : undefined
    );
    if (sim.allocations.length === 0) return null;

    const allocMap = new Map(sim.allocations.map((a) => [a.tagihan.id_tagihan, a]));
    const projectedBills = allStudentBills.map((b) => {
      const a = allocMap.get(b.id_tagihan);
      return a ? { ...b, terbayar: a.newTerbayar, status: a.newStatus } : b;
    });
    const projectedEl = computeStudentEligibility(
      kasirStudent.id_siswa,
      projectedBills,
      config,
      academicSession.tahunAjaran,
      academicSession.semester
    );
    return { ...sim, projectedEl };
  }, [kasirStudent, kasirAmount, billsByStudent, kasirSelectedBillIds, config, academicSession]);

  const openKasirForStudent = (st: TagihanStudentItem) => {
    setKasirStudentId(st.id_siswa);
    setKasirSelectedBillIds([]);
    const el = eligibilityMap[st.id_siswa];
    if (el && !el.eligibleForExamCard && el.minimalAgarLayak > 0) {
      setKasirAmount(String(el.minimalAgarLayak));
    } else if (el && el.sisaTunggakan > 0) {
      setKasirAmount(String(el.sisaTunggakan));
    } else {
      setKasirAmount('');
    }
    setActiveTab('KASIR');
  };

  // Handlers
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasirStudent) {
      toast.error('Pilih siswa terlebih dahulu.');
      return;
    }
    const numericAmt = parseRupiahNumber(kasirAmount);
    if (!numericAmt || numericAmt <= 0) {
      toast.error('Masukkan nominal pembayaran yang valid.');
      return;
    }
    setBusy(true);
    try {
      const res = await recordPembayaranAction({
        id_siswa: kasirStudent.id_siswa,
        studentName: kasirStudent.nama,
        amount: numericAmt,
        tanggal_bayar: kasirDate || getTodayYmd(),
        metode: kasirMetode,
        catatan: kasirCatatan,
        selectedTagihanIds: kasirSelectedBillIds.length > 0 ? kasirSelectedBillIds : undefined,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setKasirAmount('');
      setKasirCatatan('');
      setKasirSelectedBillIds([]);
      if (res.data?.no_kwitansi) {
        setLastKwitansiNo(res.data.no_kwitansi);
      }
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateBill = async () => {
    if (!editingBill) return;
    const nom = parseRupiahNumber(editNominal);
    const pot = parseRupiahNumber(editPotongan);
    setBusy(true);
    try {
      const res = await updateTagihanAction({
        id_tagihan: editingBill.id_tagihan,
        nominal: nom,
        potongan: pot,
        catatan: editCatatan,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setEditingBill(null);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBill = async (idTagihan: string) => {
    setBusy(true);
    try {
      const res = await deleteTagihanAction(idTagihan);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDispensasi = async (active: boolean) => {
    if (!dispensasiStudent) return;
    setBusy(true);
    try {
      const res = await setStudentDispensasiAction({
        id_siswa: dispensasiStudent.id_siswa,
        studentName: dispensasiStudent.nama,
        active,
        alasan: dispensasiAlasan,
        berlakuSampai: dispensasiSampai,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setDispensasiStudent(null);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTargetKwitansi) return;
    if (!voidAlasan.trim()) {
      toast.error('Isi alasan pembatalan transaksi terlebih dahulu.');
      return;
    }
    setBusy(true);
    try {
      const res = await voidPembayaranAction({
        no_kwitansi: voidTargetKwitansi,
        alasan: voidAlasan.trim(),
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setVoidTargetKwitansi(null);
      setVoidAlasan('');
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyWhatsApp = async (st: TagihanStudentItem) => {
    const el = eligibilityMap[st.id_siswa];
    if (!el) return;
    const prefix = st.jenjang === 'SMP' ? 'smp_' : 'sma_';
    const schoolName =
      settings[prefix + 'nama_sekolah_2'] ||
      settings['nama_sekolah_2'] ||
      (st.jenjang === 'SMP' ? 'SMP Advent Sogokmo' : 'SMA Advent Sogokmo');

    const text = buildWhatsAppReminderText({
      schoolName,
      studentName: st.nama,
      kelasName: st.nama_kelas,
      nis: st.nis,
      tahunAjaran: academicSession.tahunAjaran,
      semester: academicSession.semester,
      eligibility: el,
      rekeningInfo: config.rekeningInfo,
      bendaharaNama: config.bendaharaNama,
    });

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Pesan WhatsApp untuk orang tua ${st.nama} berhasil disalin!`);
    } catch {
      toast.error('Gagal menyalin pesan ke clipboard.');
    }
  };

  const triggerPrint = (payload: PrintPayload) => {
    setPrintPayload(null);
    window.setTimeout(() => setPrintPayload(payload), 40);
  };

  const siswaMenunggak = useMemo(
    () =>
      filteredStudents.filter((s) => {
        const el = eligibilityMap[s.id_siswa];
        return el && el.sisaTunggakan > 0;
      }),
    [filteredStudents, eligibilityMap]
  );

  const buildSuratItemForStudent = useCallback(
    (st: TagihanStudentItem): SuratTagihanItem => {
      const unpaid = (billsByStudent.get(st.id_siswa) || [])
        .filter((b) => b.nominal_akhir > b.terbayar)
        .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan));
      return {
        student: st,
        eligibility: eligibilityMap[st.id_siswa],
        unpaidBills: unpaid,
      };
    },
    [billsByStudent, eligibilityMap]
  );

  const handlePrintSuratMassal = () => {
    const selected = siswaMenunggak.filter((s) => suratSelectedIds.has(s.id_siswa));
    if (selected.length === 0) {
      toast.error('Centang minimal 1 siswa yang akan dicetak surat tagihannya.');
      return;
    }
    triggerPrint({
      kind: 'SURAT',
      items: selected.map(buildSuratItemForStudent),
    });
  };

  const handleExportExcel = async () => {
    try {
      const wb = createWorkbook();
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } },
      };

      // Sheet 1: Rekap per Kelas
      const wsKelas = wb.addWorksheet('Rekap per Kelas');
      const kelasRows = kelasList
        .filter((k) => jenjangFilter === 'ALL' || k.jenjang === jenjangFilter)
        .map((k, idx) => {
          const ks = students.filter((s) => s.id_kelas === k.id_kelas);
          let tag = 0;
          let pay = 0;
          let sisa = 0;
          let layak = 0;
          let belum = 0;
          for (const st of ks) {
            const el = eligibilityMap[st.id_siswa];
            if (!el) continue;
            tag += el.totalTagihan;
            pay += el.totalTerbayar;
            sisa += el.sisaTunggakan;
            if (el.eligibleForExamCard) layak++;
            else belum++;
          }
          return {
            No: idx + 1,
            Kelas: k.nama_kelas,
            Unit: k.jenjang,
            'Jumlah Siswa': ks.length,
            'Total Tagihan (Rp)': tag,
            'Terkumpul (Rp)': pay,
            'Sisa Tunggakan (Rp)': sisa,
            'Persen (%)': tag > 0 ? Math.round((pay / tag) * 1000) / 10 : 0,
            'Layak Ujian': layak,
            'Belum Layak': belum,
          };
        });
      appendObjectRows(wsKelas, kelasRows, { headerStyle });

      // Sheet 2: Status & Kelayakan per Siswa
      const wsSiswa = wb.addWorksheet('Status & Kelayakan Siswa');
      const siswaRows = students
        .filter((s) => jenjangFilter === 'ALL' || s.jenjang === jenjangFilter)
        .map((st, idx) => {
          const el = eligibilityMap[st.id_siswa];
          return {
            No: idx + 1,
            NIS: st.nis,
            'Nama Siswa': st.nama,
            Kelas: st.nama_kelas,
            Unit: st.jenjang,
            'Total Tagihan (Rp)': el?.totalTagihan || 0,
            'Terbayar (Rp)': el?.totalTerbayar || 0,
            'Sisa Tunggakan (Rp)': el?.sisaTunggakan || 0,
            'Persentase (%)': el?.persentaseTerbayar ?? 0,
            'Status Kartu': el?.status || '-',
            'Layak Cetak Kartu': el?.eligibleForExamCard ? 'YA' : 'TIDAK',
            'Min. Bayar Syarat (Rp)': el?.minimalAgarLayak || 0,
            'Rincian Belum Lunas': (el?.bulanMenunggak || []).join(', '),
          };
        });
      appendObjectRows(wsSiswa, siswaRows, { headerStyle });

      // Sheet 3: Riwayat Pemasukan Kas Valid
      const validPay = payments.filter((p) => {
        if (p.status_transaksi !== 'VALID') return false;
        const st = studentMap.get(p.id_siswa);
        if (jenjangFilter !== 'ALL' && st?.jenjang !== jenjangFilter) return false;
        return true;
      });
      const wsKas = wb.addWorksheet('Pemasukan Kas');
      const kasRows = validPay.map((p, idx) => {
        const st = studentMap.get(p.id_siswa);
        const bl = billMap.get(p.id_tagihan);
        return {
          No: idx + 1,
          Tanggal: p.tanggal_bayar,
          'No. Kwitansi': p.no_kwitansi,
          NIS: st?.nis || '',
          'Nama Siswa': st?.nama || p.id_siswa,
          Kelas: st?.nama_kelas || '',
          'Uraian Tagihan': bl?.nama_tagihan || p.id_tagihan,
          Metode: p.metode,
          'Nominal (Rp)': p.nominal_bayar,
          'Petugas Kasir': p.nama_petugas,
          Catatan: p.catatan,
        };
      });
      appendObjectRows(
        wsKas,
        kasRows.length > 0 ? kasRows : [{ Info: 'Belum ada transaksi kas valid.' }],
        { headerStyle }
      );

      // Sheet 4: Rekap Setoran per Petugas Kasir
      const wsKasir = wb.addWorksheet('Setoran per Kasir');
      const kasirRows = summarizeCashierHandover(validPay).map((c, idx) => ({
        No: idx + 1,
        'Nama Petugas Kasir': c.namaPetugas,
        'Jumlah Kwitansi': c.receiptCount,
        'Total Tunai (Rp)': c.tunai,
        'Total Transfer (Rp)': c.transfer,
        'Lainnya (Rp)': c.lainnya,
        'Total Setoran (Rp)': c.total,
      }));
      appendObjectRows(
        wsKasir,
        kasirRows.length > 0 ? kasirRows : [{ Info: 'Belum ada setoran kasir.' }],
        { headerStyle }
      );

      await downloadWorkbook(
        wb,
        `Laporan-Keuangan-WMVAA-${academicSession.tahunAjaran.replace('/', '-')}-${academicSession.semester}.xlsx`
      );
      toast.success('File Excel laporan keuangan (4 sheet) berhasil diunduh!');
    } catch {
      toast.error('Gagal mengekspor laporan Excel.');
    }
  };

  const renderClearanceBadge = (el?: StudentExamEligibility) => {
    if (!el || el.status === 'BELUM_ADA_TAGIHAN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
          Belum Diposting
        </span>
      );
    }
    if (el.status === 'LUNAS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> Lunas 100%
        </span>
      );
    }
    if (el.status === 'MEMENUHI_SYARAT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
          <ShieldCheck className="w-3 h-3" /> Layak ({el.persentaseTerbayar}%)
        </span>
      );
    }
    if (el.status === 'DISPENSASI') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
          <ShieldAlert className="w-3 h-3" /> Dispensasi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" /> Belum ({el.persentaseTerbayar}%)
      </span>
    );
  };

  const leaderSignerPreview = useMemo(
    () => resolveKeuanganLeaderSigner(jenjangFilter, settings),
    [jenjangFilter, settings]
  );

  if (loading) {
    return (
      <DashboardLoadingState
        title="Memuat Modul Tagihan & Biaya Sekolah..."
        subtitle="Menyinkronkan data tagihan siswa, kwitansi kasir, dan status kelayakan kartu ujian"
        accentClass="border-t-emerald-500"
      />
    );
  }

  // Susunan tab ramah sesuai jabatan:
  // - Kasir Loket SPP: Loket Kasir paling depan agar langsung kerja tanpa bingung
  // - Bendahara / Admin: Urut sesuai alur (Monitoring -> Posting Saldo/Excel -> Surat & WA -> Loket Kasir -> Laporan)
  const visibleTabs: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = canEdit
    ? [
        { id: 'MONITORING', label: '1. Monitoring & Kelayakan', icon: Wallet },
        { id: 'POSTING', label: '2. Posting Tagihan & Aturan', icon: Table2 },
        { id: 'SURAT', label: '3. Surat Tagihan & WA', icon: MessageSquare },
        { id: 'KASIR', label: '4. Loket Kasir & Kwitansi', icon: CreditCard },
        { id: 'LAPORAN', label: '5. Rekap & Laporan Resmi', icon: FileSpreadsheet },
      ]
    : canInputKasir
    ? [
        { id: 'KASIR', label: '1. Loket Kasir & Kwitansi', icon: CreditCard },
        { id: 'MONITORING', label: '2. Cek Status Siswa', icon: Wallet },
        { id: 'SURAT', label: '3. Cetak Surat & WA', icon: MessageSquare },
        { id: 'LAPORAN', label: '4. Rekap & Setoran', icon: FileSpreadsheet },
      ]
    : [
        { id: 'MONITORING', label: '1. Status Kelayakan Siswa', icon: Wallet },
        { id: 'SURAT', label: '2. Surat Tagihan & WA', icon: MessageSquare },
        { id: 'KASIR', label: '3. Riwayat Kwitansi', icon: Receipt },
        { id: 'LAPORAN', label: '4. Rekap & Laporan', icon: FileSpreadsheet },
      ];

  const previewSuratItem = previewSuratStudentId
    ? (() => {
        const st = studentMap.get(previewSuratStudentId);
        return st ? buildSuratItemForStudent(st) : null;
      })()
    : null;

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-6 fade-in print:hidden">
        <PageHeader
          icon={<Wallet className="w-6 h-6 sm:w-7 sm:h-7" />}
          iconBgClass="bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          title="Tagihan & Biaya Sekolah"
          description={`Posting tagihan tersisa dari Excel Bendahara, cetak surat pemberitahuan, loket kasir kwitansi, hingga validasi syarat Kartu Ujian (minimal ${config.minPercentForExamCard}%) • TA ${academicSession.tahunAjaran} (${academicSession.semester}).`}
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" /> Panduan
              </button>
              <button
                type="button"
                onClick={() => loadData(false)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
              </button>
              <Link
                href="/dashboard/kartu-peserta"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
              >
                <IdCard className="w-3.5 h-3.5" /> Ke Kartu Peserta
              </Link>
            </>
          }
        />

        {/* Role Banner + Alur Kerja 4 Langkah Cepat */}
        <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black shrink-0 ${
                  canEdit
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : canInputKasir
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Jabatan: {financeRoleLabel}
              </span>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                {canEdit
                  ? 'Wewenang Bendahara: posting sisa tagihan dari Excel/Grid, atur syarat kartu, cetak surat, terima pembayaran kasir, dispensasi & VOID.'
                  : canInputKasir
                  ? 'Wewenang Kasir Loket: terima pembayaran siswa di loket, terbitkan & cetak kwitansi 2 rangkap, cetak surat/WA, & pantau setoran harian.'
                  : 'Mode Lihat Saja (Read-Only): pantau status kelayakan ujian siswa, salin WA, dan cetak rekap laporan.'}
              </p>
            </div>
            {isAdminUser && (
              <Link
                href="/dashboard/settings"
                className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
              >
                Kelola Akun Bendahara / Kasir →
              </Link>
            )}
          </div>

          {/* 4-Step Interactive Workflow Guide */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => canEdit && setActiveTab('POSTING')}
              disabled={!canEdit}
              className={`text-left p-2.5 rounded-2xl border transition ${
                activeTab === 'POSTING'
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400'
                  : 'bg-slate-50/80 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] hover:border-emerald-300'
              } ${canEdit ? 'cursor-pointer' : 'opacity-65 cursor-default'}`}
            >
              <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                Langkah 1 • Bendahara
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                Posting Sisa Tagihan
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Input per kelas atau import Excel ({kpi.postedCount}/{kpi.totalStudents} siswa)
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SURAT')}
              className={`text-left p-2.5 rounded-2xl border transition cursor-pointer ${
                activeTab === 'SURAT'
                  ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400'
                  : 'bg-slate-50/80 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] hover:border-amber-300'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">
                Langkah 2 • Pra-Ujian
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                Cetak Surat &amp; Kirim WA
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Bagikan surat tagihan ke {siswaMenunggak.length} siswa menunggak
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('KASIR')}
              className={`text-left p-2.5 rounded-2xl border transition cursor-pointer ${
                activeTab === 'KASIR'
                  ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400'
                  : 'bg-slate-50/80 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] hover:border-sky-300'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-sky-700 dark:text-sky-400">
                Langkah 3 • Kasir Loket
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                Input Bayar &amp; Kwitansi
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Kas hari ini: {formatRupiah(todayStats.total)} ({todayStats.receiptCount} kwitansi)
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('LAPORAN')}
              className={`text-left p-2.5 rounded-2xl border transition cursor-pointer ${
                activeTab === 'LAPORAN'
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-400'
                  : 'bg-slate-50/80 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] hover:border-indigo-300'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400">
                Langkah 4 • Rekap &amp; Ujian
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                Kartu Ujian &amp; Laporan A4
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {kpi.layakCount}/{kpi.totalStudents} siswa layak cetak kartu ujian
              </div>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 shadow-sm">
            <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
              Total Tagihan Diposting
            </div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatRupiah(kpi.totalTagihan)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              {kpi.postedCount} / {kpi.totalStudents} siswa ({jenjangFilter === 'ALL' ? 'SMP & SMA' : jenjangFilter})
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 shadow-sm">
            <div className="text-[10.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Pembayaran Terkumpul
            </div>
            <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {formatRupiah(kpi.totalTerbayar)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Realisasi: <strong className="text-emerald-600">{kpi.pct}%</strong> • Hari ini:{' '}
              <strong className="font-mono text-slate-700 dark:text-slate-300">
                {formatRupiah(todayStats.total)}
              </strong>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 shadow-sm">
            <div className="text-[10.5px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Sisa Tunggakan
            </div>
            <div className="text-xl font-black font-mono text-rose-700 dark:text-rose-400 mt-1">
              {formatRupiah(kpi.totalSisa)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Lunas penuh: <strong className="text-emerald-600">{kpi.lunasCount}</strong> siswa
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 shadow-sm">
            <div className="text-[10.5px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Kelayakan Kartu Ujian (&ge;{config.minPercentForExamCard}%)
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              <span className="text-emerald-600">{kpi.layakCount}</span>{' '}
              <span className="text-xs font-bold text-slate-400">/ {kpi.totalStudents} Layak</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Terkunci: <strong className="text-rose-600">{kpi.belumLayakCount}</strong> • Dispensasi:{' '}
              <strong className="text-purple-600">{kpi.dispensasiCount}</strong>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-1.5 flex flex-wrap gap-1 shadow-sm">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Bar Shared (Monitoring & Surat) */}
        {(activeTab === 'MONITORING' || activeTab === 'SURAT') && (
          <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa, NIS, atau kelas..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={jenjangFilter}
              onChange={(e) => {
                setJenjangFilter(e.target.value as 'ALL' | 'SMP' | 'SMA');
                setKelasFilter('ALL');
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
            >
              <option value="ALL">Semua Unit (SMP &amp; SMA)</option>
              <option value="SMP">Unit SMP</option>
              <option value="SMA">Unit SMA</option>
            </select>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
            >
              <option value="ALL">Semua Kelas</option>
              {kelasList
                .filter((k) => jenjangFilter === 'ALL' || k.jenjang === jenjangFilter)
                .map((k) => (
                  <option key={k.id_kelas} value={k.id_kelas}>
                    {k.nama_kelas} ({k.jenjang})
                  </option>
                ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
            >
              <option value="ALL">Semua Status</option>
              <option value="BELUM_LAYAK">Terkunci / Belum Layak (&lt;{config.minPercentForExamCard}%)</option>
              <option value="LAYAK">Layak Kartu Ujian</option>
              <option value="LUNAS">Lunas 100%</option>
              <option value="DISPENSASI">Dispensasi</option>
              <option value="BELUM_POSTING">Belum Diposting Bendahara</option>
            </select>
            {activeTab === 'MONITORING' && hasMonthlySppBills && (
              <button
                type="button"
                onClick={() => setShowMonthlyMatrix((v) => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                  showMonthlyMatrix
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                }`}
              >
                {showMonthlyMatrix ? 'Tampilan Ringkas' : 'Matriks 6 Bulan'}
              </button>
            )}
          </div>
        )}

        {/* TAB 1: MONITORING & KELAYAKAN UJIAN (ADAPTIF EXCEL SALDO + BULANAN) */}
        {activeTab === 'MONITORING' && (
          <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
            {bills.length === 0 && (
              <div className="p-5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {canEdit ? (
                    <>
                      Belum ada tagihan siswa yang diposting pada semester ini. Mulai dengan memposting sisa tunggakan dari Excel atau input cepat per kelas di tab <strong>2. Posting Tagihan &amp; Aturan</strong>.
                    </>
                  ) : (
                    <>
                      Belum ada tagihan siswa yang diposting untuk semester ini. Hubungi <strong>Bendahara Sekolah</strong> untuk memposting daftar sisa tagihan siswa terlebih dahulu.
                    </>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('POSTING')}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                  >
                    Posting Tagihan Tersisa →
                  </button>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-center w-10">No</th>
                    <th className="py-3 px-3 min-w-[180px]">Siswa &amp; Kelas</th>
                    {showMonthlyMatrix && hasMonthlySppBills ? (
                      semesterMonths.map((m) => (
                        <th key={m.periode} className="py-3 px-2 text-center min-w-[54px]">
                          {m.shortLabel}
                        </th>
                      ))
                    ) : (
                      <th className="py-3 px-3 min-w-[185px]">Rincian Tagihan Diposting</th>
                    )}
                    <th className="py-3 px-3 text-right min-w-[115px]">Tagihan Awal</th>
                    <th className="py-3 px-3 text-right min-w-[125px]">Terbayar / Sisa</th>
                    <th className="py-3 px-3 text-center min-w-[130px]">Status Kartu</th>
                    <th className="py-3 px-3 text-right min-w-[205px]">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showMonthlyMatrix && hasMonthlySppBills ? semesterMonths.length + 6 : 7}
                        className="py-10 text-center text-slate-400 font-semibold"
                      >
                        Tidak ada siswa sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const sBills = billsByStudent.get(st.id_siswa) || [];
                      const el = eligibilityMap[st.id_siswa];
                      return (
                        <tr
                          key={st.id_siswa}
                          className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition"
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-slate-900 dark:text-white uppercase leading-tight">
                              {st.nama}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              {st.nama_kelas} ({st.jenjang}) • NIS {st.nis || '-'}
                            </div>
                          </td>

                          {showMonthlyMatrix && hasMonthlySppBills ? (
                            semesterMonths.map((m) => {
                              const mb = sBills.find(
                                (b) => b.periode_bulan === m.periode && b.kategori === 'SPP'
                              );
                              if (!mb) {
                                return (
                                  <td
                                    key={m.periode}
                                    className="py-2 px-1.5 text-center text-slate-300 dark:text-slate-700"
                                  >
                                    —
                                  </td>
                                );
                              }
                              const pillCls =
                                mb.status === 'LUNAS'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : mb.status === 'CICILAN'
                                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                                  : 'bg-rose-500/12 text-rose-700 dark:text-rose-400';
                              const label =
                                mb.status === 'LUNAS'
                                  ? '✓'
                                  : mb.status === 'CICILAN'
                                  ? `${Math.round((mb.terbayar / Math.max(1, mb.nominal_akhir)) * 100)}%`
                                  : '•';
                              return (
                                <td key={m.periode} className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setDetailStudent(st)}
                                    title={`${mb.nama_tagihan}: Terbayar ${formatRupiah(mb.terbayar)} / ${formatRupiah(mb.nominal_akhir)}`}
                                    className={`w-8 h-6 rounded-lg text-[10px] font-black ${pillCls} hover:opacity-80 cursor-pointer`}
                                  >
                                    {label}
                                  </button>
                                </td>
                              );
                            })
                          ) : (
                            <td className="py-2.5 px-3">
                              {sBills.length === 0 ? (
                                <span className="text-[11px] italic text-slate-400">
                                  Belum ada posting tagihan
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {sBills.slice(0, 2).map((b) => (
                                    <button
                                      key={b.id_tagihan}
                                      type="button"
                                      onClick={() => setDetailStudent(st)}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold truncate max-w-[190px] cursor-pointer ${
                                        b.status === 'LUNAS'
                                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                                          : b.status === 'CICILAN'
                                          ? 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
                                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                                      }`}
                                      title={`${b.nama_tagihan} (${formatRupiah(b.nominal_akhir)})`}
                                    >
                                      {b.nama_tagihan}
                                    </button>
                                  ))}
                                  {sBills.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => setDetailStudent(st)}
                                      className="px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                                    >
                                      +{sBills.length - 2} lainnya
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatRupiah(el?.totalTagihan || 0)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatRupiah(el?.totalTerbayar || 0)}
                            </div>
                            <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              Sisa: {formatRupiah(el?.sisaTunggakan || 0)}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {renderClearanceBadge(el)}
                            {el && !el.eligibleForExamCard && el.minimalAgarLayak > 0 && (
                              <div className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                                Min. {formatRupiah(el.minimalAgarLayak)}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {canInputKasir && (el?.sisaTunggakan || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openKasirForStudent(st)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                                >
                                  Bayar
                                </button>
                              )}
                              {(el?.sisaTunggakan || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerPrint({
                                      kind: 'SURAT',
                                      items: [buildSuratItemForStudent(st)],
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/25 cursor-pointer"
                                  title="Cetak Surat Tagihan Siswa Ini"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDetailStudent(st)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-white/15 cursor-pointer"
                              >
                                Detail
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDispensasiStudent(st);
                                    setDispensasiAlasan(el?.dispensasi?.alasan || '');
                                    setDispensasiSampai(el?.dispensasi?.berlakuSampai || '');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold hover:bg-purple-500/25 cursor-pointer"
                                  title="Kelola Dispensasi Kartu Ujian (Khusus Bendahara)"
                                >
                                  Disp.
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyWhatsApp(st)}
                                className="p-1.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 hover:bg-teal-500/25 cursor-pointer"
                                title="Salin Pesan WA Orang Tua"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: POSTING TAGIHAN TERSISA (EXCEL / GRID KELAS / BULANAN) & ATURAN — KHUSUS BENDAHARA */}
        {activeTab === 'POSTING' && canEdit && (
          <PostingTagihanPanel
            students={students}
            kelasList={kelasList}
            bills={bills}
            config={config}
            setConfig={setConfig}
            academicSession={academicSession}
            semesterMonths={semesterMonths}
            isAdminUser={isAdminUser}
            onRefreshData={() => loadData(true)}
          />
        )}

        {/* TAB 3: SURAT PEMBERITAHUAN TAGIHAN & PENGINGAT WHATSAPP */}
        {activeTab === 'SURAT' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    Surat Pemberitahuan Tagihan Pra-Ujian ({siswaMenunggak.length} Siswa Menunggak)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Cetak surat resmi berkop sekolah (2 surat per lembar A4 dengan garis potong) untuk diberikan kepada siswa sebelum ujian, atau salin pesan WhatsApp untuk orang tua.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const belumIds = siswaMenunggak
                        .filter((s) => !eligibilityMap[s.id_siswa]?.eligibleForExamCard)
                        .map((s) => s.id_siswa);
                      setSuratSelectedIds(new Set(belumIds));
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black cursor-pointer"
                  >
                    Pilih Semua Belum Layak
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSuratSelectedIds(new Set(siswaMenunggak.map((s) => s.id_siswa)))
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    Pilih Semua ({siswaMenunggak.length})
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintSuratMassal}
                    disabled={suratSelectedIds.size === 0}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak Surat ({suratSelectedIds.size})
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/[0.05] max-h-[460px] overflow-y-auto">
                {siswaMenunggak.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-400 font-semibold">
                    Semua siswa pada filter ini sudah bebas tunggakan (atau belum diposting).
                  </p>
                ) : (
                  siswaMenunggak.map((st) => {
                    const el = eligibilityMap[st.id_siswa];
                    const checked = suratSelectedIds.has(st.id_siswa);
                    return (
                      <div
                        key={st.id_siswa}
                        className="py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <label className="flex items-center gap-3 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(suratSelectedIds);
                              if (e.target.checked) next.add(st.id_siswa);
                              else next.delete(st.id_siswa);
                              setSuratSelectedIds(next);
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              {st.nama} {renderClearanceBadge(el)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold">
                              {st.nama_kelas} ({st.jenjang}) • Sisa{' '}
                              <strong className="text-rose-600 font-mono">
                                {formatRupiah(el?.sisaTunggakan || 0)}
                              </strong>
                              {!el?.eligibleForExamCard && el?.minimalAgarLayak > 0 && (
                                <span>
                                  {' '}
                                  • Min. bayar syarat kartu:{' '}
                                  <strong className="text-amber-700 dark:text-amber-400 font-mono">
                                    {formatRupiah(el.minimalAgarLayak)}
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewSuratStudentId((prev) =>
                                prev === st.id_siswa ? null : st.id_siswa
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyWhatsApp(st)}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" /> Salin WA
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerPrint({
                                kind: 'SURAT',
                                items: [buildSuratItemForStudent(st)],
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" /> Cetak
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pratinjau Langsung Surat Tagihan Berkop Sekolah */}
            {previewSuratItem && (
              <div className="bg-slate-200/70 dark:bg-black/40 rounded-3xl p-4 space-y-2.5 overflow-x-auto">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Pratinjau Surat Tagihan Resmi — {previewSuratItem.student.nama}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewSuratStudentId(null)}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Tutup Preview
                  </button>
                </div>
                <div className="min-w-[800px]">
                  <SuratTagihanSheet
                    items={[previewSuratItem]}
                    config={config}
                    settings={settings}
                    academicSession={academicSession}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LOKET KASIR & RIWAYAT KWITANSI + SETORAN HARIAN */}
        {activeTab === 'KASIR' && (
          <div className="space-y-5">
            {/* Bar Tutup Kas Hari Ini (Untuk Kasir & Bendahara) */}
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-4 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-500">
                      Kas Masuk Hari Ini ({formatDateIdShort(todayStats.today)})
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                      {formatRupiah(todayStats.total)}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
                  <div className="flex flex-wrap gap-4 font-bold text-slate-600 dark:text-slate-300">
                    <span>
                      Tunai: <strong className="font-mono text-slate-900 dark:text-white">{formatRupiah(todayStats.tunai)}</strong>
                    </span>
                    <span>
                      Transfer/Lain: <strong className="font-mono text-slate-900 dark:text-white">{formatRupiah(todayStats.transfer)}</strong>
                    </span>
                    <span>
                      Kwitansi: <strong className="text-indigo-600 dark:text-indigo-400">{todayStats.receiptCount}</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCashierHandover((v) => !v)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  {showCashierHandover ? 'Tutup Rekap Setoran' : 'Rekap Setoran per Kasir'}
                </button>
              </div>

              {showCashierHandover && (
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                  {todayStats.handover.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Belum ada pembayaran masuk hari ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {todayStats.handover.map((h) => (
                        <div
                          key={h.namaPetugas}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs"
                        >
                          <div className="flex items-center justify-between font-black text-slate-900 dark:text-white">
                            <span>{h.namaPetugas}</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">
                              {formatRupiah(h.total)}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-slate-500 font-semibold mt-1 flex flex-wrap gap-2.5">
                            <span>{h.receiptCount} kwitansi</span>
                            <span>Tunai: {formatRupiah(h.tunai)}</span>
                            <span>Transfer: {formatRupiah(h.transfer + h.lainnya)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Form Kasir Kiri (Khusus Kasir Loket / Bendahara / Admin) */}
              {canInputKasir && (
                <div className="xl:col-span-5 bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" /> Input Pembayaran Loket Kasir
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {financeRoleLabel}
                    </span>
                  </div>

                  <form onSubmit={handleRecordPayment} className="space-y-3.5">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Cari &amp; Pilih Siswa (Ketik Nama / NIS / Kelas)
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={kasirSearch}
                          onChange={(e) => setKasirSearch(e.target.value)}
                          placeholder="Ketik cepat nama siswa atau NIS..."
                          className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                        />
                        {kasirSearch && (
                          <button
                            type="button"
                            onClick={() => setKasirSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {kasirSearch.trim() && kasirFilteredStudents.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {kasirFilteredStudents.slice(0, 6).map((s) => {
                            const el = eligibilityMap[s.id_siswa];
                            const isPicked = s.id_siswa === kasirStudentId;
                            return (
                              <button
                                key={s.id_siswa}
                                type="button"
                                onClick={() => {
                                  setKasirStudentId(s.id_siswa);
                                  setKasirSelectedBillIds([]);
                                  if (el && !el.eligibleForExamCard && el.minimalAgarLayak > 0) {
                                    setKasirAmount(String(el.minimalAgarLayak));
                                  } else if (el && el.sisaTunggakan > 0) {
                                    setKasirAmount(String(el.sisaTunggakan));
                                  } else {
                                    setKasirAmount('');
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                  isPicked
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                                }`}
                              >
                                {s.nama} ({s.nama_kelas}) • Sisa {formatRupiah(el?.sisaTunggakan || 0)}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <select
                        value={kasirStudentId}
                        onChange={(e) => {
                          setKasirStudentId(e.target.value);
                          setKasirSelectedBillIds([]);
                          setKasirAmount('');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                      >
                        <option value="">-- Pilih Siswa ({kasirFilteredStudents.length}) --</option>
                        {kasirFilteredStudents.map((s) => {
                          const el = eligibilityMap[s.id_siswa];
                          return (
                            <option key={s.id_siswa} value={s.id_siswa}>
                              {s.nama} ({s.nama_kelas}) — Sisa {formatRupiah(el?.sisaTunggakan || 0)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {kasirStudent && (
                      <>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black uppercase text-slate-900 dark:text-white">
                              {kasirStudent.nama}
                            </span>
                            {renderClearanceBadge(eligibilityMap[kasirStudent.id_siswa])}
                          </div>
                          <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            <span>
                              Tagihan: {formatRupiah(eligibilityMap[kasirStudent.id_siswa]?.totalTagihan || 0)}
                            </span>
                            <span>
                              Terbayar: {formatRupiah(eligibilityMap[kasirStudent.id_siswa]?.totalTerbayar || 0)}
                            </span>
                            <span className="text-rose-600 dark:text-rose-400 font-black">
                              Sisa: {formatRupiah(eligibilityMap[kasirStudent.id_siswa]?.sisaTunggakan || 0)}
                            </span>
                          </div>

                          {/* Tombol Shortcut Nominal Cepat */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(eligibilityMap[kasirStudent.id_siswa]?.minimalAgarLayak || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setKasirAmount(
                                    String(eligibilityMap[kasirStudent.id_siswa].minimalAgarLayak)
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black cursor-pointer"
                              >
                                Syarat {config.minPercentForExamCard}%:{' '}
                                {formatRupiah(eligibilityMap[kasirStudent.id_siswa].minimalAgarLayak)}
                              </button>
                            )}
                            {(eligibilityMap[kasirStudent.id_siswa]?.sisaTunggakan || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setKasirAmount(
                                    String(eligibilityMap[kasirStudent.id_siswa].sisaTunggakan)
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                              >
                                Lunasi Semua ({formatRupiah(eligibilityMap[kasirStudent.id_siswa].sisaTunggakan)})
                              </button>
                            )}
                            {kasirStudentBills.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setKasirAmount(
                                    String(
                                      Math.max(
                                        0,
                                        kasirStudentBills[0].nominal_akhir - kasirStudentBills[0].terbayar
                                      )
                                    )
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white text-[10px] font-bold cursor-pointer"
                              >
                                1 Item ({formatRupiah(kasirStudentBills[0].nominal_akhir - kasirStudentBills[0].terbayar)})
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Checklist Tagihan Spesifik bila ada lebih dari 1 tagihan */}
                        {kasirStudentBills.length > 1 && (
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                              Target Tagihan (Kosong = otomatis urut terlama / FIFO)
                            </label>
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                              {kasirStudentBills.map((b) => {
                                const due = Math.max(0, b.nominal_akhir - b.terbayar);
                                const checked = kasirSelectedBillIds.includes(b.id_tagihan);
                                return (
                                  <label
                                    key={b.id_tagihan}
                                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-[11px] cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2 font-bold">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          setKasirSelectedBillIds((prev) =>
                                            e.target.checked
                                              ? [...prev, b.id_tagihan]
                                              : prev.filter((id) => id !== b.id_tagihan)
                                          );
                                        }}
                                      />
                                      {b.nama_tagihan}
                                    </span>
                                    <span className="font-mono font-black text-rose-600">
                                      Sisa {formatRupiah(due)}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Nominal Bayar (Rp)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={kasirAmount}
                          onChange={(e) => setKasirAmount(e.target.value)}
                          placeholder="Contoh: 250000"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Tanggal Bayar
                        </label>
                        <input
                          type="date"
                          value={kasirDate}
                          onChange={(e) => setKasirDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Metode Bayar
                        </label>
                        <select
                          value={kasirMetode}
                          onChange={(e) => setKasirMetode(e.target.value as MetodePembayaran)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                        >
                          <option value="TUNAI">Tunai (Loket)</option>
                          <option value="TRANSFER">Transfer Bank</option>
                          <option value="LAINNYA">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Format Cetak Kwitansi
                        </label>
                        <select
                          value={String(kasirCopies)}
                          onChange={(e) => setKasirCopies(e.target.value === '1' ? 1 : 2)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                        >
                          <option value="2">2 Rangkap / A4 (Siswa + Arsip)</option>
                          <option value="1">1 Rangkap / A4 (Besar)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Catatan Transaksi (Opsional)
                      </label>
                      <input
                        type="text"
                        value={kasirCatatan}
                        onChange={(e) => setKasirCatatan(e.target.value)}
                        placeholder="Mis. Titipan orang tua / bukti transfer BRI"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Preview Simulasi Alokasi FIFO & Proyeksi Status Kartu Ujian */}
                    {kasirSimulation && (
                      <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 space-y-1.5 text-[11px]">
                        <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Simulasi Pembayaran
                          </span>
                          <span className="font-mono">{formatRupiah(kasirSimulation.totalAllocated)}</span>
                        </div>
                        <div className="space-y-0.5 text-[10.5px] text-indigo-900/85 dark:text-indigo-200/85">
                          {kasirSimulation.allocations.map((a) => (
                            <div key={a.tagihan.id_tagihan} className="flex justify-between gap-2">
                              <span className="truncate">
                                • {a.tagihan.nama_tagihan}{' '}
                                <strong
                                  className={
                                    a.newStatus === 'LUNAS'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-sky-700 dark:text-sky-300'
                                  }
                                >
                                  ({a.newStatus === 'LUNAS' ? 'LUNAS' : 'CICILAN'})
                                </strong>
                              </span>
                              <span className="font-mono font-bold shrink-0">
                                +{formatRupiah(a.allocatedAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-1 border-t border-indigo-200/80 dark:border-indigo-500/20 flex items-center justify-between font-bold">
                          <span>Status Kartu Ujian setelah bayar:</span>
                          {renderClearanceBadge(kasirSimulation.projectedEl)}
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy || !kasirStudentId}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <Receipt className="w-4 h-4" />
                      {busy ? 'Memproses...' : 'Simpan Pembayaran & Terbitkan Kwitansi'}
                    </button>

                    {lastKwitansiNo && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                          Kwitansi <strong>{lastKwitansiNo}</strong> siap dicetak!
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const grp = allReceiptGroups.find((g) => g.noKwitansi === lastKwitansiNo);
                            if (grp) triggerPrint({ kind: 'KWITANSI', data: grp, copies: kasirCopies });
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak ({kasirCopies} Rangkap)
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* Riwayat Kwitansi Kanan */}
              <div
                className={`${
                  canInputKasir ? 'xl:col-span-7' : 'xl:col-span-12'
                } bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-3 shadow-sm`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-indigo-600" /> Riwayat Kwitansi ({receiptGroups.length})
                    </h3>
                    {!canInputKasir && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                        Mode Lihat Saja — Input pembayaran khusus Kasir Loket / Bendahara
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                    placeholder="Cari kwitansi / siswa / kasir..."
                    className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white w-60"
                  />
                </div>

                <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {receiptGroups.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400 font-semibold">
                      Belum ada riwayat pembayaran tercatat.
                    </p>
                  ) : (
                    receiptGroups.map((g) => (
                      <div
                        key={g.noKwitansi}
                        className={`py-3 flex flex-wrap items-center justify-between gap-3 ${
                          g.isVoid ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-400">
                              {g.noKwitansi}
                            </span>
                            <span className="text-xs font-extrabold uppercase text-slate-900 dark:text-white">
                              {g.student.nama}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              {g.student.nama_kelas}
                            </span>
                            {g.isVoid && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400">
                                VOID / BATAL
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {formatDateIdShort(g.tanggalBayar)} • {g.metode} • Petugas: {g.namaPetugas || '-'} •{' '}
                            {g.items.map((i) => i.bill?.nama_tagihan || i.payment.id_tagihan).join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {g.isVoid ? (
                            <span className="font-mono text-sm font-black text-rose-500 line-through">
                              {formatRupiah(g.voidNominal || g.totalBayar)}
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                              {formatRupiah(g.totalBayar)}
                            </span>
                          )}
                          {!g.isVoid && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  triggerPrint({ kind: 'KWITANSI', data: g, copies: kasirCopies })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" /> Kwitansi
                              </button>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoidTargetKwitansi(g.noKwitansi);
                                    setVoidAlasan('');
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 cursor-pointer"
                                  title="Batalkan (Void) Transaksi — Khusus Bendahara"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                canInputKasir && (
                                  <span
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400"
                                    title="Pembatalan (VOID) transaksi hanya dapat dilakukan oleh Bendahara Sekolah"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: REKAP & LAPORAN KEUANGAN RESMI (DENGAN DIREKTUR UNTUK SMP-SMA GABUNG) */}
        {activeTab === 'LAPORAN' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-3.5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Jenis Laporan Resmi
                    </label>
                    <select
                      value={laporanMode}
                      onChange={(e) => setLaporanMode(e.target.value as LaporanKeuanganMode)}
                      className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                    >
                      <option value="REKAP_KELAS">1. Rekapitulasi Tagihan &amp; Tunggakan per Kelas</option>
                      <option value="KAS_MASUK">2. Laporan Pemasukan Kas &amp; Setoran per Kasir</option>
                      <option value="KESIAPAN_UJIAN">3. Laporan Kesiapan Administrasi Kartu Ujian</option>
                      <option value="RINCIAN_TUNGGAKAN">4. Daftar Rincian Sisa Tunggakan per Siswa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Cakupan Unit &amp; Kop Sekolah
                    </label>
                    <select
                      value={jenjangFilter}
                      onChange={(e) => setJenjangFilter(e.target.value as 'ALL' | 'SMP' | 'SMA')}
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                    >
                      <option value="ALL">Gabungan SMP &amp; SMA (TTD Direktur)</option>
                      <option value="SMP">Khusus Unit SMP (TTD Kepsek SMP)</option>
                      <option value="SMA">Khusus Unit SMA (TTD Kepsek SMA)</option>
                    </select>
                  </div>
                  {laporanMode === 'KAS_MASUK' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                          Dari Tanggal
                        </label>
                        <input
                          type="date"
                          value={laporanDateFrom}
                          onChange={(e) => setLaporanDateFrom(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                          Sampai Tanggal
                        </label>
                        <input
                          type="date"
                          value={laporanDateTo}
                          onChange={(e) => setLaporanDateTo(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel (4 Sheet)
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPrint({ kind: 'LAPORAN', mode: laporanMode })}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Cetak PDF A4 Resmi
                  </button>
                </div>
              </div>

              {/* Info Pengesahan Otomatis */}
              <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Penandatangan Pimpinan:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {leaderSignerPreview.jabatan.replace(',', '')} —{' '}
                    {leaderSignerPreview.nama || 'Belum diisi di Pengaturan Sekolah'}
                  </strong>
                  {jenjangFilter === 'ALL' && (
                    <span className="ml-1.5 px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                      Laporan Gabungan → Kepsek SMA sebagai Direktur
                    </span>
                  )}
                </span>
                <span>
                  Bendahara:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {config.bendaharaNama || 'Belum diisi'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Pratinjau Langsung Laporan A4 */}
            <div className="bg-slate-200/70 dark:bg-black/40 rounded-3xl p-4 overflow-x-auto">
              <div className="min-w-[820px]">
                <LaporanKeuanganSheet
                  mode={laporanMode}
                  dateFrom={laporanDateFrom}
                  dateTo={laporanDateTo}
                  jenjangFilter={jenjangFilter}
                  students={students}
                  kelasList={kelasList}
                  bills={bills}
                  payments={payments}
                  eligibilityMap={eligibilityMap}
                  config={config}
                  settings={settings}
                  academicSession={academicSession}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL TAGIHAN & POTONGAN / BEASISWA PER SISWA */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl max-w-2xl w-full p-5 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-black uppercase text-slate-900 dark:text-white">
                  {detailStudent.nama}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {detailStudent.nama_kelas} ({detailStudent.jenjang}) • NIS {detailStudent.nis || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailStudent(null);
                  setEditingBill(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(billsByStudent.get(detailStudent.id_siswa) || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  Belum ada tagihan pada semester ini.
                </p>
              ) : (
                (billsByStudent.get(detailStudent.id_siswa) || [])
                  .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan))
                  .map((b) => (
                    <div
                      key={b.id_tagihan}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-black text-slate-900 dark:text-white">
                          {b.nama_tagihan}{' '}
                          <span className="text-[10px] font-bold text-slate-400">
                            ({b.kategori === 'SALDO_AWAL' ? 'POSTING SALDO' : b.kategori})
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                          Tagihan {formatRupiah(b.nominal)}
                          {b.potongan > 0 && (
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {' '}
                              − Potongan {formatRupiah(b.potongan)}
                            </span>
                          )}{' '}
                          = <strong>{formatRupiah(b.nominal_akhir)}</strong> • Terbayar{' '}
                          <strong className="text-emerald-600">{formatRupiah(b.terbayar)}</strong>
                        </div>
                        {b.catatan && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">{b.catatan}</div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBill(b);
                              setEditNominal(String(b.nominal));
                              setEditPotongan(String(b.potongan));
                              setEditCatatan(b.catatan);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black cursor-pointer"
                          >
                            Edit / Beasiswa
                          </button>
                          {b.terbayar === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBill(b.id_tagihan)}
                              className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 cursor-pointer"
                              title="Hapus Tagihan Belum Dibayar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>

            {editingBill && (
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 space-y-3">
                <div className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                  Edit Nominal / Beasiswa: {editingBill.nama_tagihan}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Nominal Tagihan (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editNominal}
                      onChange={(e) => setEditNominal(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Potongan / Beasiswa (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editPotongan}
                      onChange={(e) => setEditPotongan(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Catatan potongan / beasiswa (mis. Beasiswa Yayasan 50%)"
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBill(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUpdateBill}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DISPENSASI KARTU UJIAN */}
      {dispensasiStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Dispensasi Kartu Ujian
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {dispensasiStudent.nama} • {dispensasiStudent.nama_kelas}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDispensasiStudent(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Alasan / Dasar Izin Dispensasi
                </label>
                <textarea
                  rows={2}
                  value={dispensasiAlasan}
                  onChange={(e) => setDispensasiAlasan(e.target.value)}
                  placeholder="Contoh: Surat perjanjian orang tua disetujui Kepala Sekolah, lunas 5 Des."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Janji Bayar / Berlaku Sampai (Opsional)
                </label>
                <input
                  type="date"
                  value={dispensasiSampai}
                  onChange={(e) => setDispensasiSampai(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {eligibilityMap[dispensasiStudent.id_siswa]?.dispensasi ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveDispensasi(false)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-400 text-xs font-black cursor-pointer"
                >
                  Cabut Dispensasi
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDispensasiStudent(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveDispensasi(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black cursor-pointer"
                >
                  Aktifkan Dispensasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VOID / BATAL TRANSAKSI */}
      {voidTargetKwitansi && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-rose-600">
              Batalkan (VOID) Kwitansi {voidTargetKwitansi}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Transaksi tidak akan dihapus permanen melainkan ditandai <strong>BATAL</strong> di audit kas, dan saldo tagihan siswa otomatis dikembalikan.
            </p>
            <input
              type="text"
              value={voidAlasan}
              onChange={(e) => setVoidAlasan(e.target.value)}
              placeholder="Wajib isi alasan pembatalan (mis. salah nominal input)"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidTargetKwitansi(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmVoid}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                Konfirmasi VOID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANDUAN LENGKAP BENDAHARA & KASIR */}
      <PanduanKeuanganModal
        open={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        canEdit={canEdit}
        canInputKasir={canInputKasir}
        minPercentForExamCard={config.minPercentForExamCard}
      />

      {/* ROOT CETAK TERISOLASI */}
      {printPayload && (
        <div id="tagihan-print-root" className="hidden print:block bg-white">
          {printPayload.kind === 'KWITANSI' && (
            <KwitansiPrintSheet
              kwitansi={printPayload.data}
              config={config}
              settings={settings}
              academicSession={academicSession}
              copies={printPayload.copies}
            />
          )}
          {printPayload.kind === 'SURAT' && (
            <SuratTagihanSheet
              items={printPayload.items}
              config={config}
              settings={settings}
              academicSession={academicSession}
            />
          )}
          {printPayload.kind === 'LAPORAN' && (
            <LaporanKeuanganSheet
              mode={printPayload.mode}
              dateFrom={laporanDateFrom}
              dateTo={laporanDateTo}
              jenjangFilter={jenjangFilter}
              students={students}
              kelasList={kelasList}
              bills={bills}
              payments={payments}
              eligibilityMap={eligibilityMap}
              config={config}
              settings={settings}
              academicSession={academicSession}
            />
          )}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4 portrait; margin: 5mm; }
              body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .tagihan-print-page { page-break-after: always; break-after: page; }
              .tagihan-print-page:last-child { page-break-after: auto; break-after: auto; }
            }
          `,
        }}
      />
    </>
  );
}
