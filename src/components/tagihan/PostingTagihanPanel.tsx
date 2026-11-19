'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Save,
  SlidersHorizontal,
  Table2,
  Trash2,
  Upload,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  createSingleTagihanAction,
  generateTagihanBulananAction,
  postTagihanTersisaBatchAction,
  saveKeuanganConfigAction,
  TagihanKelasItem,
  TagihanStudentItem,
} from '@/lib/actions/tagihan';
import {
  buildDefaultPostingPeriode,
  formatRupiah,
  getTodayYmd,
  KeuanganConfig,
  parseRupiahNumber,
  SemesterMonthSlot,
  TagihanKategori,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import {
  appendObjectRows,
  createWorkbook,
  downloadWorkbook,
  loadWorkbookFromFile,
  worksheetToObjects,
} from '@/lib/utils/excel';
import { compressImageFileToDataUrl } from '@/lib/utils';

type PostingSubMode = 'GRID_KELAS' | 'IMPORT_EXCEL' | 'BULANAN';

interface GridDraftRow {
  nominalStr: string;
  catatan: string;
}

interface ParsedExcelPreviewRow {
  rowNum: number;
  student: TagihanStudentItem | null;
  rawIdentifier: string;
  rawName: string;
  nominal: number;
  potongan: number;
  keterangan: string;
  error?: string;
}

function pickColumnValue(
  row: Record<string, string | number | boolean | Date | null>,
  aliases: string[]
): string | number | boolean | Date | null {
  const normalizedEntries = Object.entries(row).map(([k, v]) => ({
    normKey: k.toLowerCase().replace(/[^a-z0-9]/g, ''),
    v,
  }));

  // 1. Prioritaskan kecocokan persis (exact match) di seluruh alias terlebih dahulu
  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const { normKey, v } of normalizedEntries) {
      if (normKey === normAlias && v !== null && v !== undefined && String(v).trim() !== '') {
        return v;
      }
    }
  }

  // 2. Fallback kecocokan sebagian (substring) dengan proteksi false-positive (mis. "jenis" tidak cocok ke "nis")
  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normAlias.length < 4) continue; // alias pendek seperti 'nis' wajib exact atau prefix/suffix khusus
    for (const { normKey, v } of normalizedEntries) {
      if (normKey.includes(normAlias) && v !== null && v !== undefined && String(v).trim() !== '') {
        return v;
      }
    }
  }
  return null;
}

