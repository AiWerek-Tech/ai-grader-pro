'use client';

import { getKunciListAction, saveKunciAction, deleteKunciAction } from '@/lib/actions/kunci';
import { getMasterData } from '@/lib/actions/master';
import { getIRTStatsAction } from '@/lib/actions/admin';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, Plus, RefreshCw, Download, Trash2, Eye, Printer,
  X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, BarChart3,
  BookOpen, FileText, Key, ChevronLeft, ChevronRight,
  Loader2, ClipboardList, Calendar, AlertCircle,
  CheckCircle2, Pencil, ScanLine
} from 'lucide-react';

// ─── AKM Tipe Soal Constants ─────────────────────────────────────────────────
const TIPE_SOAL_AKM = [
  { kode: 'single_choice',      label: 'Pilihan Ganda (A–E)',         short: 'PG-E',   opsi: ['A','B','C','D','E'], color: 'indigo' },
  { kode: 'single_choice_4',   label: 'Pilihan Ganda (A–D)',         short: 'PG-D',   opsi: ['A','B','C','D'],     color: 'violet' },
  { kode: 'true_false',        label: 'Benar / Salah',               short: 'B/S',    opsi: ['B','S'],             color: 'teal'   },
  { kode: 'multiple_select',   label: 'Pilihan Ganda Kompleks',      short: 'PGK',    opsi: ['A','B','C','D','E'], color: 'sky'    },
  { kode: 'multiple_true_false', label: 'Benar-Salah Majemuk (MTF)', short: 'MTF',   opsi: [],                    color: 'cyan'   },
  { kode: 'matching',          label: 'Menjodohkan',                 short: 'JDH',    opsi: [],                    color: 'amber'  },
  { kode: 'short_answer',      label: 'Isian Singkat',               short: 'ISN',    opsi: [],                    color: 'orange' },
  { kode: 'essay',             label: 'Uraian (Esai)',               short: 'ESI',    opsi: [],                    color: 'rose'   },
] as const;

type TipeSoalKode = typeof TIPE_SOAL_AKM[number]['kode'];

const TIPE_COLOR: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  teal:   'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
  sky:    'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  cyan:   'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  amber:  'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  rose:   'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

// Default jawaban per tipe
function defaultJawaban(kode: TipeSoalKode): any {
  if (kode === 'single_choice') return 'A';
  if (kode === 'single_choice_4') return 'A';
  if (kode === 'true_false') return 'B';
  if (kode === 'multiple_select') return ['A'];
  if (kode === 'multiple_true_false') return ['B','S']; // 2 pernyataan default
  if (kode === 'matching') return { '1': 'A', '2': 'B' }; // 2 pasang default
  if (kode === 'short_answer') return '';
  if (kode === 'essay') return '';
  return '';
}

// Format jawaban untuk display
function formatJawabanDisplay(item: any): string {
  if (!item) return '—';
  const jwb = item.jawaban;
  if (Array.isArray(jwb)) return jwb.join(', ');
  if (typeof jwb === 'object' && jwb !== null) {
    return Object.entries(jwb).map(([k, v]) => `${k}→${v}`).join(', ');
  }
  return String(jwb || '—');
}

// Butir soal item interface
interface SoalItem {
  no: number;
  tipe: TipeSoalKode;
  jawaban: any;
  opsi: string[];
  poin?: number;               // bobot poin per butir soal
  jumlah_pernyataan?: number;  // untuk MTF
  jumlah_pasang?: number;      // untuk matching
  panjang_jawaban?: number;    // untuk isian singkat
}

type SortField = 'judul_ujian' | 'nama_mapel' | 'nama_kelas' | 'jumlah_soal' | 'timestamp';
type SortDir = 'asc' | 'desc';
const ITEMS_PER_PAGE = 15;

