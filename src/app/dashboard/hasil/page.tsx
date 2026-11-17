'use client';

import { getHasilAction, overrideHasilAction, deleteHasilAction, updateHasilAnswersAction } from '@/lib/actions/hasil';
import { scoreStudentEssaysWithAIAction } from '@/lib/actions/essay';
import { getSiswaAction } from '@/lib/actions/siswa';
import { getKunciListAction } from '@/lib/actions/kunci';
import { TIPE_SOAL_AKM, TIPE_COLOR, formatJawaban, getTipeDistribusi } from '@/lib/constants/tipe-soal';
import { normalizeTipe, normalizeAIAnswer, formatAnswerForDisplay, answersMatch } from '@/lib/ai/grader-engine';
import { createWorkbook, downloadWorkbook } from '@/lib/utils/excel';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Search, FileDown, RefreshCw, X, ChevronDown, ArrowUpDown,
  ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Eye, Pencil,
  CheckCircle2, AlertCircle, Loader2, Target,
  TrendingUp, TrendingDown, Users, ShieldAlert, Trash2, FileSpreadsheet, Printer, Save, Sparkles
} from 'lucide-react';

// ─── TipeBadge helper ─────────────────────────────────────────────────────────
function TipeBadge({ kode }: { kode: string }) {
  const def = TIPE_SOAL_AKM.find(t => t.kode === kode);
  if (!def) {
    const legacy = kode === 'A-E' ? { short: 'PG-E', color: 'indigo' }
      : kode === 'A-D' ? { short: 'PG-D', color: 'violet' }
      : { short: 'B/S', color: 'teal' };
    return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[legacy.color]}`}>{legacy.short}</span>;
  }
  return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[def.color]}`}>{def.short}</span>;
}

type SortField = 'nama' | 'skor' | 'timestamp' | 'ujian';
type SortDir = 'asc' | 'desc';
const ITEMS_PER_PAGE = 20;