export function PostingTagihanPanel({
  students,
  kelasList,
  bills,
  config,
  setConfig,
  academicSession,
  semesterMonths,
  isAdminUser,
  onRefreshData,
}: {
  students: TagihanStudentItem[];
  kelasList: TagihanKelasItem[];
  bills: TagihanRecord[];
  config: KeuanganConfig;
  setConfig: React.Dispatch<React.SetStateAction<KeuanganConfig>>;
  academicSession: { tahunAjaran: string; semester: string };
  semesterMonths: SemesterMonthSlot[];
  isAdminUser: boolean;
  onRefreshData: () => Promise<void>;
}) {
  const [subMode, setSubMode] = useState<PostingSubMode>('GRID_KELAS');
  const [busy, setBusy] = useState(false);

  // Shared Posting Context (Periode Saldo Awal / Ujian)
  const defaultPeriodeKey = useMemo(
    () => buildDefaultPostingPeriode(academicSession.tahunAjaran, academicSession.semester),
    [academicSession]
  );
  const [postingPeriodeKey, setPostingPeriodeKey] = useState(defaultPeriodeKey);
  const [postingLabel, setPostingLabel] = useState(
    `Sisa Tagihan Biaya Sekolah (Sem. ${academicSession.semester} ${academicSession.tahunAjaran})`
  );
  const [markZeroAsLunas, setMarkZeroAsLunas] = useState(true);

  useEffect(() => {
    setPostingPeriodeKey(defaultPeriodeKey);
  }, [defaultPeriodeKey]);

  // --- SUB-MODE 1: GRID PER KELAS ---
  const [gridKelasId, setGridKelasId] = useState<string>(() => kelasList[0]?.id_kelas || '');
  const [gridDrafts, setGridDrafts] = useState<Record<string, GridDraftRow>>({});
  const [bulkFillNominal, setBulkFillNominal] = useState('');
  const [bulkFillCatatan, setBulkFillCatatan] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!gridKelasId && kelasList.length > 0) {
      setGridKelasId(kelasList[0].id_kelas);
    }
  }, [kelasList, gridKelasId]);

  const gridStudents = useMemo(
    () => students.filter((s) => s.id_kelas === gridKelasId),
    [students, gridKelasId]
  );

  // Map existing posted bill per student for current postingPeriodeKey
  const existingPostedByStudent = useMemo(() => {
    const map = new Map<string, TagihanRecord>();
    for (const b of bills) {
      if (
        b.tahun_ajaran === academicSession.tahunAjaran &&
        b.semester.toUpperCase() === academicSession.semester.toUpperCase() &&
        b.periode_bulan.toUpperCase() === postingPeriodeKey.toUpperCase()
      ) {
        map.set(b.id_siswa, b);
      }
    }
    return map;
  }, [bills, academicSession, postingPeriodeKey]);

  // Pre-fill drafts when class or existing posted bills change
  useEffect(() => {
    const next: Record<string, GridDraftRow> = {};
    for (const st of gridStudents) {
      const ex = existingPostedByStudent.get(st.id_siswa);
      next[st.id_siswa] = {
        nominalStr: ex ? String(ex.nominal) : '',
        catatan:
          ex &&
          ex.nama_tagihan &&
          !ex.nama_tagihan.startsWith('Bebas Tunggakan')
            ? ex.nama_tagihan
            : '',
      };
    }
    setGridDrafts(next);
  }, [gridStudents, existingPostedByStudent]);

  const gridSummary = useMemo(() => {
    let withArrears = 0;
    let lunasZero = 0;
    let totalNominal = 0;
    for (const st of gridStudents) {
      const d = gridDrafts[st.id_siswa];
      const nom = parseRupiahNumber(d?.nominalStr ?? '');
      if (nom > 0) {
        withArrears++;
        totalNominal += nom;
      } else {
        lunasZero++;
      }
    }
    return { withArrears, lunasZero, totalNominal };
  }, [gridStudents, gridDrafts]);

  const handleApplyBulkNominal = (onlyEmpty: boolean) => {
    const num = parseRupiahNumber(bulkFillNominal);
    if (num <= 0) {
      toast.error('Masukkan nominal massal lebih dari Rp 0.');
      return;
    }
    setGridDrafts((prev) => {
      const next = { ...prev };
      for (const st of gridStudents) {
        const cur = next[st.id_siswa] || { nominalStr: '', catatan: '' };
        if (onlyEmpty && parseRupiahNumber(cur.nominalStr) > 0) continue;
        next[st.id_siswa] = { ...cur, nominalStr: String(num) };
      }
      return next;
    });
    toast.success(`Nominal ${formatRupiah(num)} diterapkan ke daftar kelas.`);
  };

  const handleApplyBulkCatatan = () => {
    const clean = bulkFillCatatan.trim();
    if (!clean) return;
    setGridDrafts((prev) => {
      const next = { ...prev };
      for (const st of gridStudents) {
        const cur = next[st.id_siswa] || { nominalStr: '', catatan: '' };
        next[st.id_siswa] = { ...cur, catatan: clean };
      }
      return next;
    });
    toast.success('Keterangan diterapkan ke seluruh siswa di kelas ini.');
  };

  const handleSubmitGridKelas = async () => {
    if (gridStudents.length === 0) {
      toast.error('Tidak ada siswa di kelas yang dipilih.');
      return;
    }
    setBusy(true);
    try {
      const items = gridStudents.map((st) => {
        const d = gridDrafts[st.id_siswa] || { nominalStr: '', catatan: '' };
        const nom = parseRupiahNumber(d.nominalStr);
        return {
          id_siswa: st.id_siswa,
          nominal: nom,
          nama_tagihan: d.catatan.trim() || undefined,
          catatan: d.catatan.trim() || undefined,
          markZeroAsLunas,
        };
      });

      const res = await postTagihanTersisaBatchAction({
        periodeKey: postingPeriodeKey,
        defaultNamaTagihan: postingLabel,
        replaceExistingMode: 'UPDATE_UNPAID',
        items,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  // --- SUB-MODE 2: IMPORT EXCEL ---
  const [templateScope, setTemplateScope] = useState<string>('ALL');
  const [excelPreview, setExcelPreview] = useState<ParsedExcelPreviewRow[]>([]);
  const [excelFilename, setExcelFilename] = useState('');

  const handleDownloadTemplateExcel = async () => {
    const scopedStudents = students.filter((s) => {
      if (templateScope === 'ALL') return true;
      if (templateScope === 'SMP' || templateScope === 'SMA') return s.jenjang === templateScope;
      return s.id_kelas === templateScope;
    });
    if (scopedStudents.length === 0) {
      toast.error('Tidak ada siswa untuk cakupan template yang dipilih.');
      return;
    }

    const wb = createWorkbook();
    const ws = wb.addWorksheet('Posting Tagihan Tersisa');

    const rows = scopedStudents.map((st, idx) => {
      const ex = existingPostedByStudent.get(st.id_siswa);
      return {
        NO: idx + 1,
        ID_SISWA: st.id_siswa,
        NIS: st.nis || '',
        NAMA_SISWA: st.nama,
        KELAS: st.nama_kelas,
        UNIT: st.jenjang,
        TAGIHAN_TERSISA_RP: ex ? ex.nominal : 0,
        POTONGAN_RP: ex ? ex.potongan : 0,
        KETERANGAN_RINCIAN:
          ex && !ex.nama_tagihan.startsWith('Bebas Tunggakan')
            ? ex.nama_tagihan
            : `Sisa SPP Sem. ${academicSession.semester}`,
      };
    });

    appendObjectRows(ws, rows, {
      columnWidths: [6, 18, 14, 30, 14, 8, 22, 16, 36],
      headerStyle: {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
      },
    });

    // Sheet Panduan Singkat
    const wsGuide = wb.addWorksheet('Panduan Pengisian');
    wsGuide.columns = [
      { header: 'Langkah', key: 'step', width: 12 },
      { header: 'Penjelasan untuk Bendahara', key: 'desc', width: 76 },
    ];
    wsGuide.addRows([
      {
        step: '1',
        desc: 'Jangan mengubah kolom ID_SISWA atau NIS agar sistem dapat mencocokkan data siswa dengan akurat.',
      },
      {
        step: '2',
        desc: 'Isi kolom TAGIHAN_TERSISA_RP dengan angka sisa tunggakan siswa dari file Excel keuangan Anda (boleh angka biasa mis. 450000).',
      },
      {
        step: '3',
        desc: 'Untuk siswa yang SUDAH LUNAS di Excel, biarkan angka 0 (otomatis ditandai LUNAS / LAYAK KARTU UJIAN).',
      },
      {
        step: '4',
        desc: 'Isi kolom KETERANGAN_RINCIAN dengan uraian singkat (mis. "Tunggakan SPP Sep–Nov 2026") agar tercetak jelas di Surat Tagihan.',
      },
      {
        step: '5',
        desc: 'Simpan file Excel ini, lalu unggah kembali di menu Tagihan & SPP -> Tab Posting Tagihan -> Import dari Excel.',
      },
    ]);

    const scopeName =
      templateScope === 'ALL'
        ? 'Semua-Unit'
        : templateScope === 'SMP' || templateScope === 'SMA'
        ? `Unit-${templateScope}`
        : kelasList.find((k) => k.id_kelas === templateScope)?.nama_kelas.replace(/\s+/g, '-') ||
          templateScope;

    await downloadWorkbook(wb, `Template-Posting-Tagihan-${scopeName}.xlsx`);
    toast.success(`Template Excel (${scopedStudents.length} siswa) berhasil diunduh!`);
  };

  const handleUploadExcelFile = async (file: File | null) => {
    if (!file) return;
    try {
      const wb = await loadWorkbookFromFile(file);
      const ws = wb.worksheets[0];
      if (!ws) {
        toast.error('Sheet pertama pada file Excel kosong.');
        return;
      }
      const rawRows = worksheetToObjects(ws);
      if (rawRows.length === 0) {
        toast.error('Tidak ditemukan baris data di file Excel.');
        return;
      }

      const byId = new Map(students.map((s) => [s.id_siswa.trim().toLowerCase(), s]));
      const byNis = new Map(
        students.filter((s) => s.nis.trim()).map((s) => [s.nis.trim().toLowerCase(), s])
      );
      const byName = new Map(students.map((s) => [s.nama.trim().toLowerCase(), s]));

      const parsed: ParsedExcelPreviewRow[] = rawRows.map((r, idx) => {
        const rawId = String(pickColumnValue(r, ['id_siswa', 'idsiswa']) ?? '').trim();
        const rawNis = String(pickColumnValue(r, ['nis', 'nisn', 'no_induk', 'nomor_induk']) ?? '').trim();
        const rawName = String(pickColumnValue(r, ['nama_siswa', 'nama_lengkap', 'nama', 'peserta']) ?? '').trim();
        const rawNom = pickColumnValue(r, [
          'tagihan_tersisa_rp',
          'tagihan_tersisa',
          'sisa_tagihan',
          'tunggakan',
          'nominal',
          'tagihan',
          'sisa',
        ]);
        const rawPot = pickColumnValue(r, ['potongan_rp', 'potongan', 'beasiswa', 'diskon']);
        const rawKet = String(
          pickColumnValue(r, ['keterangan_rincian', 'keterangan', 'rincian', 'uraian', 'catatan']) ?? ''
        ).trim();

        const student =
          (rawId ? byId.get(rawId.toLowerCase()) : undefined) ||
          (rawNis ? byNis.get(rawNis.toLowerCase()) : undefined) ||
          (rawName ? byName.get(rawName.toLowerCase()) : undefined) ||
          null;

        const nominal = parseRupiahNumber(rawNom);
        const potongan = Math.min(nominal, parseRupiahNumber(rawPot));

        return {
          rowNum: idx + 2,
          student,
          rawIdentifier: rawNis || rawId || '-',
          rawName: rawName || '-',
          nominal,
          potongan,
          keterangan: rawKet,
          error: student ? undefined : 'Siswa tidak ditemukan di database (cek ID_SISWA / NIS / Nama)',
        };
      });

      setExcelPreview(parsed);
      setExcelFilename(file.name);
      const matched = parsed.filter((p) => p.student).length;
      toast.success(`File dibaca: ${matched} dari ${parsed.length} baris cocok dengan data siswa.`);
    } catch (err) {
      toast.error(
        `Gagal membaca file Excel: ${err instanceof Error ? err.message : 'Format file tidak valid.'}`
      );
    }
  };

  const handleConfirmImportExcel = async () => {
    const validRows = excelPreview.filter((p) => p.student);
    if (validRows.length === 0) {
      toast.error('Tidak ada baris siswa valid untuk diposting.');
      return;
    }
    setBusy(true);
    try {
      const res = await postTagihanTersisaBatchAction({
        periodeKey: postingPeriodeKey,
        defaultNamaTagihan: postingLabel,
        replaceExistingMode: 'UPDATE_UNPAID',
        items: validRows.map((r) => ({
          id_siswa: r.student!.id_siswa,
          nominal: r.nominal,
          potongan: r.potongan,
          nama_tagihan: r.keterangan || undefined,
          catatan: r.keterangan || undefined,
          markZeroAsLunas,
        })),
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setExcelPreview([]);
      setExcelFilename('');
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  // --- SUB-MODE 3: GENERATE SPP BULANAN & TAGIHAN KHUSUS ---
  const [genScope, setGenScope] = useState<string>('ALL');
  const [genKategori, setGenKategori] = useState<TagihanKategori>('SPP');
  const [genNominalSmp, setGenNominalSmp] = useState<string>(
    config.tarifSppSmp > 0 ? String(config.tarifSppSmp) : ''
  );
  const [genNominalSma, setGenNominalSma] = useState<string>(
    config.tarifSppSma > 0 ? String(config.tarifSppSma) : ''
  );
  const [genPeriodes, setGenPeriodes] = useState<string[]>(() =>
    semesterMonths.map((m) => m.periode)
  );
  const [genCustomNama, setGenCustomNama] = useState('');
  const [genSaveDefault, setGenSaveDefault] = useState(true);

  const [singleStudentId, setSingleStudentId] = useState('');
  const [singleKategori, setSingleKategori] = useState<TagihanKategori>('UJIAN');
  const [singleNama, setSingleNama] = useState('');
  const [singlePeriode, setSinglePeriode] = useState(() => getTodayYmd().slice(0, 7));
  const [singleNominal, setSingleNominal] = useState('');
  const [singlePotongan, setSinglePotongan] = useState('0');
  const [singleCatatan, setSingleCatatan] = useState('');

  const handleGenerateMassal = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomSmp = parseRupiahNumber(genNominalSmp);
    const nomSma = parseRupiahNumber(genNominalSma);
    if (nomSmp <= 0 && nomSma <= 0) {
      toast.error('Isi minimal salah satu nominal tarif (SMP atau SMA).');
      return;
    }
    if (genPeriodes.length === 0) {
      toast.error('Pilih minimal 1 bulan / periode.');
      return;
    }
    setBusy(true);
    try {
      const res = await generateTagihanBulananAction({
        periodes: genPeriodes,
        targetScope: genScope,
        nominalSmp: nomSmp,
        nominalSma: nomSma,
        kategori: genKategori,
        customNama: genCustomNama,
        saveAsDefaultTarif: genSaveDefault,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSingleBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseRupiahNumber(singleNominal);
    const pot = parseRupiahNumber(singlePotongan);
    if (!singleStudentId || !singleNama.trim() || nom <= 0) {
      toast.error('Lengkapi siswa, nama tagihan, dan nominal.');
      return;
    }
    setBusy(true);
    try {
      const res = await createSingleTagihanAction({
        id_siswa: singleStudentId,
        kategori: singleKategori,
        periode_bulan: singlePeriode || getTodayYmd().slice(0, 7),
        nama_tagihan: singleNama.trim(),
        nominal: nom,
        potongan: pot,
        catatan: singleCatatan,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSingleNama('');
      setSingleNominal('');
      setSinglePotongan('0');
      setSingleCatatan('');
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    setBusy(true);
    try {
      const res = await saveKeuanganConfigAction(config);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  const handleUploadBendaharaTtd = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 360, 42000);
      setConfig((prev) => ({ ...prev, bendaharaTtdUrl: dataUrl }));
      toast.success('Gambar TTD Bendahara siap — klik "Simpan Pengaturan Keuangan" untuk menyimpan.');
    } catch {
      toast.error('Gagal memproses gambar tanda tangan.');
    }
  };

  const matchedExcelCount = excelPreview.filter((p) => p.student).length;
  const unmatchedExcelCount = excelPreview.length - matchedExcelCount;
  const totalExcelNominal = excelPreview
    .filter((p) => p.student)
    .reduce((acc, p) => acc + Math.max(0, p.nominal - p.potongan), 0);

  return (
    <div className="space-y-6">
      {/* Sub-mode selector: 3 Cara Posting Tagihan */}
      <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Posting Tagihan Tersisa ke Aplikasi (Untuk Syarat Ujian &amp; Loket Kasir)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Pindahkan sisa tunggakan siswa dari buku/Excel Bendahara dalam hitungan menit — siswa Rp 0 otomatis bebas tunggakan.
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10">
            {[
              { id: 'GRID_KELAS' as PostingSubMode, label: '1. Input Cepat per Kelas', icon: Table2 },
              { id: 'IMPORT_EXCEL' as PostingSubMode, label: '2. Import dari Excel (.xlsx)', icon: FileSpreadsheet },
              { id: 'BULANAN' as PostingSubMode, label: '3. Generate SPP Bulanan', icon: Plus },
            ].map((m) => {
              const Icon = m.icon;
              const active = subMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSubMode(m.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Konteks Periode Posting (Berlaku untuk Grid Kelas & Import Excel) */}
        {subMode !== 'BULANAN' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 items-end">
            <div className="md:col-span-5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Nama / Uraian Default di Surat Tagihan
              </label>
              <input
                type="text"
                value={postingLabel}
                onChange={(e) => setPostingLabel(e.target.value)}
                placeholder="Mis. Sisa Tagihan Biaya Sekolah (Pra-Ujian SAS)"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Kode Batch / Periode Posting
              </label>
              <input
                type="text"
                value={postingPeriodeKey}
                onChange={(e) => setPostingPeriodeKey(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-4">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markZeroAsLunas}
                  onChange={(e) => setMarkZeroAsLunas(e.target.checked)}
                />
                Tandai siswa nominal Rp 0 sebagai &quot;Sudah Lunas&quot;
              </label>
            </div>
          </div>
        )}

        {/* SUB-MODE 1: INPUT CEPAT GRID PER KELAS (MIRIP EXCEL) */}
        {subMode === 'GRID_KELAS' && (
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-end gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Pilih Kelas untuk Diposting
                  </label>
                  <select
                    value={gridKelasId}
                    onChange={(e) => setGridKelasId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-black text-slate-900 dark:text-white dark:[color-scheme:dark] min-w-[200px]"
                  >
                    {kelasList.map((k) => {
                      const kCount = students.filter((s) => s.id_kelas === k.id_kelas).length;
                      const postedCount = students.filter(
                        (s) => s.id_kelas === k.id_kelas && existingPostedByStudent.has(s.id_siswa)
                      ).length;
                      return (
                        <option key={k.id_kelas} value={k.id_kelas}>
                          {k.nama_kelas} ({k.jenjang}) — {postedCount}/{kCount} diposting
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-end gap-1.5">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Bantu Isi Nominal Massal (Opsional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={bulkFillNominal}
                      onChange={(e) => setBulkFillNominal(e.target.value)}
                      placeholder="Mis. 300000"
                      className="w-32 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyBulkNominal(true)}
                    className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
                    title="Isi siswa yang nominalnya masih 0/kosong"
                  >
                    Isi yg Kosong
                  </button>
                </div>

                <div className="flex items-end gap-1.5">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Samakan Keterangan
                    </label>
                    <input
                      type="text"
                      value={bulkFillCatatan}
                      onChange={(e) => setBulkFillCatatan(e.target.value)}
                      placeholder="Mis. SPP Sep–Nov 2026"
                      className="w-44 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBulkCatatan}
                    className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
                  >
                    Terapkan
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={busy || gridStudents.length === 0}
                onClick={handleSubmitGridKelas}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {busy ? 'Memposting...' : `Posting Tagihan Kelas Ini (${gridStudents.length} Siswa)`}
              </button>
            </div>

            <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#131a2c] border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Nama Siswa &amp; NIS</th>
                      <th className="py-2.5 px-3 w-48">Tagihan Tersisa (Rp)</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Rincian / Keterangan Bulan (Opsional)</th>
                      <th className="py-2.5 px-3 min-w-[160px] text-right">Preview Syarat Kartu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                    {gridStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold">
                          Pilih kelas yang memiliki siswa.
                        </td>
                      </tr>
                    ) : (
                      gridStudents.map((st, idx) => {
                        const draft = gridDrafts[st.id_siswa] || { nominalStr: '', catatan: '' };
                        const nom = parseRupiahNumber(draft.nominalStr);
                        const existing = existingPostedByStudent.get(st.id_siswa);
                        const minSyarat = Math.ceil((nom * config.minPercentForExamCard) / 100);
                        return (
                          <tr
                            key={st.id_siswa}
                            className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                          >
                            <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <div className="font-extrabold uppercase text-slate-900 dark:text-white leading-tight">
                                {st.nama}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                                <span>NIS {st.nis || '-'}</span>
                                {existing && (
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold">
                                    Sudah Diposting
                                  </span>
                                )}
                                {existing && existing.terbayar > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                                    Bayar: {formatRupiah(existing.terbayar)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                ref={(el) => {
                                  inputRefs.current[idx] = el;
                                }}
                                type="number"
                                min={0}
                                value={draft.nominalStr}
                                onChange={(e) =>
                                  setGridDrafts((prev) => ({
                                    ...prev,
                                    [st.id_siswa]: {
                                      ...(prev[st.id_siswa] || { catatan: '' }),
                                      nominalStr: e.target.value,
                                    },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inputRefs.current[idx + 1]?.focus();
                                    inputRefs.current[idx + 1]?.select();
                                  }
                                }}
                                placeholder="0 (Lunas)"
                                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={draft.catatan}
                                onChange={(e) =>
                                  setGridDrafts((prev) => ({
                                    ...prev,
                                    [st.id_siswa]: {
                                      ...(prev[st.id_siswa] || { nominalStr: '' }),
                                      catatan: e.target.value,
                                    },
                                  }))
                                }
                                placeholder={
                                  nom > 0 ? 'Mis. Tunggakan SPP Sep–Nov' : 'Lunas di catatan Bendahara'
                                }
                                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              {nom === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" /> Lunas / Bebas
                                </span>
                              ) : (
                                <div className="font-mono text-[10.5px]">
                                  <div className="font-black text-rose-600 dark:text-rose-400">
                                    {formatRupiah(nom)}
                                  </div>
                                  <div className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400">
                                    Min. {config.minPercentForExamCard}%: {formatRupiah(minSyarat)}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.03] border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-4 font-bold text-slate-600 dark:text-slate-300">
                  <span>
                    Ada Tagihan: <strong className="text-rose-600">{gridSummary.withArrears} siswa</strong>
                  </span>
                  <span>
                    Lunas (Rp 0): <strong className="text-emerald-600">{gridSummary.lunasZero} siswa</strong>
                  </span>
                  <span>
                    Total Diposting:{' '}
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {formatRupiah(gridSummary.totalNominal)}
                    </strong>
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-500 font-semibold">
                  Tip: Tekan <strong>Enter</strong> untuk loncat cepat ke baris siswa berikutnya.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODE 2: IMPORT DARI FILE EXCEL (.xlsx) */}
        {subMode === 'IMPORT_EXCEL' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Step A: Download Template */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                    A
                  </span>
                  <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                    Unduh Template Excel (Sudah Berisi Daftar Siswa)
                  </h4>
                </div>
                <p className="text-[11px] text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed">
                  Template sudah terisi NIS, Nama, &amp; Kelas seluruh siswa. Bendahara tinggal <strong>copy-paste</strong> kolom angka sisa tunggakan dari Excel manual ke kolom <code>TAGIHAN_TERSISA_RP</code>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={templateScope}
                    onChange={(e) => setTemplateScope(e.target.value)}
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-indigo-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="ALL">Semua Siswa (SMP &amp; SMA)</option>
                    <option value="SMP">Hanya Unit SMP</option>
                    <option value="SMA">Hanya Unit SMA</option>
                    {kelasList.map((k) => (
                      <option key={k.id_kelas} value={k.id_kelas}>
                        Kelas {k.nama_kelas} ({k.jenjang})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDownloadTemplateExcel}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
                  </button>
                </div>
              </div>

              {/* Step B: Upload Filled Excel */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                    B
                  </span>
                  <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wide">
                    Unggah File Excel Sisa Tagihan (.xlsx)
                  </h4>
                </div>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                  Setelah angka sisa tunggakan diisi di Excel dan disimpan, unggah file tersebut di sini. Sistem akan memvalidasi otomatis sebelum memposting.
                </p>
                <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {excelFilename ? `Ganti File (${excelFilename})` : 'Pilih File Excel (.xlsx)'}
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      handleUploadExcelFile(e.target.files?.[0] || null);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Preview Table Hasil Baca Excel */}
            {excelPreview.length > 0 && (
              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden space-y-0">
                <div className="p-3.5 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      ✓ Cocok: {matchedExcelCount} siswa
                    </span>
                    {unmatchedExcelCount > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Tidak cocok: {unmatchedExcelCount} baris
                      </span>
                    )}
                    <span className="font-mono text-slate-900 dark:text-white">
                      Total Tagihan: {formatRupiah(totalExcelNominal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExcelPreview([]);
                        setExcelFilename('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={busy || matchedExcelCount === 0}
                      onClick={handleConfirmImportExcel}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {busy ? 'Memposting...' : `Konfirmasi & Posting ${matchedExcelCount} Siswa`}
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-[#131a2c] text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-2 px-3 w-12">Baris</th>
                        <th className="py-2 px-3">Siswa Terdeteksi</th>
                        <th className="py-2 px-3 text-right">Tagihan Tersisa</th>
                        <th className="py-2 px-3 text-right">Potongan</th>
                        <th className="py-2 px-3">Keterangan</th>
                        <th className="py-2 px-3 text-center">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {excelPreview.map((r) => (
                        <tr
                          key={`xls-${r.rowNum}`}
                          className={r.student ? '' : 'bg-rose-50/70 dark:bg-rose-500/10'}
                        >
                          <td className="py-1.5 px-3 font-mono text-slate-400">#{r.rowNum}</td>
                          <td className="py-1.5 px-3">
                            {r.student ? (
                              <>
                                <div className="font-bold uppercase text-slate-900 dark:text-white">
                                  {r.student.nama}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {r.student.nama_kelas} ({r.student.jenjang}) • NIS {r.student.nis || '-'}
                                </div>
                              </>
                            ) : (
                              <div className="text-rose-700 dark:text-rose-300 font-bold">
                                {r.rawName} (ID/NIS: {r.rawIdentifier})
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-black">
                            {formatRupiah(r.nominal)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-indigo-600">
                            {r.potongan > 0 ? formatRupiah(r.potongan) : '-'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                            {r.keterangan || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            {r.student ? (
                              r.nominal - r.potongan <= 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700">
                                  Lunas (0)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-700">
                                  Siap Post
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] font-bold text-rose-600">{r.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB-MODE 3: GENERATE SPP BULANAN & TAGIHAN KHUSUS */}
        {subMode === 'BULANAN' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <form
              onSubmit={handleGenerateMassal}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3.5"
            >
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" /> Generate SPP Bulanan Otomatis (Opsional / Semester Baru)
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Target Siswa
                  </label>
                  <select
                    value={genScope}
                    onChange={(e) => setGenScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="ALL">Semua Siswa (SMP &amp; SMA)</option>
                    <option value="SMP">Seluruh Unit SMP</option>
                    <option value="SMA">Seluruh Unit SMA</option>
                    {kelasList.map((k) => (
                      <option key={k.id_kelas} value={k.id_kelas}>
                        Hanya {k.nama_kelas} ({k.jenjang})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Kategori
                  </label>
                  <select
                    value={genKategori}
                    onChange={(e) => setGenKategori(e.target.value as TagihanKategori)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="SPP">SPP Bulanan</option>
                    <option value="UJIAN">Biaya Ujian</option>
                    <option value="ASRAMA">Biaya Asrama</option>
                    <option value="LAINNYA">Biaya Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Tarif SMP (Rp / Bulan)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={genNominalSmp}
                    onChange={(e) => setGenNominalSmp(e.target.value)}
                    placeholder="Nominal fleksibel SMP"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Tarif SMA (Rp / Bulan)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={genNominalSma}
                    onChange={(e) => setGenNominalSma(e.target.value)}
                    placeholder="Nominal fleksibel SMA"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {semesterMonths.map((m) => {
                  const active = genPeriodes.includes(m.periode);
                  return (
                    <label
                      key={m.periode}
                      className={`flex items-center gap-1.5 p-2 rounded-xl border text-[11px] font-bold cursor-pointer ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-400 text-indigo-800 dark:text-indigo-200'
                          : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) =>
                          setGenPeriodes((prev) =>
                            e.target.checked
                              ? [...prev, m.periode]
                              : prev.filter((p) => p !== m.periode)
                          )
                        }
                      />
                      {m.shortLabel} {m.periode.slice(0, 4)}
                    </label>
                  );
                })}
              </div>

              {genKategori !== 'SPP' && (
                <input
                  type="text"
                  value={genCustomNama}
                  onChange={(e) => setGenCustomNama(e.target.value)}
                  placeholder="Nama tagihan kustom (mis. Biaya Ujian SAS)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                />
              )}

              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genSaveDefault}
                  onChange={(e) => setGenSaveDefault(e.target.checked)}
                />
                Simpan sebagai tarif default SPP SMP &amp; SMA
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
              >
                {busy ? 'Membuat Tagihan...' : 'Generate Tagihan Bulanan'}
              </button>
            </form>

            {/* Tambah Tagihan Khusus 1 Siswa */}
            <form
              onSubmit={handleCreateSingleBill}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3"
            >
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Tambah 1 Tagihan Khusus (Per Siswa)
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={singleStudentId}
                  onChange={(e) => setSingleStudentId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id_siswa} value={s.id_siswa}>
                      {s.nama} ({s.nama_kelas})
                    </option>
                  ))}
                </select>
                <select
                  value={singleKategori}
                  onChange={(e) => setSingleKategori(e.target.value as TagihanKategori)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                >
                  <option value="SALDO_AWAL">Tagihan Tersisa (Saldo)</option>
                  <option value="UJIAN">Biaya Ujian</option>
                  <option value="SPP">SPP</option>
                  <option value="ASRAMA">Asrama</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={singleNama}
                  onChange={(e) => setSingleNama(e.target.value)}
                  placeholder="Nama Tagihan (mis. Sisa Uang Asrama)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={singlePeriode}
                  onChange={(e) => setSinglePeriode(e.target.value)}
                  placeholder="Periode (mis. 2026-11)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  value={singleNominal}
                  onChange={(e) => setSingleNominal(e.target.value)}
                  placeholder="Nominal (Rp)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={singlePotongan}
                  onChange={(e) => setSinglePotongan(e.target.value)}
                  placeholder="Potongan (Rp)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={singleCatatan}
                  onChange={(e) => setSingleCatatan(e.target.value)}
                  placeholder="Catatan"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white/15 hover:opacity-90 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
              >
                + Tambahkan Tagihan Individu
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Pengaturan Aturan Kartu Ujian & Profil Bendahara Tunggal */}
      <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            Aturan Syarat Kartu Ujian &amp; Profil Bendahara Sekolah (1 Orang untuk SMP &amp; SMA)
          </h3>
          {isAdminUser && (
            <Link
              href="/dashboard/settings"
              className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Atur Akun Bendahara / Kasir &amp; Kop Sekolah →
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Kiri: Aturan Kartu Ujian */}
          <div className="lg:col-span-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Ambang Minimal Kartu (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.minPercentForExamCard}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      minPercentForExamCard: Math.max(
                        1,
                        Math.min(100, Number(e.target.value) || 50)
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-500">Default 50% (lunas setengah).</span>
              </div>
              <label className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enforceOnKartuPeserta}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, enforceOnKartuPeserta: e.target.checked }))
                  }
                  className="mt-0.5"
                />
                <span className="text-[10.5px] font-bold text-emerald-950 dark:text-emerald-200 leading-snug">
                  Kunci cetak Kartu Peserta di bawah {config.minPercentForExamCard}% (kecuali Dispensasi)
                </span>
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                Informasi Rekening Sekolah (Tampil di Surat Tagihan &amp; Pesan WA)
              </label>
              <textarea
                rows={2}
                value={config.rekeningInfo}
                onChange={(e) => setConfig((prev) => ({ ...prev, rekeningInfo: e.target.value }))}
                placeholder="Contoh: BRI / Bank Papua No. Rek 1234-5678 a.n. WMVAA Sogokmo"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Kanan: Identitas & TTD Bendahara */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Nama Lengkap Bendahara
                </label>
                <input
                  type="text"
                  value={config.bendaharaNama}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bendaharaNama: e.target.value }))}
                  placeholder="Mis. Ibu Ester Wetipo, S.E"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Jabatan Resmi
                </label>
                <input
                  type="text"
                  value={config.bendaharaJabatan}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, bendaharaJabatan: e.target.value }))
                  }
                  placeholder="Bendahara Sekolah"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  NIP / NRG (Opsional)
                </label>
                <input
                  type="text"
                  value={config.bendaharaNip}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bendaharaNip: e.target.value }))}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {config.bendaharaTtdUrl ? 'Ganti TTD Digital' : 'Upload TTD Bendahara'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadBendaharaTtd(e.target.files?.[0] || null)}
                  />
                </label>
                {config.bendaharaTtdUrl && (
                  <div className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-white border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.bendaharaTtdUrl}
                      alt="TTD Bendahara"
                      className="h-8 max-w-[120px] object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, bendaharaTtdUrl: '' }))}
                      className="p-1 rounded-lg bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 cursor-pointer"
                      title="Hapus TTD"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleSaveConfig}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {busy ? 'Menyimpan...' : 'Simpan Pengaturan Keuangan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