// ─── Komponen Input Jawaban Per Tipe ─────────────────────────────────────────
function JawabanInput({ item, onChange }: { item: SoalItem; onChange: (jwb: any) => void }) {
  const tipeDef = TIPE_SOAL_AKM.find(t => t.kode === item.tipe);
  const opsi = tipeDef?.opsi || item.opsi;

  if (item.tipe === 'single_choice' || item.tipe === 'single_choice_4') {
    return (
      <div className="flex gap-1 flex-wrap">
        {opsi.map(o => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`w-8 h-8 rounded-lg text-[11px] font-black border transition-all ${item.jawaban === o ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-indigo-400'}`}>
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (item.tipe === 'true_false') {
    return (
      <div className="flex gap-1">
        {['B','S'].map(o => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`px-3 h-8 rounded-lg text-[11px] font-black border transition-all ${item.jawaban === o ? (o === 'B' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600') : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'}`}>
            {o === 'B' ? 'Benar' : 'Salah'}
          </button>
        ))}
      </div>
    );
  }

  if (item.tipe === 'multiple_select') {
    const selected: string[] = Array.isArray(item.jawaban) ? item.jawaban : [];
    return (
      <div className="flex gap-1 flex-wrap">
        {['A','B','C','D','E'].map(o => {
          const active = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => {
              const next = active ? selected.filter(x => x !== o) : [...selected, o].sort();
              onChange(next.length > 0 ? next : [o]);
            }}
              className={`w-8 h-8 rounded-lg text-[11px] font-black border transition-all ${active ? 'bg-sky-600 text-white border-sky-600 shadow-md' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-sky-400'}`}>
              {o}
            </button>
          );
        })}
        <span className="text-[9px] text-sky-600 dark:text-sky-400 font-black self-center ml-1">
          {selected.length > 0 ? selected.join(',') : '—'}
        </span>
      </div>
    );
  }

  if (item.tipe === 'multiple_true_false') {
    const answers: string[] = Array.isArray(item.jawaban) ? item.jawaban : [];
    const n = item.jumlah_pernyataan || answers.length || 2;
    const normalized = Array.from({ length: n }, (_, i) => answers[i] || 'B');
    return (
      <div className="flex gap-1.5 flex-wrap">
        {normalized.map((ans, idx) => (
          <div key={idx} className="flex flex-col items-center gap-0.5">
            <span className="text-[7px] text-slate-400 font-mono">{idx + 1}</span>
            <div className="flex gap-0.5">
              {['B','S'].map(o => (
                <button key={o} type="button" onClick={() => {
                  const next = [...normalized]; next[idx] = o; onChange(next);
                }}
                  className={`px-1.5 h-7 rounded-md text-[10px] font-black border transition-all ${ans === o ? (o === 'B' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600') : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (item.tipe === 'matching') {
    const pairs: Record<string, string> = (typeof item.jawaban === 'object' && !Array.isArray(item.jawaban)) ? item.jawaban : {};
    const n = item.jumlah_pasang || Object.keys(pairs).length || 2;
    const opsiKanan = ['A','B','C','D','E'].slice(0, n);
    return (
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: n }, (_, i) => {
          const key = String(i + 1);
          return (
            <div key={key} className="flex items-center gap-1">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">{key}→</span>
              <select value={pairs[key] || opsiKanan[i]}
                onChange={e => { const next = { ...pairs, [key]: e.target.value }; onChange(next); }}
                className="w-10 h-7 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-black text-amber-700 dark:text-amber-400 text-center focus:outline-none focus:border-amber-500/50 cursor-pointer">
                {opsiKanan.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    );
  }

  if (item.tipe === 'short_answer') {
    return (
      <div className="space-y-1">
        <input type="text" value={String(item.jawaban || '')}
          onChange={e => onChange(e.target.value)}
          placeholder="Contoh: Fotosintesis | Proses Fotosintesis (pisahkan | untuk alternatif)"
          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500/50 transition-all" />
        <div className="text-[9px] text-orange-600 dark:text-orange-400 font-bold">
          💡 Mendukung multi-kunci (pisahkan dengan <code className="px-1 bg-orange-500/10 rounded">|</code>) & toleransi typo OCR 1 huruf.
        </div>
      </div>
    );
  }

  if (item.tipe === 'essay') {
    return (
      <div className="space-y-1">
        <input type="text" value={String(item.jawaban || '')}
          onChange={e => onChange(e.target.value)}
          placeholder="Pedoman jawaban / kata kunci rubrik AI (opsional, kosongkan jika dinilai manual/kertas terpisah)..."
          className="w-full bg-white dark:bg-white/5 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/50 transition-all" />
        <div className="text-[9px] text-rose-500 font-bold">
          ✨ Isi kata kunci/rubrik untuk penilaian AI otomatis (Opsi A), atau kosongkan untuk input poin manual/kertas terpisah (Opsi B).
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KunciJawabanPage() {
  const router = useRouter();
  const [kunciData, setKunciData] = useState<any[]>([]);
  const [masterData, setMasterData] = useState<{ kelas: any[]; mapel: any[] }>({ kelas: [], mapel: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMapel, setFilterMapel] = useState('ALL');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const [detailKunci, setDetailKunci] = useState<any | null>(null);
  const [irtKunci, setIrtKunci] = useState<any | null>(null);
  const [irtData, setIrtData] = useState<any[]>([]);
  const [loadingIRT, setLoadingIRT] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingKunci, setEditingKunci] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Create form state ────────────────────────────────────────────────────
  const [formSoal, setFormSoal] = useState<SoalItem[]>([]);
  const [formJumlahSoal, setFormJumlahSoal] = useState(20);
  const [defaultTipe, setDefaultTipe] = useState<TipeSoalKode>('single_choice');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(20);
  const [rangeTipe, setRangeTipe] = useState<TipeSoalKode>('single_choice');
  const [rangePoin, setRangePoin] = useState<number>(2);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [kRes, mRes] = await Promise.all([getKunciListAction(), getMasterData()]);
      if (kRes.success) setKunciData(kRes.data || []);
      if (mRes.success) setMasterData(mRes.data || { kelas: [], mapel: [] });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterMapel, filterKelas, sortField, sortDir]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalKunci = kunciData.length;
    const mapelUnik = new Set(kunciData.map(k => k.id_mapel)).size;
    const totalSoal = kunciData.reduce((s, k) => s + (k.data_json?.length || 0), 0);
    const rataButir = totalKunci > 0 ? Math.round(totalSoal / totalKunci) : 0;
    return { totalKunci, mapelUnik, rataButir, totalSoal };
  }, [kunciData]);

  // ─── Filter + Sort ────────────────────────────────────────────────────────
  const filteredKunci = useMemo(() => {
    let list = [...kunciData];
    const q = searchTerm.toLowerCase();
    if (q) list = list.filter(k =>
      k.judul_ujian?.toLowerCase().includes(q) || k.nama_mapel?.toLowerCase().includes(q) || k.nama_guru?.toLowerCase().includes(q)
    );
    if (filterMapel !== 'ALL') list = list.filter(k => k.id_mapel === filterMapel);
    if (filterKelas !== 'ALL') list = list.filter(k => k.id_kelas === filterKelas || k.id_kelas === 'ALL');
    list.sort((a, b) => {
      let va: any, vb: any;
      if (sortField === 'jumlah_soal') { va = a.data_json?.length || 0; vb = b.data_json?.length || 0; }
      else if (sortField === 'timestamp') { va = new Date(a.timestamp || 0).getTime(); vb = new Date(b.timestamp || 0).getTime(); }
      else { va = a[sortField] || ''; vb = b[sortField] || ''; }
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [kunciData, searchTerm, filterMapel, filterKelas, sortField, sortDir]);

  const totalPages = Math.ceil(filteredKunci.length / ITEMS_PER_PAGE);
  const paginatedKunci = filteredKunci.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const maxButir = Math.max(...kunciData.map((x: any) => x.data_json?.length || 0), 1);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };
  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field ? <ArrowUpDown className="w-3 h-3 opacity-30" /> :
      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />;

  const activeFilters = [searchTerm, filterMapel !== 'ALL' ? filterMapel : '', filterKelas !== 'ALL' ? filterKelas : ''].filter(Boolean).length;

  // ─── Tipe badge helper ────────────────────────────────────────────────────
  const TipeBadge = ({ kode }: { kode: string }) => {
    const def = TIPE_SOAL_AKM.find(t => t.kode === kode);
    if (!def) {
      // Legacy format (A-E, A-D, Benar-Salah)
      const legacy = kode === 'A-E' ? { short: 'PG-E', color: 'indigo' }
        : kode === 'A-D' ? { short: 'PG-D', color: 'violet' }
        : { short: 'B/S', color: 'teal' };
      return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[legacy.color]}`}>{legacy.short}</span>;
    }
    return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[def.color]}`}>{def.short}</span>;
  };

  // ─── Tipe counter dari data_json ──────────────────────────────────────────
  const getTipeDistribusi = (dataJson: any[]): Record<string, number> => {
    const dist: Record<string, number> = {};
    (dataJson || []).forEach(item => {
      const t = item.tipe || 'single_choice';
      dist[t] = (dist[t] || 0) + 1;
    });
    return dist;
  };

  // ─── IRT ─────────────────────────────────────────────────────────────────
  const handleShowIRT = async (k: any) => {
    setIrtKunci(k); setLoadingIRT(true); setIrtData([]);
    try {
      const res = await getIRTStatsAction(k.id_kunci);
      if (res.success) setIrtData(res.data || []);
    } catch { }
    finally { setLoadingIRT(false); }
  };

  // ─── Print & Scan LJK ─────────────────────────────────────────────────────
  const handlePrintLJK = (k: any) => {
    router.push(`/dashboard/ljk?kunci=${encodeURIComponent(k.id_kunci)}`);
  };

  const handleScanLJK = (k: any) => {
    router.push(`/dashboard/analisis?kunci=${encodeURIComponent(k.id_kunci)}`);
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      const res = await deleteKunciAction(confirmDelete.id);
      if (res.success) { toast.success('Kunci jawaban berhasil dihapus!'); setConfirmDelete(null); fetchData(true); }
      else toast.error(res.message);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ─── Form: init & resize soal array ───────────────────────────────────────
  const initSoal = useCallback((jumlah: number, tipe: TipeSoalKode) => {
    const tipeDef = TIPE_SOAL_AKM.find(t => t.kode === tipe);
    const opsi = tipeDef?.opsi ? [...tipeDef.opsi] : [];
    const soalBaru: SoalItem[] = Array.from({ length: jumlah }, (_, i) => ({
      no: i + 1,
      tipe,
      jawaban: defaultJawaban(tipe),
      opsi,
      poin: tipe === 'essay' ? 8 : 2,
      jumlah_pernyataan: tipe === 'multiple_true_false' ? 3 : undefined,
      jumlah_pasang: tipe === 'matching' ? 3 : undefined,
      panjang_jawaban: tipe === 'short_answer' ? 10 : undefined,
    }));
    setFormSoal(soalBaru);
  }, []);

  const resizeSoal = useCallback((jumlah: number, tipe: TipeSoalKode) => {
    const safeCount = Math.max(1, Math.min(200, jumlah));
    const tipeDef = TIPE_SOAL_AKM.find(t => t.kode === tipe);
    const opsi = tipeDef?.opsi ? [...tipeDef.opsi] : [];
    setFormSoal(prev => {
      if (safeCount <= prev.length) {
        return prev.slice(0, safeCount);
      }
      const added: SoalItem[] = Array.from({ length: safeCount - prev.length }, (_, idx) => ({
        no: prev.length + idx + 1,
        tipe,
        jawaban: defaultJawaban(tipe),
        opsi,
        poin: tipe === 'essay' ? 8 : 2,
        jumlah_pernyataan: tipe === 'multiple_true_false' ? 3 : undefined,
        jumlah_pasang: tipe === 'matching' ? 3 : undefined,
        panjang_jawaban: tipe === 'short_answer' ? 10 : undefined,
      }));
      return [...prev, ...added];
    });
  }, []);

  const openCreateModal = () => {
    setEditingKunci(null);
    setFormJumlahSoal(20);
    setDefaultTipe('single_choice');
    setRangeStart(1);
    setRangeEnd(20);
    setRangeTipe('single_choice');
    setRangePoin(2);
    initSoal(20, 'single_choice');
    setShowCreateModal(true);
  };

  const openEditModal = (k: any) => {
    setEditingKunci(k);
    const items = Array.isArray(k.data_json) ? k.data_json : [];
    const count = items.length || 20;
    const rawGlobalTipe = (k.tipe_soal === 'A-E' ? 'single_choice' : k.tipe_soal === 'A-D' ? 'single_choice_4' : k.tipe_soal === 'Benar-Salah' ? 'true_false' : k.tipe_soal) || 'single_choice';
    const bobotMap = k.pengaturan_poin || {};
    const defaultBenar = Number(bobotMap.benar ?? 1);
    setFormJumlahSoal(count);
    setDefaultTipe(rawGlobalTipe as TipeSoalKode);
    setRangeStart(1);
    setRangeEnd(count);
    setFormSoal(
      items.map((item: any, idx: number) => {
        const no = Number(item.no || idx + 1);
        const t = (item.tipe || rawGlobalTipe) as TipeSoalKode;
        const tipeDef = TIPE_SOAL_AKM.find(x => x.kode === t);
        const savedPoin = Number(item.poin ?? bobotMap[String(no)] ?? defaultBenar);
        return {
          no,
          tipe: t,
          jawaban: item.jawaban ?? item.ans ?? defaultJawaban(t),
          opsi: item.opsi?.length ? item.opsi : (tipeDef?.opsi ? [...tipeDef.opsi] : []),
          poin: !isNaN(savedPoin) && savedPoin > 0 ? savedPoin : 1,
          jumlah_pernyataan: item.jumlah_pernyataan,
          jumlah_pasang: item.jumlah_pasang,
          panjang_jawaban: item.panjang_jawaban,
        };
      })
    );
    setShowCreateModal(true);
  };

  const updateSoalItem = (idx: number, patch: Partial<SoalItem>) => {
    setFormSoal(prev => {
      const next = [...prev];
      const updated = { ...next[idx], ...patch };
      // Reset jawaban saat tipe berubah
      if (patch.tipe && patch.tipe !== next[idx].tipe) {
        const tipeDef = TIPE_SOAL_AKM.find(t => t.kode === patch.tipe);
        updated.opsi = tipeDef?.opsi ? [...tipeDef.opsi] : [];
        updated.jawaban = defaultJawaban(patch.tipe);
        if (patch.tipe === 'multiple_true_false') updated.jumlah_pernyataan = 3;
        if (patch.tipe === 'matching') updated.jumlah_pasang = 3;
        if (patch.tipe === 'short_answer') updated.panjang_jawaban = 10;
        if (patch.tipe === 'essay' && (!updated.poin || updated.poin <= 2)) updated.poin = 8;
      }
      next[idx] = updated;
      return next;
    });
  };

  // Terapkan satu tipe ke semua soal
  const applyAllTipe = (tipe: TipeSoalKode) => {
    const tipeDef = TIPE_SOAL_AKM.find(t => t.kode === tipe);
    const opsi = tipeDef?.opsi ? [...tipeDef.opsi] : [];
    setFormSoal(prev => prev.map(item => ({
      ...item, tipe, opsi,
      jawaban: defaultJawaban(tipe),
      poin: tipe === 'essay' ? 8 : (item.poin || 2),
      jumlah_pernyataan: tipe === 'multiple_true_false' ? 3 : undefined,
      jumlah_pasang: tipe === 'matching' ? 3 : undefined,
      panjang_jawaban: tipe === 'short_answer' ? 10 : undefined,
    })));
    setDefaultTipe(tipe);
  };

  // Terapkan tipe & poin pada rentang nomor tertentu (misal No 21 s/d 30 -> Benar/Salah, Poin 2)
  const applyRangeConfig = () => {
    const s = Math.max(1, Math.min(formSoal.length, Number(rangeStart) || 1));
    const e = Math.max(s, Math.min(formSoal.length, Number(rangeEnd) || formSoal.length));
    const p = Math.max(0.5, Number(rangePoin) || 1);
    const tipeDef = TIPE_SOAL_AKM.find(t => t.kode === rangeTipe);
    const opsi = tipeDef?.opsi ? [...tipeDef.opsi] : [];

    setFormSoal(prev => prev.map(item => {
      if (item.no < s || item.no > e) return item;
      const tipeChanged = item.tipe !== rangeTipe;
      return {
        ...item,
        tipe: rangeTipe,
        opsi: tipeChanged ? opsi : item.opsi,
        jawaban: tipeChanged ? defaultJawaban(rangeTipe) : item.jawaban,
        poin: p,
        jumlah_pernyataan: rangeTipe === 'multiple_true_false' ? (item.jumlah_pernyataan || 3) : undefined,
        jumlah_pasang: rangeTipe === 'matching' ? (item.jumlah_pasang || 3) : undefined,
        panjang_jawaban: rangeTipe === 'short_answer' ? (item.panjang_jawaban || 10) : undefined,
      };
    }));
    toast.success(`Soal #${s}–#${e} diatur ke ${tipeDef?.label || rangeTipe} (${p} poin/soal)`);
  };

  // Preset 1-Klik: 35 Soal Campuran (20 PG @ 2 poin + 10 B/S @ 2 poin + 5 Esai @ 8 poin = 100 Poin)
  const applyPresetMixed35 = (last5Type: 'essay' | 'short_answer' = 'essay') => {
    setFormJumlahSoal(35);
    setRangeStart(31);
    setRangeEnd(35);
    setRangeTipe(last5Type);
    setRangePoin(8);
    const items: SoalItem[] = Array.from({ length: 35 }, (_, idx) => {
      const no = idx + 1;
      if (no <= 20) {
        return { no, tipe: 'single_choice', jawaban: 'A', opsi: ['A', 'B', 'C', 'D', 'E'], poin: 2 };
      }
      if (no <= 30) {
        return { no, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'], poin: 2 };
      }
      return {
        no,
        tipe: last5Type,
        jawaban: '',
        opsi: [],
        poin: 8,
        panjang_jawaban: last5Type === 'short_answer' ? 12 : undefined,
      };
    });
    setFormSoal(items);
    toast.success(
      last5Type === 'essay'
        ? 'Paket 35 Soal (20 PG + 10 B/S + 5 Esai = 100 Poin) siap digunakan!'
        : 'Paket 35 Soal (20 PG + 10 B/S + 5 Isian Singkat = 100 Poin) siap digunakan!'
    );
  };

  // Bagi proporsional otomatis agar total bobot = 100 Poin
  const normalizeTotalPointsTo100 = () => {
    if (formSoal.length === 0) return;
    const essayIndices = formSoal.filter(s => s.tipe === 'essay').map(s => s.no);
    const nonEssayCount = formSoal.length - essayIndices.length;

    if (essayIndices.length > 0 && nonEssayCount > 0) {
      // Alokasikan ~40% bobot untuk esai dan ~60% untuk objektif/isian
      const objPoin = Math.max(0.5, Math.round((60 / nonEssayCount) * 2) / 2);
      const usedObj = objPoin * nonEssayCount;
      const remForEssay = Math.max(essayIndices.length, 100 - usedObj);
      const esaiPoin = Math.round((remForEssay / essayIndices.length) * 2) / 2;
      setFormSoal(prev => prev.map(s => ({
        ...s,
        poin: s.tipe === 'essay' ? esaiPoin : objPoin,
      })));
      toast.success(`Bobot diatur otomatis: Objektif/Isian @ ${objPoin} poin, Esai @ ${esaiPoin} poin.`);
    } else {
      const eqPoin = Math.max(0.5, Math.round((100 / formSoal.length) * 100) / 100);
      setFormSoal(prev => prev.map(s => ({ ...s, poin: eqPoin })));
      toast.success(`Bobot seluruh soal disamaratakan @ ${eqPoin} poin (Total ~100 Poin).`);
    }
  };

  const totalBobotPoin = useMemo(
    () => Math.round(formSoal.reduce((sum, item) => sum + (Number(item.poin) || 1), 0) * 100) / 100,
    [formSoal]
  );

  // ─── Create: submit ───────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      // Tentukan tipe_soal global untuk LJK (ambil tipe terbanyak)
      const typeCounts = formSoal.reduce((acc, s) => { acc[s.tipe] = (acc[s.tipe] || 0) + 1; return acc; }, {} as Record<string, number>);
      const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || defaultTipe;

      const perSoalPoinMap: Record<string, number> = {};
      formSoal.forEach(s => {
        perSoalPoinMap[String(s.no)] = Number(s.poin) > 0 ? Number(s.poin) : Number(fd.get('poin_benar') || 1);
      });

      const dataKunci = {
        ...(editingKunci?.id_kunci ? { id_kunci: editingKunci.id_kunci } : {}),
        id_mapel: fd.get('id_mapel') as string,
        id_kelas: fd.get('id_kelas') as string,
        judul_ujian: fd.get('judul_ujian') as string,
        tipe_soal: dominantType, // Legacy field tetap ada
        pengaturan_poin: {
          benar: Number(fd.get('poin_benar') || 1),
          salah: Number(fd.get('poin_salah') || 0),
          tidak_dijawab: 0,
          ...perSoalPoinMap,
        },
        data_json: formSoal.map(s => ({
          no: s.no,
          tipe: s.tipe,
          jawaban: s.jawaban,
          opsi: s.opsi,
          poin: Number(s.poin) > 0 ? Number(s.poin) : Number(fd.get('poin_benar') || 1),
          ...(s.jumlah_pernyataan ? { jumlah_pernyataan: s.jumlah_pernyataan } : {}),
          ...(s.jumlah_pasang ? { jumlah_pasang: s.jumlah_pasang } : {}),
          ...(s.panjang_jawaban ? { panjang_jawaban: s.panjang_jawaban } : {}),
        })),
        segmen: [],
      };
      const res = await saveKunciAction(dataKunci);
      if (res.success) {
        toast.success(editingKunci ? 'Master kunci jawaban berhasil diperbarui!' : 'Master kunci jawaban berhasil dibuat!');
        setShowCreateModal(false);
        setEditingKunci(null);
        fetchData(true);
      } else toast.error(res.message);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['ID Kunci', 'Judul Ujian', 'Mata Pelajaran', 'Kelas', 'Guru', 'Jumlah Butir', 'Tanggal'],
      ...filteredKunci.map(k => [k.id_kunci, k.judul_ujian, k.nama_mapel, k.nama_kelas, k.nama_guru, k.data_json?.length || 0,
        k.timestamp ? new Date(k.timestamp).toLocaleDateString('id-ID') : '-'])
    ].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kunci_jawaban.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Data berhasil diekspor!');
  };

  const irtColor = (cat: string) => {
    if (cat === 'Mudah') return { bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    if (cat === 'Sulit') return { bar: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
    return { bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <div className="text-slate-500 dark:text-slate-400 font-bold animate-pulse tracking-tight">Sinkronisasi Bank Soal...</div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
            <span className="p-2.5 sm:p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl sm:rounded-[1.5rem] text-indigo-500 text-xl sm:text-2xl shadow-inner border border-indigo-500/10 dark:border-indigo-500/20">📑</span>
            Kunci Jawaban & Ujian
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-semibold text-sm max-w-xl">
            Manajemen master soal AKM — Pilihan Ganda, Kompleks, Menjodohkan, Isian Singkat, Uraian.
          </p>
          {/* AKM Tipe chips (Desktop Only agar layar HP lebih ringkas) */}
          <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
            {TIPE_SOAL_AKM.map(t => (
              <span key={t.kode} className={`px-2 py-0.5 rounded text-[9px] font-black border ${TIPE_COLOR[t.color]}`}>{t.short} {t.label}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button onClick={openCreateModal}
            className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/25 active:scale-95">
            <Plus className="w-4 h-4" /> Buat Master Baru
          </button>
          <button onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:border-indigo-300 transition-all shadow-sm active:scale-95">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="w-11 h-11 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all disabled:opacity-50 shadow-sm active:scale-95">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Kunci', value: stats.totalKunci, icon: <Key className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Mata Pelajaran', value: stats.mapelUnik, icon: <BookOpen className="w-4 h-4" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Rata-rata Butir', value: stats.rataButir, icon: <ClipboardList className="w-4 h-4" />, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'Total Butir Soal', value: stats.totalSoal, icon: <FileText className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.05] rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-sm backdrop-blur-sm">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 ${s.bg} rounded-xl flex items-center justify-center ${s.color} flex-shrink-0`}>{s.icon}</div>
            <div>
              <div className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
          <input type="text" placeholder="Cari judul ujian, mapel, atau guru..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-10 pr-9 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="relative">
          <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)}
            className={`appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-4 pr-9 py-3 text-sm font-bold focus:outline-none transition-all cursor-pointer shadow-sm ${filterMapel !== 'ALL' ? 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
            <option value="ALL">Semua Mapel</option>
            {masterData.mapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
            className={`appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-4 pr-9 py-3 text-sm font-bold focus:outline-none transition-all cursor-pointer shadow-sm ${filterKelas !== 'ALL' ? 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
            <option value="ALL">Semua Kelas</option>
            {masterData.kelas.map(k => <option key={k.id_kelas} value={k.id_kelas}>[{k.jenjang}] {k.nama_kelas}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        {activeFilters > 0 && (
          <button onClick={() => { setSearchTerm(''); setFilterMapel('ALL'); setFilterKelas('ALL'); }}
            className="flex items-center gap-1.5 px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20 flex-shrink-0">
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{filteredKunci.length} kunci · hal {currentPage}/{totalPages || 1}</span>
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{stats.totalSoal} butir soal</span>
        </div>

        {/* ── Mobile Native Card View (Hanya tampil di layar HP <640px) ── */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
          {paginatedKunci.length > 0 ? paginatedKunci.map((k, i) => {
            const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
            const tgl = k.timestamp ? new Date(k.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
            const tipeDistribusi = getTipeDistribusi(k.data_json || []);
            return (
              <div key={k.id_kunci} className="p-4 space-y-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500">#{globalIdx}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        <BookOpen className="w-2.5 h-2.5" />{k.nama_mapel}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">· {k.nama_kelas || 'Semua'}</span>
                    </div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white leading-snug">{k.judul_ujian}</h4>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{k.nama_guru || k.id_guru}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{tgl}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-slate-50 dark:bg-white/[0.03] px-2.5 py-1.5 rounded-xl border border-slate-200/70 dark:border-white/5">
                    <div className="text-base font-black text-indigo-600 dark:text-indigo-400 leading-none">{k.data_json?.length || 0}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Soal</div>
                  </div>
                </div>

                {/* Tipe AKM Badges */}
                <div className="flex flex-wrap gap-1">
                  {Object.keys(tipeDistribusi).length > 0
                    ? Object.entries(tipeDistribusi).map(([tipe, jumlah]) => (
                        <div key={tipe} className="flex items-center gap-0.5">
                          <TipeBadge kode={tipe} />
                          <span className="text-[8px] text-slate-400 font-mono">×{jumlah}</span>
                        </div>
                      ))
                    : <TipeBadge kode={k.tipe_soal || 'single_choice'} />
                  }
                </div>

                {/* Mobile Action Grid */}
                <div className="grid grid-cols-6 gap-1.5 pt-1">
                  <button onClick={() => handleScanLJK(k)} className="col-span-2 py-2 px-2.5 rounded-xl bg-violet-600 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95">
                    <ScanLine className="w-3.5 h-3.5" /> Scan
                  </button>
                  <button onClick={() => handlePrintLJK(k)} className="py-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center active:scale-95" title="Cetak LJK">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDetailKunci(k)} className="py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95" title="Detail">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEditModal(k)} className="py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center active:scale-95" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete({ id: k.id_kunci, label: k.judul_ujian })} className="py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center active:scale-95" title="Hapus">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-10 text-center text-xs text-slate-400 font-bold">Belum ada kunci jawaban yang cocok.</div>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[540px] touch-scroll">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0d1117] text-[9px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/[0.05]">
              <tr>
                <th className="px-5 py-4 w-8 text-center">#</th>
                <th className="px-5 py-4 cursor-pointer" onClick={() => toggleSort('judul_ujian')}>
                  <div className="flex items-center gap-1.5">Judul Ujian <SortIcon field="judul_ujian" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer" onClick={() => toggleSort('nama_mapel')}>
                  <div className="flex items-center gap-1.5">Mapel <SortIcon field="nama_mapel" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer" onClick={() => toggleSort('nama_kelas')}>
                  <div className="flex items-center gap-1.5">Kelas <SortIcon field="nama_kelas" /></div>
                </th>
                <th className="px-5 py-4">Tipe AKM</th>
                <th className="px-5 py-4 text-center cursor-pointer" onClick={() => toggleSort('jumlah_soal')}>
                  <div className="flex items-center justify-center gap-1.5">Butir <SortIcon field="jumlah_soal" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer" onClick={() => toggleSort('timestamp')}>
                  <div className="flex items-center gap-1.5">Tanggal <SortIcon field="timestamp" /></div>
                </th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.02]">
              {paginatedKunci.length > 0 ? paginatedKunci.map((k, i) => {
                const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
                const tgl = k.timestamp ? new Date(k.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
                const tipeDistribusi = getTipeDistribusi(k.data_json || []);
                return (
                  <tr key={k.id_kunci} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4 text-center text-[10px] font-black text-slate-400 dark:text-slate-600">{globalIdx}</td>
                    <td className="px-5 py-4">
                      <div className="font-black text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors max-w-[200px] truncate">{k.judul_ujian}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{k.nama_guru || k.id_guru}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                        <BookOpen className="w-2.5 h-2.5" />{k.nama_mapel}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">{k.nama_kelas || 'Semua'}</span>
                    </td>
                    <td className="px-5 py-4">
                      {/* Tampilkan badge per tipe yang ada */}
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(tipeDistribusi).length > 0
                          ? Object.entries(tipeDistribusi).map(([tipe, jumlah]) => (
                              <div key={tipe} className="flex items-center gap-0.5">
                                <TipeBadge kode={tipe} />
                                <span className="text-[8px] text-slate-400 font-mono">×{jumlah}</span>
                              </div>
                            ))
                          : <TipeBadge kode={k.tipe_soal || 'single_choice'} />
                        }
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <div className="font-black text-sm text-slate-700 dark:text-slate-300">{k.data_json?.length || 0}</div>
                        <div className="w-12 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-indigo-500/60 rounded-full" style={{ width: `${Math.min(100, ((k.data_json?.length || 0) / maxButir) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{tgl}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5 opacity-100 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetailKunci(k)} title="Detail Kunci" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-all active:scale-95"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEditModal(k)} title="Edit Kunci Jawaban" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition-all active:scale-95"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleScanLJK(k)} title="Scan LJK Ujian Ini" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-violet-500/20 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 flex items-center justify-center transition-all active:scale-95"><ScanLine className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handlePrintLJK(k)} title="Cetak LJK" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-sky-500/20 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all active:scale-95"><Printer className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleShowIRT(k)} title="Analisis IRT" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center justify-center transition-all active:scale-95"><BarChart3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDelete({ id: k.id_kunci, label: k.judul_ujian })} title="Hapus" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all active:scale-95"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="text-5xl mb-4 grayscale opacity-20">📑</div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                      {activeFilters > 0 ? 'Tidak ada kunci sesuai filter.' : 'Bank soal masih kosong.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            {filteredKunci.length > 0 ? <>Menampilkan <span className="text-indigo-600 dark:text-indigo-500">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredKunci.length)}</span>–<span className="text-indigo-600 dark:text-indigo-500">{Math.min(currentPage * ITEMS_PER_PAGE, filteredKunci.length)}</span> dari <span className="text-indigo-600 dark:text-indigo-500">{filteredKunci.length}</span></> : '0 kunci'}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 transition-all"><ChevronLeft className="w-3.5 h-3.5" /></button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black transition-all ${currentPage === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 transition-all"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Total: <span className="text-indigo-600 dark:text-indigo-500">{kunciData.length}</span></div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL: Detail Kunci
      ════════════════════════════════════════════ */}
      {detailKunci && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setDetailKunci(null); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-2xl rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden my-0 sm:my-8 max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600/10 to-transparent px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3">
                  <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"><FileText className="w-4 h-4" /></span>
                  Detail Kunci Jawaban
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{detailKunci.nama_mapel} · {detailKunci.nama_kelas}</p>
              </div>
              <button onClick={() => setDetailKunci(null)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all active:scale-95"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 flex-1 overflow-y-auto touch-scroll">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Judul Ujian', val: detailKunci.judul_ujian },
                  { label: 'Guru', val: detailKunci.nama_guru || detailKunci.id_guru },
                  { label: 'Poin Benar', val: detailKunci.pengaturan_poin?.benar ?? '—' },
                  { label: 'Poin Salah', val: detailKunci.pengaturan_poin?.salah ?? '—' },
                  { label: 'Tahun Ajaran', val: detailKunci.tahun_ajaran || '—' },
                  { label: 'Semester', val: detailKunci.semester || '—' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3 border border-slate-100 dark:border-white/5">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</div>
                    <div className="font-black text-slate-900 dark:text-white text-sm">{String(item.val)}</div>
                  </div>
                ))}
              </div>

              {/* Distribusi tipe */}
              {detailKunci.data_json?.length > 0 && (() => {
                const dist = getTipeDistribusi(detailKunci.data_json);
                return (
                  <div>
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Distribusi Tipe Soal</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dist).map(([tipe, jumlah]) => {
                        const def = TIPE_SOAL_AKM.find(t => t.kode === tipe);
                        return (
                          <div key={tipe} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${def ? TIPE_COLOR[def.color] : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500'}`}>
                            <span className="font-black text-[10px]">{def?.short || tipe}</span>
                            <span className="text-[9px] opacity-70">{def?.label}</span>
                            <span className="font-black text-sm">{String(jumlah)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Grid kunci jawaban per soal */}
              {detailKunci.data_json?.length > 0 && (
                <div>
                  <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Kunci Jawaban ({detailKunci.data_json.length} butir)</div>
                  <div className="overflow-y-auto max-h-64 border border-slate-200 dark:border-white/[0.07] rounded-2xl touch-scroll">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-[#131926] text-[9px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-white/[0.07]">
                        <tr>
                          <th className="px-3 py-2 text-center w-10">No</th>
                          <th className="px-3 py-2 text-center">Tipe</th>
                          <th className="px-3 py-2 text-center">Poin</th>
                          <th className="px-3 py-2">Kunci Jawaban / Rubrik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
                        {detailKunci.data_json.map((item: any, idx: number) => {
                          const no = item.no || idx + 1;
                          const poin = item.poin ?? detailKunci.pengaturan_poin?.[String(no)] ?? detailKunci.pengaturan_poin?.benar ?? 1;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                              <td className="px-3 py-2 text-center text-[10px] font-mono text-slate-400">#{no}</td>
                              <td className="px-3 py-2 text-center">
                                <TipeBadge kode={item.tipe || 'single_choice'} />
                              </td>
                              <td className="px-3 py-2 text-center text-xs font-mono font-bold text-slate-500">{poin}</td>
                              <td className="px-3 py-2 font-black text-indigo-700 dark:text-indigo-400 text-xs sm:text-sm break-words">
                                {formatJawabanDisplay(item)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
            <div className="p-4 sm:px-8 sm:py-4 border-t border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0d1117] grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0 pb-safe">
              <button onClick={() => { const target = detailKunci; setDetailKunci(null); openEditModal(target); }}
                className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all border border-emerald-500/20 flex items-center justify-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit Kunci
              </button>
              <button onClick={() => { handleScanLJK(detailKunci); setDetailKunci(null); }}
                className="py-2.5 bg-violet-500/10 hover:bg-violet-500 text-violet-600 dark:text-violet-400 hover:text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all border border-violet-500/20 flex items-center justify-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5" /> Scan LJK
              </button>
              <button onClick={() => { handlePrintLJK(detailKunci); setDetailKunci(null); }}
                className="py-2.5 bg-sky-500/10 hover:bg-sky-500 text-sky-600 dark:text-sky-400 hover:text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all border border-sky-500/20 flex items-center justify-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Cetak LJK
              </button>
              <button onClick={() => { handleShowIRT(detailKunci); setDetailKunci(null); }}
                className="py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all border border-amber-500/20 flex items-center justify-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Analisis IRT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL: Analisis IRT
      ════════════════════════════════════════════ */}
      {irtKunci && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setIrtKunci(null); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-4xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden my-0 sm:my-8 max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-amber-600/10 to-transparent px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3">
                  <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20"><BarChart3 className="w-4 h-4" /></span>
                  Analisis Psikometri IRT
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{irtKunci.judul_ujian}</p>
              </div>
              <button onClick={() => setIrtKunci(null)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all active:scale-95"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 sm:p-8 flex-1 overflow-y-auto touch-scroll">
              {loadingIRT ? (
                <div className="py-20 text-center"><Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" /><div className="text-[11px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Menghitung IRT...</div></div>
              ) : irtData.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Mudah', count: irtData.filter(d => d.category === 'Mudah').length, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                      { label: 'Sedang', count: irtData.filter(d => d.category === 'Sedang').length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
                      { label: 'Sulit', count: irtData.filter(d => d.category === 'Sulit').length, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
                        <div className={`text-3xl font-black ${s.color}`}>{s.count}</div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-y-auto max-h-[400px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
                    {irtData.map((item, i) => {
                      const clr = irtColor(item.category);
                      const barWidth = Math.max(8, Math.min(92, (parseFloat(item.irt_difficulty) + 3) * 16.6));
                      return (
                        <div key={i} className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] p-5 rounded-2xl hover:border-amber-500/30 transition-all">
                          <div className="flex justify-between items-center mb-3">
                            <div className="font-black text-slate-900 dark:text-white text-sm">Soal #{item.no}</div>
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border ${clr.badge}`}>{item.category}</span>
                          </div>
                          <div className="space-y-2 text-[10px]">
                            <div className="flex justify-between text-slate-500"><span>Kesulitan IRT</span><span className="font-black text-slate-700 dark:text-slate-300 font-mono">{item.irt_difficulty}</span></div>
                            <div className="flex justify-between text-slate-500"><span>Daya Pembeda</span><span className="font-black text-slate-700 dark:text-slate-300 font-mono">{item.ctt_difficulty}</span></div>
                            <div className="h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full ${clr.bar} rounded-full transition-all duration-700`} style={{ width: `${barWidth}%` }} />
                            </div>
                            <div className="flex justify-between pt-1">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black">{item.benar} benar</span>
                              <span className="text-rose-600 dark:text-rose-400 font-black">{item.salah} salah</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center">
                  <div className="text-5xl mb-4 grayscale opacity-20">🔬</div>
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Belum ada data hasil ujian untuk dianalisis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL: Buat / Edit Master Kunci — AKM Aware
      ════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget && !saving) { setShowCreateModal(false); setEditingKunci(null); } }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-3xl rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden my-0 sm:my-8 max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600/10 to-transparent px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3">
                  <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    {editingKunci ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </span>
                  {editingKunci ? 'Edit Master Kunci Jawaban' : 'Buat Master Kunci Jawaban'}
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Mendukung 7 tipe soal AKM · campuran tipe per butir diperbolehkan</p>
              </div>
              <button onClick={() => { setShowCreateModal(false); setEditingKunci(null); }} disabled={saving} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all disabled:opacity-30 active:scale-95"><X className="w-4 h-4" /></button>
            </div>
            <form id="kunci-master-form" key={editingKunci?.id_kunci || 'new'} onSubmit={handleCreate} className="p-4 sm:p-8 space-y-5 sm:space-y-6 flex-1 overflow-y-auto touch-scroll">

              {/* Judul */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Judul Ujian *</label>
                <input required name="judul_ujian" type="text" defaultValue={editingKunci?.judul_ujian || ''} placeholder="Contoh: UTS Matematika Wajib Semester Genap 2025"
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" />
              </div>

              {/* Mapel + Kelas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Mata Pelajaran *</label>
                  <select required name="id_mapel" defaultValue={editingKunci?.id_mapel || ''} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer">
                    <option value="">-- Pilih Mapel --</option>
                    {masterData.mapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Kelas *</label>
                  <select required name="id_kelas" defaultValue={editingKunci?.id_kelas || ''} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer">
                    <option value="">-- Pilih Kelas --</option>
                    {masterData.kelas.map(k => <option key={k.id_kelas} value={k.id_kelas}>[{k.jenjang}] {k.nama_kelas}</option>)}
                  </select>
                </div>
              </div>

              {/* Jumlah soal + Poin */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Jml Soal</label>
                  <input type="number" min={1} max={200} value={formJumlahSoal}
                    onChange={e => { const n = Number(e.target.value) || 1; setFormJumlahSoal(n); resizeSoal(n, defaultTipe); }}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-4 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Poin Benar</label>
                  <input type="number" name="poin_benar" min={0} max={10} step={0.5} defaultValue={editingKunci?.pengaturan_poin?.benar ?? 1}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-4 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Poin Salah</label>
                  <input type="number" name="poin_salah" min={-5} max={0} step={0.25} defaultValue={editingKunci?.pengaturan_poin?.salah ?? 0}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-4 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Tipe Default</label>
                  <select value={defaultTipe} onChange={e => { setDefaultTipe(e.target.value as TipeSoalKode); initSoal(formJumlahSoal, e.target.value as TipeSoalKode); }}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-4 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer">
                    {TIPE_SOAL_AKM.map(t => <option key={t.kode} value={t.kode}>{t.short} — {t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Tipe Referensi & Preset Campuran */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Terapkan Satu Tipe / Preset Komposisi Soal Campuran
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetMixed35('essay')}
                      className="px-2.5 py-1 rounded-xl text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                    >
                      🎯 Preset 35 Soal (20 PG + 10 B/S + 5 Esai)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetMixed35('short_answer')}
                      className="px-2.5 py-1 rounded-xl text-[9px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                    >
                      🎯 Preset 35 Soal (20 PG + 10 B/S + 5 Isian)
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIPE_SOAL_AKM.map(t => (
                    <button key={t.kode} type="button" onClick={() => applyAllTipe(t.kode)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${defaultTipe === t.kode ? `${TIPE_COLOR[t.color]} border-current` : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-400'}`}>
                      {t.short} {t.label}
                    </button>
                  ))}
                </div>

                {/* Generator Rentang Nomor Cepat */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider mr-1">⚡ Atur Rentang:</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>No</span>
                    <input
                      type="number"
                      min={1}
                      max={formSoal.length || 200}
                      value={rangeStart}
                      onChange={e => setRangeStart(Number(e.target.value) || 1)}
                      className="w-14 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-xs font-black"
                    />
                    <span>s/d</span>
                    <input
                      type="number"
                      min={1}
                      max={formSoal.length || 200}
                      value={rangeEnd}
                      onChange={e => setRangeEnd(Number(e.target.value) || formSoal.length)}
                      className="w-14 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-xs font-black"
                    />
                  </div>
                  <select
                    value={rangeTipe}
                    onChange={e => {
                      const nextT = e.target.value as TipeSoalKode;
                      setRangeTipe(nextT);
                      if (nextT === 'essay') setRangePoin(8);
                      else if (rangePoin >= 8) setRangePoin(2);
                    }}
                    className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-[10px] font-black text-slate-800 dark:text-white"
                  >
                    {TIPE_SOAL_AKM.map(t => <option key={t.kode} value={t.kode}>{t.short} — {t.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1 text-[10px] font-black text-slate-500">
                    <span>Poin:</span>
                    <input
                      type="number"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={rangePoin}
                      onChange={e => setRangePoin(Number(e.target.value) || 1)}
                      className="w-14 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-xs font-black text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyRangeConfig}
                    className="w-full sm:w-auto sm:ml-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                  >
                    Terapkan Rentang
                  </button>
                </div>
              </div>

              {/* Grid input per soal */}
              {formSoal.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Input Kunci, Rubrik & Bobot Poin per Butir ({formSoal.length} soal)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${totalBobotPoin === 100 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'}`}>
                        Total Bobot: {totalBobotPoin} Poin
                      </span>
                      <button
                        type="button"
                        onClick={normalizeTotalPointsTo100}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-500 text-[9px] font-black border border-slate-200 dark:border-white/10 transition-all"
                        title="Bagi otomatis bobot poin agar total = 100"
                      >
                        ⚖️ Setel Total 100 Poin
                      </button>
                    </div>
                  </div>
                  <div className="border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden">
                    {/* ── Mobile Native Stack View (Hanya tampil di layar HP <640px) ── */}
                    <div className="sm:hidden overflow-y-auto max-h-80 divide-y divide-slate-100 dark:divide-white/[0.05] bg-white dark:bg-transparent touch-scroll">
                      {formSoal.map((item, idx) => (
                        <div key={idx} className="p-3.5 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-black shrink-0">
                              #{item.no}
                            </span>
                            <select
                              value={item.tipe}
                              onChange={e => updateSoalItem(idx, { tipe: e.target.value as TipeSoalKode })}
                              className="flex-1 min-w-0 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
                            >
                              {TIPE_SOAL_AKM.map(t => <option key={t.kode} value={t.kode}>{t.short} — {t.label}</option>)}
                            </select>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Poin</span>
                              <input
                                type="number"
                                min={0.5}
                                max={100}
                                step={0.5}
                                value={item.poin ?? 1}
                                onChange={e => updateSoalItem(idx, { poin: Math.max(0.5, Number(e.target.value) || 1) })}
                                className="w-14 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-2 py-1 text-center text-xs font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <JawabanInput item={item} onChange={jwb => updateSoalItem(idx, { jawaban: jwb })} />
                            {item.tipe === 'multiple_true_false' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pernyataan</span>
                                <input
                                  type="number"
                                  min={2}
                                  max={10}
                                  value={item.jumlah_pernyataan || 3}
                                  onChange={e => {
                                    const count = Math.max(2, Math.min(10, Number(e.target.value) || 3));
                                    const current = Array.isArray(item.jawaban) ? item.jawaban : [];
                                    const nextJawaban = Array.from({ length: count }, (_, i) => current[i] || 'B');
                                    updateSoalItem(idx, { jumlah_pernyataan: count, jawaban: nextJawaban });
                                  }}
                                  className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 dark:text-white"
                                />
                              </div>
                            )}
                            {item.tipe === 'matching' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pasangan</span>
                                <input
                                  type="number"
                                  min={2}
                                  max={5}
                                  value={item.jumlah_pasang || 3}
                                  onChange={e => {
                                    const count = Math.max(2, Math.min(5, Number(e.target.value) || 3));
                                    const nextJawaban = Object.fromEntries(
                                      Array.from({ length: count }, (_, pairIndex) => {
                                        const key = String(pairIndex + 1);
                                        const current = item.jawaban?.[key];
                                        const fallback = ['A', 'B', 'C', 'D', 'E'][pairIndex];
                                        return [key, current || fallback];
                                      })
                                    );
                                    updateSoalItem(idx, { jumlah_pasang: count, jawaban: nextJawaban });
                                  }}
                                  className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 dark:text-white"
                                />
                              </div>
                            )}
                            {item.tipe === 'short_answer' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kotak Isian</span>
                                <input
                                  type="number"
                                  min={3}
                                  max={20}
                                  value={item.panjang_jawaban || 10}
                                  onChange={e => {
                                    const count = Math.max(3, Math.min(20, Number(e.target.value) || 10));
                                    updateSoalItem(idx, { panjang_jawaban: count });
                                  }}
                                  className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 dark:text-white"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Desktop & Tablet Table View (sm:block) ── */}
                    <div className="hidden sm:block overflow-y-auto max-h-80 touch-scroll">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#131926] text-[9px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-white/10">
                          <tr>
                            <th className="px-3 py-2.5 text-center w-10">No</th>
                            <th className="px-3 py-2.5 w-40">Tipe Soal</th>
                            <th className="px-3 py-2.5 w-20 text-center">Poin</th>
                            <th className="px-3 py-2.5">Kunci Jawaban / Rubrik Esai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] bg-white dark:bg-transparent">
                          {formSoal.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                              <td className="px-3 py-2.5 text-center text-[10px] font-mono font-black text-slate-400">{item.no}</td>
                              <td className="px-3 py-2.5">
                                <select value={item.tipe}
                                  onChange={e => updateSoalItem(idx, { tipe: e.target.value as TipeSoalKode })}
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer">
                                  {TIPE_SOAL_AKM.map(t => <option key={t.kode} value={t.kode}>{t.short} — {t.label}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="number"
                                  min={0.5}
                                  max={100}
                                  step={0.5}
                                  value={item.poin ?? 1}
                                  onChange={e => updateSoalItem(idx, { poin: Math.max(0.5, Number(e.target.value) || 1) })}
                                  className="w-16 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-center text-xs font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="space-y-2">
                                  <JawabanInput item={item} onChange={jwb => updateSoalItem(idx, { jawaban: jwb })} />
                                  {item.tipe === 'multiple_true_false' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pernyataan</span>
                                      <input
                                        type="number"
                                        min={2}
                                        max={10}
                                        value={item.jumlah_pernyataan || 3}
                                        onChange={e => {
                                          const count = Math.max(2, Math.min(10, Number(e.target.value) || 3));
                                          const current = Array.isArray(item.jawaban) ? item.jawaban : [];
                                          const nextJawaban = Array.from({ length: count }, (_, i) => current[i] || 'B');
                                          updateSoalItem(idx, { jumlah_pernyataan: count, jawaban: nextJawaban });
                                        }}
                                        className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
                                      />
                                    </div>
                                  )}
                                  {item.tipe === 'matching' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pasangan</span>
                                      <input
                                        type="number"
                                        min={2}
                                        max={5}
                                        value={item.jumlah_pasang || 3}
                                        onChange={e => {
                                          const count = Math.max(2, Math.min(5, Number(e.target.value) || 3));
                                          const nextJawaban = Object.fromEntries(
                                            Array.from({ length: count }, (_, pairIndex) => {
                                              const key = String(pairIndex + 1);
                                              const current = item.jawaban?.[key];
                                              const fallback = ['A', 'B', 'C', 'D', 'E'][pairIndex];
                                              return [key, current || fallback];
                                            })
                                          );
                                          updateSoalItem(idx, { jumlah_pasang: count, jawaban: nextJawaban });
                                        }}
                                        className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
                                      />
                                    </div>
                                  )}
                                  {item.tipe === 'short_answer' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kotak Isian</span>
                                      <input
                                        type="number"
                                        min={3}
                                        max={20}
                                        value={item.panjang_jawaban || 10}
                                        onChange={e => {
                                          const count = Math.max(3, Math.min(20, Number(e.target.value) || 10));
                                          updateSoalItem(idx, { panjang_jawaban: count });
                                        }}
                                        className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </form>
            <div className="p-4 sm:px-8 sm:py-4 border-t border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0d1117] flex gap-3 flex-shrink-0 pb-safe">
              <button type="button" onClick={() => { setShowCreateModal(false); setEditingKunci(null); }} disabled={saving}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 disabled:opacity-30">
                Batal
              </button>
              <button type="submit" form="kunci-master-form" disabled={saving}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="w-3.5 h-3.5" />Simpan Master Kunci</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL: Konfirmasi Hapus
      ════════════════════════════════════════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-rose-600/8 blur-[60px] rounded-full -ml-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-5"><AlertCircle className="w-7 h-7 text-rose-500" /></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Hapus Kunci Ujian?</h3>
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 mb-2 bg-rose-500/10 px-4 py-2 rounded-xl truncate">{confirmDelete.label}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-5 flex items-start gap-2">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />Penghapusan ditolak jika sudah ada hasil scan terkait.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Batal</button>
                <button onClick={handleDelete} disabled={saving} className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Menghapus...</> : <><Trash2 className="w-3.5 h-3.5" />Ya, Hapus</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