export default function HasilPage() {
  // ─── Data ─────────────────────────────────────────────────────────────────
  const [hasil, setHasil] = useState<any[]>([]);
  const [siswa, setSiswa] = useState<any[]>([]);
  const [kunci, setKunci] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Filter / Sort ────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKunci, setFilterKunci] = useState('ALL');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LULUS' | 'TIDAK_LULUS' | 'REVIEW' | 'OVERRIDE'>('ALL');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ─── Pagination ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Modals ───────────────────────────────────────────────────────────────
  const [detailHasil, setDetailHasil] = useState<any | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<any | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Per-Question Interactive Edit State in Detail Modal ──────────────────
  const [editingQuestionNo, setEditingQuestionNo] = useState<number | null>(null);
  const [editingQuestionInput, setEditingQuestionInput] = useState('');
  const [pendingAnswerEdits, setPendingAnswerEdits] = useState<Record<number, any>>({});
  const [pendingEssayScores, setPendingEssayScores] = useState<Record<number, { poin_manual: number; ai_feedback?: string }>>({});
  const [scoringEssaysAI, setScoringEssaysAI] = useState<boolean>(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [hRes, sRes, kRes] = await Promise.all([
        getHasilAction(), getSiswaAction(), getKunciListAction()
      ]);
      if (hRes.success) setHasil(hRes.data || []);
      if (sRes.success) setSiswa(sRes.data || []);
      if (kRes.success) setKunci(kRes.data || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterKunci, filterKelas, filterStatus, sortField, sortDir]);

  // Reset per-question edit state when detail modal opens/closes
  useEffect(() => {
    setEditingQuestionNo(null);
    setEditingQuestionInput('');
    setPendingAnswerEdits({});
    setPendingEssayScores({});
  }, [detailHasil?.id_hasil]);

  // ─── Enrich data ──────────────────────────────────────────────────────────
  const enrichedHasil = useMemo(() => hasil.map(h => {
    const sInfo = siswa.find(s => s.id_siswa === h.id_siswa);
    const kInfo = kunci.find(k => k.id_kunci === h.id_kunci);
    let det: any = {};
    try { det = typeof h.detail_json === 'string' ? JSON.parse(h.detail_json) : (h.detail_json || {}); } catch { }
    const kelasLabel = sInfo?.nama_kelas || sInfo?.id_kelas || kInfo?.nama_kelas || 'Tanpa Kelas';
    return { ...h, sInfo, kInfo, det, kelasLabel };
  }), [hasil, siswa, kunci]);

  // ─── Daftar Kelas Unik untuk Dropdown Filter ──────────────────────────────
  const availableKelasList = useMemo(() => {
    const set = new Set<string>();
    enrichedHasil.forEach(h => {
      if (h.kelasLabel && h.kelasLabel !== 'Tanpa Kelas') set.add(h.kelasLabel);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enrichedHasil]);

  // ─── Filter + Sort ────────────────────────────────────────────────────────
  const filteredHasil = useMemo(() => {
    let list = [...enrichedHasil];
    const q = searchTerm.toLowerCase();
    if (q) list = list.filter(h =>
      h.sInfo?.nama?.toLowerCase().includes(q) ||
      String(h.sInfo?.nis).includes(q) ||
      h.kInfo?.judul_ujian?.toLowerCase().includes(q) ||
      h.kelasLabel?.toLowerCase().includes(q)
    );
    if (filterKunci !== 'ALL') list = list.filter(h => h.id_kunci === filterKunci);
    if (filterKelas !== 'ALL') list = list.filter(h => h.kelasLabel === filterKelas);
    if (filterStatus === 'LULUS') list = list.filter(h => h.is_lulus && !h.det?.need_review);
    else if (filterStatus === 'TIDAK_LULUS') list = list.filter(h => !h.is_lulus);
    else if (filterStatus === 'REVIEW') list = list.filter(h => h.det?.need_review);
    else if (filterStatus === 'OVERRIDE') list = list.filter(h => h.is_override);

    list.sort((a, b) => {
      let va: any, vb: any;
      if (sortField === 'nama') { va = a.sInfo?.nama || ''; vb = b.sInfo?.nama || ''; }
      else if (sortField === 'skor') { va = Number(a.skor) || 0; vb = Number(b.skor) || 0; }
      else if (sortField === 'ujian') { va = a.kInfo?.judul_ujian || ''; vb = b.kInfo?.judul_ujian || ''; }
      else { va = new Date(a.timestamp || 0).getTime(); vb = new Date(b.timestamp || 0).getTime(); }
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [enrichedHasil, searchTerm, filterKunci, filterKelas, filterStatus, sortField, sortDir]);

  // ─── Stats (mengikuti filter aktif agar Guru bisa melihat rata-rata per Kelas/Ujian) ───
  const stats = useMemo(() => {
    const source = filteredHasil;
    const total = source.length;
    const lulus = source.filter(h => h.is_lulus).length;
    const needReview = source.filter(h => h.det?.need_review && !h.is_override).length;
    const skor = source.map(h => Number(h.skor) || 0);
    const rataRata = total > 0 ? Math.round(skor.reduce((a, b) => a + b, 0) / total) : 0;
    const tertinggi = total > 0 ? Math.max(...skor) : 0;
    const terendah = total > 0 ? Math.min(...skor) : 0;
    const persenLulus = total > 0 ? Math.round((lulus / total) * 100) : 0;
    return { total, lulus, persenLulus, rataRata, tertinggi, terendah, needReview };
  }, [filteredHasil]);

  const totalPages = Math.ceil(filteredHasil.length / ITEMS_PER_PAGE);
  const paginatedHasil = filteredHasil.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };
  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field ? <ArrowUpDown className="w-3 h-3 opacity-30" /> :
      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-amber-500" />;

  const activeFilters = [
    searchTerm,
    filterKunci !== 'ALL' ? filterKunci : '',
    filterKelas !== 'ALL' ? filterKelas : '',
    filterStatus !== 'ALL' ? filterStatus : '',
  ].filter(Boolean).length;

  // ─── Simpan Koreksi Jawaban & Poin Esai Per-Butir di Modal Detail ─────────
  const handleSavePerQuestionEdits = async () => {
    if (!detailHasil || !detailHasil.kInfo?.data_json) return;
    const editedAnsNos = Object.keys(pendingAnswerEdits);
    const editedEssayNos = Object.keys(pendingEssayScores);
    const allEditedNos = Array.from(new Set([...editedAnsNos, ...editedEssayNos]));
    if (allEditedNos.length === 0) {
      toast.info('Belum ada perubahan butir jawaban atau poin esai.');
      return;
    }

    setSaving(true);
    try {
      const kJson: any[] = detailHasil.kInfo.data_json;
      const updatedAnswers = kJson.map((kItem: any, idx: number) => {
        const noSoal = Number(kItem.no || idx + 1);
        const detailRow = Array.isArray(detailHasil.det?.detail)
          ? detailHasil.det.detail.find((d: any) => Number(d.no) === noSoal) || detailHasil.det.detail[idx]
          : null;
        const origAns = detailRow ? detailRow.jawaban : detailHasil.det?.answers?.[idx];
        const nextAns = Object.prototype.hasOwnProperty.call(pendingAnswerEdits, noSoal)
          ? pendingAnswerEdits[noSoal]
          : (origAns ?? '?');

        const essayScoreEdit = pendingEssayScores[noSoal];
        const existingManual = detailRow?.poin_manual ?? (detailRow?.status === 'dinilai' ? detailRow?.poin_didapat : undefined);
        const finalManual = essayScoreEdit !== undefined ? essayScoreEdit.poin_manual : existingManual;
        const finalFeedback = essayScoreEdit?.ai_feedback ?? detailRow?.ai_feedback;

        return {
          no: noSoal,
          ans: nextAns,
          ...(finalManual !== undefined ? { poin_manual: finalManual } : {}),
          ...(finalFeedback ? { ai_feedback: finalFeedback } : {}),
        };
      });

      const editedNosStr = allEditedNos.join(', ');
      const res = await updateHasilAnswersAction(
        detailHasil.id_hasil,
        updatedAnswers,
        `Penilaian/koreksi butir soal nomor: ${editedNosStr}`
      );

      if (res.success && res.data) {
        toast.success(res.message);
        const newSkor = res.data.skor;
        const newLulus = newSkor >= (detailHasil.kkm_referensi || 70);
        setDetailHasil((prev: any) => prev ? {
          ...prev,
          skor: newSkor,
          is_lulus: newLulus,
          is_override: true,
          override_reason: `Penilaian/koreksi butir soal nomor: ${editedNosStr}`,
          det: res.data.detail_json,
        } : null);
        setPendingAnswerEdits({});
        setPendingEssayScores({});
        setEditingQuestionNo(null);
        fetchData(true);
      } else {
        toast.error(res.message || 'Gagal memperbarui jawaban.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Auto-Grade Esai dengan AI Gemini di Modal Detail Hasil ────────────────
  const handleAutoGradeEssaysInDetail = async () => {
    if (!detailHasil || !detailHasil.kInfo?.data_json) return;
    const bobot = detailHasil.kInfo.pengaturan_poin || {};
    const essayQuestions = (detailHasil.kInfo.data_json as any[]).filter(
      (k) => normalizeTipe(k.tipe) === 'essay'
    );
    if (essayQuestions.length === 0) return;

    setScoringEssaysAI(true);
    try {
      const payload = essayQuestions.map((k: any, idx: number) => {
        const no = Number(k.no || idx + 1);
        const detailRow = Array.isArray(detailHasil.det?.detail)
          ? detailHasil.det.detail.find((d: any) => Number(d.no) === no)
          : null;
        const currentAns = Object.prototype.hasOwnProperty.call(pendingAnswerEdits, no)
          ? pendingAnswerEdits[no]
          : (detailRow?.jawaban ?? '');
        const maxPoin = Number(k.poin ?? bobot[String(no)] ?? bobot.esai ?? bobot.benar ?? 8) || 8;
        return {
          no,
          studentAnswer: String(currentAns ?? ''),
          rubricOrKey: String(k.jawaban ?? ''),
          maxPoin,
        };
      });

      const res = await scoreStudentEssaysWithAIAction(payload, detailHasil.kInfo.judul_ujian);
      if (res.success && res.data) {
        const nextScores: Record<number, { poin_manual: number; ai_feedback?: string }> = {
          ...pendingEssayScores,
        };
        res.data.forEach((item) => {
          nextScores[Number(item.no)] = {
            poin_manual: item.score,
            ai_feedback: item.feedback,
          };
        });
        setPendingEssayScores(nextScores);
        toast.success(`${res.message} Klik 'Simpan Koreksi' untuk menyimpan ke database.`);
      } else {
        toast.error(res.message || 'Gagal menilai esai dengan AI.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScoringEssaysAI(false);
    }
  };

  // ─── Override & Delete ────────────────────────────────────────────────────
  const handleOverride = async () => {
    if (!overrideTarget) return;
    const score = Number(overrideScore);
    if (isNaN(score) || score < 0 || score > 100) { toast.error('Skor harus antara 0 dan 100'); return; }
    if (!overrideReason || overrideReason.trim().length < 6) { toast.error('Alasan override minimal 6 karakter'); return; }
    setSaving(true);
    try {
      const res = await overrideHasilAction(overrideTarget.id_hasil, score, overrideReason);
      if (res.success) {
        toast.success(res.message);
        setOverrideTarget(null); setOverrideScore(''); setOverrideReason('');
        fetchData(true);
      } else toast.error(res.message);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteHasil = async (h: any) => {
    const nama = h.sInfo?.nama || h.id_siswa;
    if (!confirm(`Hapus hasil pemeriksaan milik "${nama}" (${h.kInfo?.judul_ujian || h.id_kunci})?`)) return;
    setSaving(true);
    try {
      const res = await deleteHasilAction(h.id_hasil);
      if (res.success) {
        toast.success(res.message);
        if (detailHasil?.id_hasil === h.id_hasil) setDetailHasil(null);
        fetchData(true);
      } else toast.error(res.message);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ─── Export Excel Resmi (.xlsx Multi-Sheet) ───────────────────────────────
  const handleExportExcel = async () => {
    if (filteredHasil.length === 0) {
      toast.error('Tidak ada data hasil untuk diekspor.');
      return;
    }
    try {
      const wb = createWorkbook();
      const sortedByScore = [...filteredHasil].sort((a, b) => (Number(b.skor) || 0) - (Number(a.skor) || 0));

      // 1. SHEET 1: REKAP NILAI & PREDIKAT
      const ws1 = wb.addWorksheet('Rekap Nilai Siswa');
      ws1.columns = [
        { header: 'Peringkat', key: 'rank', width: 11 },
        { header: 'NIS', key: 'nis', width: 15 },
        { header: 'Nama Lengkap Siswa', key: 'nama', width: 30 },
        { header: 'Kelas', key: 'kelas', width: 14 },
        { header: 'Judul Ujian', key: 'ujian', width: 28 },
        { header: 'Mata Pelajaran', key: 'mapel', width: 22 },
        { header: 'Skor Akhir', key: 'skor', width: 12 },
        { header: 'KKM', key: 'kkm', width: 10 },
        { header: 'Predikat', key: 'predikat', width: 11 },
        { header: 'Status Ketuntasan', key: 'status', width: 18 },
        { header: 'Benar', key: 'benar', width: 10 },
        { header: 'Salah', key: 'salah', width: 10 },
        { header: 'Kosong', key: 'kosong', width: 10 },
        { header: 'Validasi AI', key: 'validasi', width: 18 },
        { header: 'Waktu Pemeriksaan', key: 'waktu', width: 22 },
      ];
      ws1.getRow(1).font = { bold: true };

      sortedByScore.forEach((h, idx) => {
        const skorNum = Number(h.skor) || 0;
        const kkmNum = Number(h.kkm_referensi) || 70;
        const predikat = skorNum >= 90 ? 'A (Sangat Baik)' : skorNum >= 80 ? 'B (Baik)' : skorNum >= kkmNum ? 'C (Cukup)' : 'D (Kurang)';
        ws1.addRow({
          rank: idx + 1,
          nis: h.sInfo?.nis || '—',
          nama: h.sInfo?.nama || h.id_siswa,
          kelas: h.kelasLabel || '—',
          ujian: h.kInfo?.judul_ujian || h.id_kunci,
          mapel: h.kInfo?.nama_mapel || '—',
          skor: skorNum,
          kkm: kkmNum,
          predikat,
          status: h.is_lulus ? 'TUNTAS' : 'REMEDIAL',
          benar: h.det?.benar || 0,
          salah: h.det?.salah || 0,
          kosong: h.det?.tidak_dijawab || 0,
          validasi: h.is_override ? 'Override Guru' : h.det?.need_review ? 'Perlu Review' : 'Valid AI',
          waktu: h.timestamp ? new Date(h.timestamp).toLocaleString('id-ID') : '—',
        });
      });

      // 2. SHEET 2: MATRIKS ANALISIS BUTIR SOAL
      const ws2 = wb.addWorksheet('Analisis Butir Soal');
      const maxQuestions = Math.max(
        0,
        ...filteredHasil.map(h => (h.kInfo?.data_json?.length || h.det?.detail?.length || 0))
      );

      if (maxQuestions > 0) {
        const cols: any[] = [
          { header: 'No', key: 'no', width: 6 },
          { header: 'NIS', key: 'nis', width: 14 },
          { header: 'Nama Siswa', key: 'nama', width: 28 },
          { header: 'Kelas', key: 'kelas', width: 12 },
          { header: 'Skor', key: 'skor', width: 10 },
        ];
        for (let q = 1; q <= maxQuestions; q++) {
          cols.push({ header: `S${q}`, key: `q${q}`, width: 7 });
        }
        ws2.columns = cols;
        ws2.getRow(1).font = { bold: true };

        // Baris Kunci Jawaban (jika difilter pada 1 kunci atau kunci pertama)
        const refKunci = filteredHasil[0]?.kInfo?.data_json;
        if (Array.isArray(refKunci) && refKunci.length > 0) {
          const kunciRow: Record<string, any> = {
            no: '★',
            nis: 'KUNCI',
            nama: 'KUNCI JAWABAN MASTER',
            kelas: '—',
            skor: 100,
          };
          for (let q = 1; q <= maxQuestions; q++) {
            const kItem = refKunci.find((k: any) => Number(k.no) === q) || refKunci[q - 1];
            kunciRow[`q${q}`] = kItem ? formatJawaban(kItem) : '—';
          }
          const addedKunci = ws2.addRow(kunciRow);
          addedKunci.font = { bold: true };
        }

        const correctPerQuestion: Record<number, number> = {};
        filteredHasil.forEach((h, idx) => {
          const rowObj: Record<string, any> = {
            no: idx + 1,
            nis: h.sInfo?.nis || '—',
            nama: h.sInfo?.nama || h.id_siswa,
            kelas: h.kelasLabel || '—',
            skor: Number(h.skor) || 0,
          };
          const details: any[] = Array.isArray(h.det?.detail) ? h.det.detail : [];
          for (let q = 1; q <= maxQuestions; q++) {
            const dItem = details.find((d: any) => Number(d.no) === q) || details[q - 1];
            const rawJwb = dItem ? dItem.jawaban : h.det?.answers?.[q - 1];
            rowObj[`q${q}`] = formatAnswerForDisplay(rawJwb ?? '—');
            if (dItem?.status === 'benar') {
              correctPerQuestion[q] = (correctPerQuestion[q] || 0) + 1;
            }
          }
          ws2.addRow(rowObj);
        });

        // Baris Daya Serap (%) per nomor soal
        const serapRow: Record<string, any> = {
          no: '%',
          nis: 'ANALISIS',
          nama: 'DAYA SERAP BUTIR SOAL (%)',
          kelas: `${filteredHasil.length} Siswa`,
          skor: stats.rataRata,
        };
        for (let q = 1; q <= maxQuestions; q++) {
          const pct = Math.round(((correctPerQuestion[q] || 0) / filteredHasil.length) * 100);
          serapRow[`q${q}`] = `${pct}%`;
        }
        const addedSerap = ws2.addRow(serapRow);
        addedSerap.font = { bold: true };
      }

      // 3. SHEET 3: DAFTAR REMEDIAL & PENGAYAAN
      const ws3 = wb.addWorksheet('Remedial & Pengayaan');
      ws3.columns = [
        { header: 'Program Tindak Lanjut', key: 'program', width: 24 },
        { header: 'NIS', key: 'nis', width: 15 },
        { header: 'Nama Siswa', key: 'nama', width: 30 },
        { header: 'Kelas', key: 'kelas', width: 14 },
        { header: 'Skor Diperoleh', key: 'skor', width: 15 },
        { header: 'Batas KKM', key: 'kkm', width: 12 },
        { header: 'Selisih KKM', key: 'selisih', width: 14 },
        { header: 'Rekomendasi Guru', key: 'rekomendasi', width: 36 },
      ];
      ws3.getRow(1).font = { bold: true };

      sortedByScore.forEach((h) => {
        const skorNum = Number(h.skor) || 0;
        const kkmNum = Number(h.kkm_referensi) || 70;
        const selisih = skorNum - kkmNum;
        const isLulus = skorNum >= kkmNum;
        ws3.addRow({
          program: isLulus ? 'PENGAYAAN (TUNTAS)' : 'REMEDIAL (BELUM TUNTAS)',
          nis: h.sInfo?.nis || '—',
          nama: h.sInfo?.nama || h.id_siswa,
          kelas: h.kelasLabel || '—',
          skor: skorNum,
          kkm: kkmNum,
          selisih: selisih >= 0 ? `+${selisih}` : `${selisih}`,
          rekomendasi: isLulus
            ? skorNum >= 90
              ? 'Tutor Sebaya / Materi Tantangan Lanjutan'
              : 'Pendalaman Materi Pengayaan'
            : 'Bimbingan Khusus & Ujian Perbaikan (Remedial)',
        });
      });

      const labelKelas = filterKelas !== 'ALL' ? `_${filterKelas.replace(/\s+/g, '-')}` : '';
      const filename = `Laporan_Nilai_LJK${labelKelas}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadWorkbook(wb, filename);
      toast.success(`📊 Laporan Excel Resmi (3 Sheet) berhasil diunduh!`);
    } catch (e: any) {
      toast.error(`Gagal mengekspor Excel: ${e.message}`);
    }
  };

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Timestamp', 'NIS', 'Nama', 'Kelas', 'Ujian', 'Mapel', 'Skor', 'KKM', 'Lulus', 'Benar', 'Salah', 'Kosong', 'Confidence', 'Status AI'],
      ...filteredHasil.map(h => [
        h.timestamp ? new Date(h.timestamp).toLocaleString('id-ID') : '',
        h.sInfo?.nis || '', `"${(h.sInfo?.nama || '').replace(/"/g, '""')}"`,
        `"${(h.sInfo?.nama_kelas || h.sInfo?.id_kelas || '').replace(/"/g, '""')}"`,
        `"${(h.kInfo?.judul_ujian || '').replace(/"/g, '""')}"`,
        h.kInfo?.nama_mapel || '',
        h.skor, h.kkm_referensi, h.is_lulus ? 'Ya' : 'Tidak',
        h.det?.benar || 0, h.det?.salah || 0, h.det?.tidak_dijawab || 0,
        h.det?.confidence_score ? `${(h.det.confidence_score * 100).toFixed(0)}%` : '—',
        h.is_override ? 'Manual Override' : h.det?.need_review ? 'Need Review' : 'AI Validated'
      ])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `laporan_nilai_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredHasil.length} data berhasil diekspor!`);
  };

  // ─── Skor bar ─────────────────────────────────────────────────────────────
  const SkorBar = ({ skor, kkm }: { skor: number; kkm: number }) => {
    const pct = Math.min(100, Math.max(0, skor));
    const lulus = skor >= kkm;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${lulus ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] font-black tabular-nums ${lulus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{skor}</span>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      <div className="text-slate-500 dark:text-slate-400 font-bold animate-pulse tracking-tight">Menghitung Skor & Akurasi...</div>
    </div>
  );

  return (
    <div className="p-3.5 sm:p-10 max-w-[1600px] mx-auto space-y-5 sm:space-y-8 fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
            <span className="p-2.5 sm:p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-2xl sm:rounded-[1.5rem] text-amber-500 text-xl sm:text-2xl shadow-inner border border-amber-500/10 dark:border-amber-500/20">🏆</span>
            Hasil & Skor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2 font-semibold text-xs sm:text-sm max-w-xl">
            Monitor nilai real-time, filter per kelas, koreksi jawaban per butir soal, dan unduh laporan Excel 3-Sheet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button onClick={handleExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 active:scale-95">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)
          </button>
          <button onClick={handleExport}
            className="flex items-center justify-center gap-1.5 bg-amber-600/10 hover:bg-amber-600 text-amber-600 dark:text-amber-400 hover:text-white border border-amber-500/25 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95">
            <FileDown className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => window.print()}
            title="Cetak Rekap Nilai Kelas (A4)"
            className="flex items-center justify-center gap-1.5 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] hover:border-indigo-500/40 text-slate-700 dark:text-slate-300 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95">
            <Printer className="w-4 h-4 text-indigo-500" /> <span className="hidden sm:inline">Cetak</span>
          </button>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all disabled:opacity-50 shadow-sm active:scale-95">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Stats Bar (Ringkas 3 kolom di HP agar tidak kewalahan scroll) ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        {[
          { label: 'Total Scan', value: stats.total, icon: <Users className="w-4 h-4" />, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-500/10' },
          { label: 'Siswa Lulus', value: `${stats.persenLulus}%`, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Rata Skor', value: stats.rataRata, icon: <Target className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Tertinggi', value: stats.tertinggi, icon: <TrendingUp className="w-4 h-4" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' },
          { label: 'Terendah', value: stats.terendah, icon: <TrendingDown className="w-4 h-4" />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Review', value: stats.needReview, icon: <ShieldAlert className="w-4 h-4" />, color: stats.needReview > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-600', bg: stats.needReview > 0 ? 'bg-amber-500/10' : 'bg-slate-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.05] rounded-2xl p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm backdrop-blur-sm">
            <div className={`hidden sm:flex w-9 h-9 ${s.bg} rounded-xl items-center justify-center ${s.color} flex-shrink-0`}>{s.icon}</div>
            <div className="min-w-0">
              <div className={`text-lg sm:text-xl font-black leading-tight ${s.color}`}>{s.value}</div>
              <div className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-wider leading-tight truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter ── */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 print:hidden flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors pointer-events-none" />
          <input type="text" placeholder="Cari nama siswa, NIS, kelas, atau ujian..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-10 pr-9 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Filter Kelas & Ujian Side-by-Side di HP */}
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          <div className="relative">
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
              className={`w-full sm:w-auto appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-3 sm:pl-4 pr-8 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none transition-all cursor-pointer shadow-sm sm:max-w-[180px] ${filterKelas !== 'ALL' ? 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
              <option value="ALL">Semua Kelas</option>
              {availableKelasList.map(kls => <option key={kls} value={kls}>Kelas {kls}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={filterKunci} onChange={e => setFilterKunci(e.target.value)}
              className={`w-full sm:w-auto appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-3 sm:pl-4 pr-8 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none transition-all cursor-pointer shadow-sm sm:max-w-[200px] ${filterKunci !== 'ALL' ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
              <option value="ALL">Semua Ujian</option>
              {kunci.map(k => <option key={k.id_kunci} value={k.id_kunci}>{k.judul_ujian}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Filter Status pills */}
        <div className="flex gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto touch-scroll py-0.5">
          {[
            { val: 'ALL', label: 'Semua' },
            { val: 'LULUS', label: '✓ Lulus' },
            { val: 'TIDAK_LULUS', label: '✕ Tidak Lulus' },
            { val: 'REVIEW', label: '⚠ Review' },
            { val: 'OVERRIDE', label: '✎ Override' },
          ].map(s => (
            <button key={s.val} onClick={() => setFilterStatus(s.val as any)}
              className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 ${filterStatus === s.val ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {activeFilters > 0 && (
          <button onClick={() => { setSearchTerm(''); setFilterKunci('ALL'); setFilterKelas('ALL'); setFilterStatus('ALL'); }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20 flex-shrink-0 active:scale-95">
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            {filteredHasil.length} hasil · hal {currentPage}/{totalPages || 1}
          </span>
          <div className="flex items-center gap-3">
            {stats.needReview > 0 && (
              <button onClick={() => setFilterStatus('REVIEW')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-500/20 transition-all animate-pulse">
                <ShieldAlert className="w-3 h-3" /> {stats.needReview} Butuh Review
              </button>
            )}
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              {stats.persenLulus}% Kelulusan
            </span>
          </div>
        </div>

        {/* ── Mobile Native Card View (Hanya tampil di layar HP <640px) ── */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
          {paginatedHasil.length > 0 ? paginatedHasil.map((h, i) => {
            const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
            const confidence = h.det?.confidence_score;
            const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
            const tgl = h.timestamp ? new Date(h.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
            const skorNum = Number(h.skor) || 0;
            const kkmNum = h.kkm_referensi || 70;
            const lulus = skorNum >= kkmNum;

            return (
              <div key={h.id_hasil} className="p-4 space-y-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500">#{globalIdx}</span>
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md">{h.sInfo?.nama_kelas || h.sInfo?.id_kelas || '—'}</span>
                      <span className="text-[9px] text-slate-400 font-mono">· {tgl}</span>
                    </div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{h.sInfo?.nama || h.id_siswa}</h4>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {h.kInfo?.judul_ujian || h.id_kunci} · <span className="text-slate-500">{h.kInfo?.nama_mapel}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-2xl text-right shrink-0 border ${lulus ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                    <div className="text-lg font-black leading-none">{skorNum}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest mt-0.5">{lulus ? 'LULUS' : `<${kkmNum}`}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">B: {h.det?.benar || 0}</span>
                    <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black">S: {h.det?.salah || 0}</span>
                    <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black">K: {h.det?.tidak_dijawab || 0}</span>
                    {h.det?.total_soal_esai > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] font-black">
                        ✍️ Esai: {h.det?.poin_esai ?? 0}/{h.det?.poin_maksimal_esai ?? 0}p
                      </span>
                    )}
                    {h.is_override ? (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Override</span>
                    ) : h.det?.need_review || h.det?.perlu_penilaian_manual ? (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Review {confidencePct != null ? `${confidencePct}%` : ''}</span>
                    ) : (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Valid {confidencePct != null ? `${confidencePct}%` : ''}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDetailHasil(h)} className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95">
                      <Eye className="w-3 h-3" /> Detail
                    </button>
                    <button onClick={() => { setOverrideTarget(h); setOverrideScore(String(h.skor)); setOverrideReason(''); }} className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 flex items-center justify-center active:scale-95" title="Override">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteHasil(h)} disabled={saving} className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center active:scale-95 disabled:opacity-40" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="p-10 text-center text-xs text-slate-400 font-bold">Belum ada data hasil ujian yang cocok.</div>
          )}
        </div>

        {/* Table with internal scroll (Desktop/Tablet) */}
        <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[540px] touch-scroll">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0d1117] text-[9px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/[0.05]">
              <tr>
                <th className="px-5 py-4 w-8 text-center">#</th>
                <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white" onClick={() => toggleSort('timestamp')}>
                  <div className="flex items-center gap-1.5">Waktu <SortIcon field="timestamp" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white" onClick={() => toggleSort('nama')}>
                  <div className="flex items-center gap-1.5">Siswa <SortIcon field="nama" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white" onClick={() => toggleSort('ujian')}>
                  <div className="flex items-center gap-1.5">Ujian <SortIcon field="ujian" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white" onClick={() => toggleSort('skor')}>
                  <div className="flex items-center gap-1.5">Skor <SortIcon field="skor" /></div>
                </th>
                <th className="px-5 py-4 text-center">Analitik</th>
                <th className="px-5 py-4 text-center">Status AI</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.02]">
              {paginatedHasil.length > 0 ? paginatedHasil.map((h, i) => {
                const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
                const confidence = h.det?.confidence_score;
                const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
                const tgl = h.timestamp ? new Date(h.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

                return (
                  <tr key={h.id_hasil} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4 text-center text-[10px] font-black text-slate-400 dark:text-slate-600">{globalIdx}</td>
                    <td className="px-5 py-4">
                      <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono whitespace-nowrap">{tgl}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-black text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{h.sInfo?.nama || h.id_siswa}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{h.sInfo?.nis || '—'} · <span className="font-sans font-bold text-indigo-500">{h.sInfo?.nama_kelas || h.sInfo?.id_kelas || '—'}</span></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[180px] truncate text-[11px] font-black text-indigo-600 dark:text-indigo-400" title={h.kInfo?.judul_ujian}>{h.kInfo?.judul_ujian || h.id_kunci}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{h.kInfo?.nama_mapel}</div>
                    </td>
                    <td className="px-5 py-4 min-w-[120px]">
                      <SkorBar skor={Number(h.skor) || 0} kkm={h.kkm_referensi || 70} />
                      <div className="text-[9px] text-slate-400 mt-1 font-mono">KKM {h.kkm_referensi}</div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        <div className="flex flex-col items-center px-2 py-1 bg-emerald-500/10 rounded-lg">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{h.det?.benar || 0}</span>
                          <span className="text-[7px] text-slate-500 uppercase font-black">B</span>
                        </div>
                        <div className="flex flex-col items-center px-2 py-1 bg-rose-500/10 rounded-lg">
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400">{h.det?.salah || 0}</span>
                          <span className="text-[7px] text-slate-500 uppercase font-black">S</span>
                        </div>
                        <div className="flex flex-col items-center px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-lg">
                          <span className="text-xs font-black text-slate-500">{h.det?.tidak_dijawab || 0}</span>
                          <span className="text-[7px] text-slate-500 uppercase font-black">K</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {h.is_override ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Pencil className="w-2.5 h-2.5" /> Override
                        </span>
                      ) : h.det?.need_review ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                          <AlertCircle className="w-2.5 h-2.5" /> Review
                          {confidencePct != null && <span className="opacity-70">· {confidencePct}%</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Valid
                          {confidencePct != null && <span className="opacity-70">· {confidencePct}%</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetailHasil(h)} title="Lihat Detail"
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center justify-center transition-all">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setOverrideTarget(h); setOverrideScore(String(h.skor)); setOverrideReason(''); }} title="Override Skor"
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteHasil(h)} disabled={saving} title="Hapus Hasil Scan"
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all disabled:opacity-40">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="text-5xl mb-4 grayscale opacity-20">🏆</div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                      {activeFilters > 0 ? 'Tidak ada hasil sesuai filter.' : 'Belum ada hasil scan yang terdata.'}
                    </p>
                    {activeFilters > 0 && (
                      <button onClick={() => { setSearchTerm(''); setFilterKunci('ALL'); setFilterStatus('ALL'); }}
                        className="mt-3 text-[10px] font-black text-amber-500 hover:underline">Reset Filter</button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            {filteredHasil.length > 0 ? <>
              Menampilkan <span className="text-amber-600 dark:text-amber-500">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredHasil.length)}</span>–<span className="text-amber-600 dark:text-amber-500">{Math.min(currentPage * ITEMS_PER_PAGE, filteredHasil.length)}</span> dari <span className="text-amber-600 dark:text-amber-500">{filteredHasil.length}</span>
            </> : '0 hasil'}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {(() => {
                const pages: (number | '...')[] = [];
                if (totalPages <= 7) { for (let x = 1; x <= totalPages; x++) pages.push(x); }
                else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('...');
                  for (let x = Math.max(2, currentPage - 1); x <= Math.min(totalPages - 1, currentPage + 1); x++) pages.push(x);
                  if (currentPage < totalPages - 2) pages.push('...');
                  pages.push(totalPages);
                }
                return pages.map((p, idx) => p === '...' ? (
                  <span key={`d${idx}`} className="w-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                ) : (
                  <button key={p} onClick={() => setCurrentPage(p as number)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black transition-all ${currentPage === p ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Total DB: <span className="text-amber-600 dark:text-amber-500">{hasil.length}</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL: Detail Hasil
      ════════════════════════════════════════════ */}
      {detailHasil && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setDetailHasil(null); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-2xl rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden my-0 sm:my-8 max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/10 to-transparent px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3">
                  <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20"><Eye className="w-4 h-4" /></span>
                  Detail Hasil Ujian
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{detailHasil.sInfo?.nama}</p>
              </div>
              <button onClick={() => setDetailHasil(null)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all active:scale-95">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-8 space-y-4 sm:space-y-5 flex-1 overflow-y-auto touch-scroll">
              {/* Skor & Info ringkas */}
              <div className={`rounded-2xl p-4 sm:p-6 text-center border ${detailHasil.is_lulus ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                <div className={`text-4xl sm:text-6xl font-black tabular-nums mb-1 ${detailHasil.is_lulus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {detailHasil.skor}
                </div>
                <div className={`text-[10px] font-black uppercase tracking-widest ${detailHasil.is_lulus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {detailHasil.is_lulus ? '✓ LULUS' : '✕ TIDAK LULUS'} · KKM {detailHasil.kkm_referensi} · B:{detailHasil.det?.benar || 0} S:{detailHasil.det?.salah || 0} K:{detailHasil.det?.tidak_dijawab || 0}
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: 'NIS', val: detailHasil.sInfo?.nis || '—' },
                  { label: 'Kelas', val: detailHasil.sInfo?.nama_kelas || detailHasil.sInfo?.id_kelas || '—' },
                  { label: 'Ujian', val: detailHasil.kInfo?.judul_ujian || detailHasil.id_kunci },
                  { label: 'Mapel', val: detailHasil.kInfo?.nama_mapel || '—' },
                  { label: 'Confidence', val: detailHasil.det?.confidence_score != null ? `${(detailHasil.det.confidence_score * 100).toFixed(0)}%` : '—' },
                  { label: 'Status', val: detailHasil.is_override ? 'Manual Override' : detailHasil.det?.need_review ? 'Need Review' : 'AI Validated' },
                  { label: 'Waktu Scan', val: detailHasil.timestamp ? new Date(detailHasil.timestamp).toLocaleString('id-ID') : '—' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-2.5 sm:p-3 border border-slate-100 dark:border-white/5">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</div>
                    <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm truncate">{String(item.val)}</div>
                  </div>
                ))}
              </div>

              {/* Distribusi Tipe Soal dari kunci */}
              {detailHasil.kInfo?.data_json?.length > 0 && (() => {
                const dist = getTipeDistribusi(detailHasil.kInfo.data_json);
                if (Object.keys(dist).length === 0) return null;
                return (
                  <div>
                    <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Distribusi Tipe Soal AKM</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(dist).map(([tipe, jumlah]) => {
                        const def = TIPE_SOAL_AKM.find(t => t.kode === tipe);
                        return (
                          <span key={tipe} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black border ${def ? TIPE_COLOR[def.color] : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500'}`}>
                            <TipeBadge kode={tipe} />
                            <span className="opacity-70">{def?.label || tipe}</span>
                            <span className="font-black ml-0.5">×{String(jumlah)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Jawaban & kunci per soal (Interaktif - Ketuk Baris untuk Koreksi Butir) */}
              {(detailHasil.det?.detail || detailHasil.det?.answers) && detailHasil.kInfo?.data_json && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Detail Jawaban Siswa vs Kunci <span className="text-indigo-500 normal-case font-bold">(Ketuk nomor untuk ubah jawaban)</span>
                    </div>
                    {(Object.keys(pendingAnswerEdits).length > 0 || Object.keys(pendingEssayScores).length > 0) && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black">
                        {new Set([...Object.keys(pendingAnswerEdits), ...Object.keys(pendingEssayScores)]).size} butir diubah
                      </span>
                    )}
                  </div>

                  {/* Panel Edit Cepat Per-Butir Soal */}
                  {editingQuestionNo !== null && (() => {
                    const kItem = (detailHasil.kInfo.data_json as any[]).find((k: any, i: number) => Number(k.no || i + 1) === editingQuestionNo);
                    const tipe = normalizeTipe(kItem?.tipe || detailHasil.kInfo?.tipe_soal || 'single_choice');
                    const isSimpleChoice = tipe === 'single_choice' || tipe === 'single_choice_4' || tipe === 'true_false';
                    const choiceOptions = tipe === 'true_false'
                      ? ['B', 'S']
                      : tipe === 'single_choice_4'
                        ? ['A', 'B', 'C', 'D']
                        : (kItem?.opsi?.length ? kItem.opsi : ['A', 'B', 'C', 'D', 'E']);

                    return (
                      <div className="mb-3 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px]">Soal #{editingQuestionNo}</span>
                            <TipeBadge kode={tipe} />
                            <span className="text-[10px] text-slate-500">Kunci: <b className="text-indigo-600 dark:text-indigo-400">{kItem ? formatJawaban(kItem) : '—'}</b></span>
                          </div>
                          <button type="button" onClick={() => setEditingQuestionNo(null)} className="text-slate-400 hover:text-rose-500 p-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isSimpleChoice ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {choiceOptions.map((opt: string) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setPendingAnswerEdits(prev => ({ ...prev, [editingQuestionNo]: opt }));
                                  setEditingQuestionNo(null);
                                }}
                                className={`min-w-[38px] h-9 px-3 rounded-xl font-black text-xs border transition-all active:scale-95 ${
                                  editingQuestionInput.toUpperCase() === opt
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setPendingAnswerEdits(prev => ({ ...prev, [editingQuestionNo]: '?' }));
                                setEditingQuestionNo(null);
                              }}
                              className="h-9 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all ml-auto"
                            >
                              Kosongkan (?)
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingQuestionInput}
                              onChange={e => setEditingQuestionInput(e.target.value)}
                              placeholder="Ketik jawaban siswa..."
                              className="flex-1 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const norm = editingQuestionInput.trim() === '' || editingQuestionInput.trim() === '?'
                                  ? '?'
                                  : normalizeAIAnswer(editingQuestionInput, tipe);
                                setPendingAnswerEdits(prev => ({ ...prev, [editingQuestionNo]: norm }));
                                setEditingQuestionNo(null);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-95"
                            >
                              Pilih
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Mobile Compact 5-Kolom Answer Grid (Bebas Scroll Panjang di HP) */}
                  <div className="sm:hidden grid grid-cols-5 gap-1.5">
                    {(detailHasil.kInfo.data_json as any[]).map((kItem: any, idx: number) => {
                      const noSoal = Number(kItem.no || idx + 1);
                      const tipeNorm = normalizeTipe(kItem.tipe || detailHasil.kInfo?.tipe_soal || 'single_choice');
                      const isEssay = tipeNorm === 'essay';
                      const bobot = detailHasil.kInfo?.pengaturan_poin || {};
                      const maxPoin = Number(kItem.poin ?? bobot[String(noSoal)] ?? (isEssay ? 8 : (bobot.benar ?? 1))) || 1;
                      const detailRow = Array.isArray(detailHasil.det?.detail)
                        ? detailHasil.det.detail.find((d: any) => Number(d.no) === noSoal) || detailHasil.det.detail[idx]
                        : null;
                      const hasPendingAns = Object.prototype.hasOwnProperty.call(pendingAnswerEdits, noSoal);
                      const hasPendingEssay = Object.prototype.hasOwnProperty.call(pendingEssayScores, noSoal);
                      const hasPending = hasPendingAns || hasPendingEssay;
                      const siswaJwb = hasPendingAns
                        ? pendingAnswerEdits[noSoal]
                        : detailRow
                          ? detailRow.jawaban
                          : detailHasil.det?.answers?.[idx];
                      const jwbDisplay = (() => {
                        if (siswaJwb === null || siswaJwb === undefined || siswaJwb === '' || siswaJwb === '?') return '?';
                        if (Array.isArray(siswaJwb)) return siswaJwb.join(',');
                        if (typeof siswaJwb === 'object') return Object.entries(siswaJwb).map(([k, v]) => `${k}-${v}`).join(',');
                        return String(siswaJwb);
                      })();
                      const kunciDisplay = formatJawaban(kItem);
                      const essayPoin = hasPendingEssay
                        ? pendingEssayScores[noSoal].poin_manual
                        : (detailRow?.poin_manual ?? detailRow?.poin_didapat);
                      const isEssayGraded = isEssay && (hasPendingEssay || detailRow?.status === 'dinilai' || detailRow?.poin_manual !== undefined);
                      const isCorrect = (() => {
                        if (isEssay) {
                          if (!isEssayGraded) return null;
                          return Number(essayPoin || 0) >= maxPoin * 0.5;
                        }
                        if (!hasPendingAns) {
                          if (detailRow?.status === 'benar') return true;
                          if (detailRow?.status === 'salah') return false;
                          if (detailRow?.status === 'tidak_dijawab' || detailRow?.status === 'manual') return null;
                        }
                        if (!siswaJwb || siswaJwb === '?') return null;
                        return answersMatch(siswaJwb, kItem.jawaban, tipeNorm);
                      })();
                      const isEditing = editingQuestionNo === noSoal;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditingQuestionNo(noSoal);
                            setEditingQuestionInput(jwbDisplay === '?' ? '' : jwbDisplay);
                          }}
                          className={`py-1.5 px-1 rounded-xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center ${
                            isEditing
                              ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-500/15'
                              : hasPending
                                ? 'border-amber-500 bg-amber-500/15'
                                : isCorrect === true
                                  ? 'border-emerald-500/30 bg-emerald-500/10'
                                  : isCorrect === false
                                    ? 'border-rose-500/35 bg-rose-500/10'
                                    : 'border-amber-500/35 bg-amber-500/10'
                          }`}
                        >
                          <div className="font-mono text-[8px] font-bold text-slate-400 leading-none">#{noSoal}</div>
                          <div className={`font-black text-xs leading-tight mt-0.5 truncate max-w-full ${
                            isEssay
                              ? (isEssayGraded ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')
                              : isCorrect === true
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isCorrect === false
                                  ? 'text-rose-500'
                                  : 'text-amber-500'
                          }`}>
                            {isEssay ? (isEssayGraded ? `${Number(essayPoin || 0)}/${maxPoin}p` : 'Esai') : jwbDisplay}
                          </div>
                          {!isEssay && isCorrect !== true && (
                            <div className="text-[8px] font-bold text-slate-400 leading-none mt-0.5 truncate max-w-full">
                              k:{kunciDisplay}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop Detailed Table View */}
                  <div className="hidden sm:block border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-72 touch-scroll">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-[#0d1117] text-[8px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-white/[0.07]">
                          <tr>
                            <th className="px-3 py-2 text-center">No</th>
                            <th className="px-3 py-2 text-center">Tipe</th>
                            <th className="px-3 py-2 text-center">Jawaban Siswa</th>
                            <th className="px-3 py-2 text-center">Kunci</th>
                            <th className="px-3 py-2 text-center">Status / Poin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
                          {(detailHasil.kInfo.data_json as any[]).map((kItem: any, idx: number) => {
                            const noSoal = Number(kItem.no || idx + 1);
                            const tipeNorm = normalizeTipe(kItem.tipe || detailHasil.kInfo?.tipe_soal || 'single_choice');
                            const isEssay = tipeNorm === 'essay';
                            const bobot = detailHasil.kInfo?.pengaturan_poin || {};
                            const maxPoin = Number(kItem.poin ?? bobot[String(noSoal)] ?? (isEssay ? 8 : (bobot.benar ?? 1))) || 1;
                            const detailRow = Array.isArray(detailHasil.det?.detail)
                              ? detailHasil.det.detail.find((d: any) => Number(d.no) === noSoal) || detailHasil.det.detail[idx]
                              : null;
                            const hasPendingAns = Object.prototype.hasOwnProperty.call(pendingAnswerEdits, noSoal);
                            const hasPendingEssay = Object.prototype.hasOwnProperty.call(pendingEssayScores, noSoal);
                            const hasPending = hasPendingAns || hasPendingEssay;
                            const siswaJwb = hasPendingAns
                              ? pendingAnswerEdits[noSoal]
                              : detailRow
                                ? detailRow.jawaban
                                : detailHasil.det?.answers?.[idx];
                            const jwbDisplay = (() => {
                              if (siswaJwb === null || siswaJwb === undefined || siswaJwb === '' || siswaJwb === '?') return '—';
                              if (Array.isArray(siswaJwb)) return siswaJwb.join(', ');
                              if (typeof siswaJwb === 'object') return Object.entries(siswaJwb).map(([k,v])=>`${k}→${v}`).join(', ');
                              return String(siswaJwb);
                            })();
                            const kunciDisplay = formatJawaban(kItem);
                            const essayPoin = hasPendingEssay
                              ? pendingEssayScores[noSoal].poin_manual
                              : (detailRow?.poin_manual ?? detailRow?.poin_didapat);
                            const isEssayGraded = isEssay && (hasPendingEssay || detailRow?.status === 'dinilai' || detailRow?.poin_manual !== undefined);
                            const isCorrect = (() => {
                              if (isEssay) {
                                if (!isEssayGraded) return null;
                                return Number(essayPoin || 0) >= maxPoin * 0.5;
                              }
                              if (!hasPendingAns) {
                                if (detailRow?.status === 'benar') return true;
                                if (detailRow?.status === 'salah') return false;
                                if (detailRow?.status === 'tidak_dijawab' || detailRow?.status === 'manual') return null;
                              }
                              if (!siswaJwb || siswaJwb === '?') return null;
                              return answersMatch(siswaJwb, kItem.jawaban, tipeNorm);
                            })();
                            return (
                              <tr
                                key={idx}
                                onClick={() => {
                                  setEditingQuestionNo(noSoal);
                                  setEditingQuestionInput(jwbDisplay === '—' ? '' : jwbDisplay);
                                }}
                                className={`cursor-pointer transition-colors hover:bg-indigo-500/10 ${
                                  hasPending
                                    ? 'bg-amber-500/10'
                                    : isCorrect === true
                                      ? 'bg-emerald-500/5'
                                      : isCorrect === false
                                        ? 'bg-rose-500/5'
                                        : ''
                                }`}
                              >
                                <td className="px-3 py-1.5 text-center text-[10px] font-mono text-slate-400">
                                  #{noSoal}
                                </td>
                                <td className="px-3 py-1.5 text-center"><TipeBadge kode={kItem.tipe || 'single_choice'} /></td>
                                <td className={`px-3 py-1.5 text-center font-black text-[11px] max-w-[140px] truncate ${hasPending ? 'text-amber-600 dark:text-amber-400 underline' : isCorrect === true ? 'text-emerald-600 dark:text-emerald-400' : isCorrect === false ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`} title={jwbDisplay}>
                                  {jwbDisplay}
                                </td>
                                <td className="px-3 py-1.5 text-center font-black text-[11px] text-indigo-600 dark:text-indigo-400 max-w-[140px] truncate" title={kunciDisplay}>{kunciDisplay}</td>
                                <td className="px-3 py-1.5 text-center text-xs font-black">
                                  {isEssay ? (
                                    isEssayGraded ? (
                                      <span className="text-emerald-500 font-mono">{Number(essayPoin || 0)}/{maxPoin}p</span>
                                    ) : (
                                      <span className="text-amber-500 text-[10px]">Menunggu ({maxPoin}p)</span>
                                    )
                                  ) : isCorrect === null ? (
                                    <span className="text-slate-400">Kosong</span>
                                  ) : isCorrect ? (
                                    <span className="text-emerald-500">✓ Benar</span>
                                  ) : (
                                    <span className="text-rose-500">✗ Salah</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── PANEL PENILAIAN CEPAT URAIAN / ESAI (Opsi A: AI Otomatis · Opsi B: Input Poin Kertas Terpisah) ── */}
                  {(() => {
                    const essayList = (detailHasil.kInfo.data_json as any[]).filter(
                      (k) => normalizeTipe(k.tipe) === 'essay'
                    );
                    if (essayList.length === 0) return null;
                    const bobot = detailHasil.kInfo.pengaturan_poin || {};

                    return (
                      <div className="mt-3 p-3.5 rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                              ✍️ Penilaian Uraian / Esai ({essayList.length} Nomor)
                            </div>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400">
                              Klik <b>Nilai Esai AI</b> (Opsi A) atau pilih poin langsung dari lembar esai terpisah (Opsi B).
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={scoringEssaysAI}
                            onClick={handleAutoGradeEssaysInDetail}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-40"
                          >
                            {scoringEssaysAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            <span>Nilai Esai AI</span>
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {essayList.map((kItem: any, idx: number) => {
                            const no = Number(kItem.no || idx + 1);
                            const maxPoin = Number(kItem.poin ?? bobot[String(no)] ?? bobot.esai ?? bobot.benar ?? 8) || 8;
                            const detailRow = Array.isArray(detailHasil.det?.detail)
                              ? detailHasil.det.detail.find((d: any) => Number(d.no) === no)
                              : null;
                            const pendingScore = pendingEssayScores[no];
                            const currentPoin = pendingScore !== undefined
                              ? pendingScore.poin_manual
                              : Number(detailRow?.poin_manual ?? detailRow?.poin_didapat ?? 0);
                            const isGraded = pendingScore !== undefined || detailRow?.status === 'dinilai' || detailRow?.poin_manual !== undefined;
                            const feedback = pendingScore?.ai_feedback ?? detailRow?.ai_feedback;

                            return (
                              <div key={no} className="p-2.5 rounded-xl bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/10 space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black">
                                    Esai #{no}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
                                    <div className="flex flex-wrap items-center gap-1">
                                      {[
                                        { label: '0', val: 0 },
                                        { label: '½', val: Math.round((maxPoin * 0.5) * 2) / 2 },
                                        { label: '¾', val: Math.round((maxPoin * 0.75) * 2) / 2 },
                                        { label: `Penuh (${maxPoin})`, val: maxPoin },
                                      ].map((preset) => (
                                        <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() =>
                                            setPendingEssayScores((prev) => ({
                                              ...prev,
                                              [no]: { poin_manual: preset.val, ai_feedback: prev[no]?.ai_feedback },
                                            }))
                                          }
                                          className={`px-2 py-1 rounded-lg text-[8.5px] font-black border transition-all active:scale-95 ${
                                            isGraded && currentPoin === preset.val
                                              ? 'bg-emerald-600 text-white border-emerald-600'
                                              : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-rose-400'
                                          }`}
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxPoin}
                                        step={0.5}
                                        value={isGraded ? currentPoin : ''}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = Math.min(maxPoin, Math.max(0, Number(e.target.value) || 0));
                                          setPendingEssayScores((prev) => ({
                                            ...prev,
                                            [no]: { poin_manual: val, ai_feedback: prev[no]?.ai_feedback },
                                          }));
                                        }}
                                        className="w-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-lg px-1.5 py-0.5 text-center text-[11px] font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-rose-500"
                                      />
                                      <span className="text-[9px] font-mono text-slate-400">/{maxPoin}</span>
                                    </div>
                                  </div>
                                </div>
                                {feedback && (
                                  <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                    💡 {feedback}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

              {/* Override info */}
              {detailHasil.is_override && detailHasil.override_reason && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                  <div className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Alasan Override</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">{detailHasil.override_reason}</div>
                </div>
              )}

            </div>

            {/* Sticky Footer — Selalu Terlihat & Bisa Diklik di HP */}
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0d1117] px-4 py-3 sm:px-8 sm:py-4 space-y-2 pb-safe">
              {(Object.keys(pendingAnswerEdits).length > 0 || Object.keys(pendingEssayScores).length > 0) && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSavePerQuestionEdits}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>
                    Simpan Koreksi {new Set([...Object.keys(pendingAnswerEdits), ...Object.keys(pendingEssayScores)]).size} Butir
                  </span>
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDetailHasil(null)}
                  className="px-4 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/10 active:scale-95"
                >
                  Tutup
                </button>
                <button onClick={() => { setDetailHasil(null); setOverrideTarget(detailHasil); setOverrideScore(String(detailHasil.skor)); setOverrideReason(''); }}
                  className="flex-1 py-3 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 dark:text-indigo-400 hover:text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-indigo-500/20 flex items-center justify-center gap-2 active:scale-95">
                  <Pencil className="w-3.5 h-3.5" /> Override Skor
                </button>
                <button onClick={() => handleDeleteHasil(detailHasil)} disabled={saving}
                  className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-rose-500/20 flex items-center justify-center gap-1.5 active:scale-95">
                  <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL: Override Skor
      ════════════════════════════════════════════ */}
      {overrideTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget && !saving) setOverrideTarget(null); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden my-0 sm:my-8 max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/8 blur-[60px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            <div className="relative z-10 flex-1 overflow-y-auto touch-scroll">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 sm:mb-5">
                <Pencil className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">Override Skor Manual</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-5 uppercase tracking-widest">{overrideTarget.sInfo?.nama} · {overrideTarget.kInfo?.judul_ujian}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Skor Baru (0–100)</label>
                  <input type="number" min={0} max={100} value={overrideScore} onChange={e => setOverrideScore(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-2xl font-black text-center text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all" />
                  <div className="text-[9px] text-slate-400 mt-1.5 ml-1">Skor sebelumnya: <span className="font-black text-slate-600 dark:text-slate-400">{overrideTarget.skor}</span></div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Alasan Override *</label>
                  <textarea rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Contoh: Koreksi kesalahan scan pada soal no. 3 dan 7..."
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                  <div className="text-[9px] text-amber-600 dark:text-amber-500 mt-1.5 ml-1">⚠ Alasan disimpan untuk keperluan Audit Trail</div>
                </div>
              </div>
            </div>
            <div className="relative z-10 flex gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-white/[0.06] flex-shrink-0 pb-safe">
              <button onClick={() => setOverrideTarget(null)} disabled={saving}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 disabled:opacity-30">
                Batal
              </button>
              <button onClick={handleOverride} disabled={saving || !overrideReason.trim()}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="w-3.5 h-3.5" />Simpan Override</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
