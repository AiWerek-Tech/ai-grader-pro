'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractKunciWithAIAction } from '@/lib/actions/kunci';
import type { AiExtractMode, SanitizedAiExtraction } from '@/lib/ai/kunci-extractor';
import {
  getTipeDistribusi,
  getTipeMeta,
  JenisAsesmenKode,
  SemesterKode,
  TIPE_COLOR,
} from '@/lib/constants/tipe-soal';
import {
  downloadKunciTemplateXlsx,
  importKunciFromXlsx,
  parseBulkKeyText,
  SoalItem,
} from './kunci-utils';

type ToolTab = 'text' | 'excel' | 'ai';

interface PreparedAiFile {
  name: string;
  base64: string;
  mimeType: string;
  sizeKb: number;
  kind: 'image' | 'pdf' | 'word' | 'text';
}

interface BulkPastePanelProps {
  soalItems: SoalItem[];
  onApply: (updatedItems: SoalItem[]) => void;
  onSuggestJudul?: (judul: string) => void;
  onSuggestMeta?: (meta: {
    judul?: string;
    jenisAsesmen?: JenisAsesmenKode;
    semester?: SemesterKode;
  }) => void;
  onAppliedJumpToReview?: () => void;
  defaultOpen?: boolean;
  initialTab?: ToolTab;
  onCloseDrawer?: () => void;
}

const MAX_AI_FILES = 6;
const MAX_NON_IMAGE_MB = 9;
const MAX_TOTAL_PAYLOAD_KB = 10500;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const idx = dataUrl.indexOf(',');
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

/** Kompresi foto kamera besar ke JPEG tajam <= 1800px di browser agar cepat diunggah & terbaca presisi. */
function compressImageForAi(file: File): Promise<{ base64: string; mimeType: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Gagal membaca gambar "${file.name}".`));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => {
        const idx = dataUrl.indexOf(',');
        const rawB64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
        resolve({
          base64: rawB64,
          mimeType: file.type || 'image/jpeg',
          sizeKb: Math.max(1, Math.round((rawB64.length * 0.75) / 1024)),
        });
      };
      img.onload = () => {
        try {
          const maxDim = 1800;
          let targetW = img.width || 1200;
          let targetH = img.height || 1600;
          if (targetW > maxDim || targetH > maxDim) {
            const ratio = Math.min(maxDim / targetW, maxDim / targetH);
            targetW = Math.max(1, Math.round(targetW * ratio));
            targetH = Math.max(1, Math.round(targetH * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const idx = dataUrl.indexOf(',');
            const rawB64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
            resolve({
              base64: rawB64,
              mimeType: file.type || 'image/jpeg',
              sizeKb: Math.max(1, Math.round((rawB64.length * 0.75) / 1024)),
            });
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const jpegUrl = canvas.toDataURL('image/jpeg', 0.86);
          const idx = jpegUrl.indexOf(',');
          const b64 = idx >= 0 ? jpegUrl.slice(idx + 1) : jpegUrl;
          resolve({
            base64: b64,
            mimeType: 'image/jpeg',
            sizeKb: Math.max(1, Math.round((b64.length * 0.75) / 1024)),
          });
        } catch {
          const idx = dataUrl.indexOf(',');
          const rawB64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
          resolve({
            base64: rawB64,
            mimeType: file.type || 'image/jpeg',
            sizeKb: Math.max(1, Math.round((rawB64.length * 0.75) / 1024)),
          });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function prepareFileForAi(file: File): Promise<PreparedAiFile> {
  const lower = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|heic)$/i.test(lower)) {
    const compressed = await compressImageForAi(file);
    return {
      name: file.name,
      base64: compressed.base64,
      mimeType: compressed.mimeType,
      sizeKb: compressed.sizeKb,
      kind: 'image',
    };
  }

  if (file.size > MAX_NON_IMAGE_MB * 1024 * 1024) {
    throw new Error(`Ukuran "${file.name}" melebihi ${MAX_NON_IMAGE_MB} MB.`);
  }

  const base64 = await readFileAsBase64(file);
  const sizeKb = Math.max(1, Math.round((base64.length * 0.75) / 1024));

  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    return { name: file.name, base64, mimeType: 'application/pdf', sizeKb, kind: 'pdf' };
  }
  if (
    lower.endsWith('.docx') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      name: file.name,
      base64,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeKb,
      kind: 'word',
    };
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv') || mime.startsWith('text/')) {
    return { name: file.name, base64, mimeType: 'text/plain', sizeKb, kind: 'text' };
  }

  throw new Error(
    `Format "${file.name}" belum didukung. Gunakan Foto (JPG/PNG), PDF, Word (.docx), atau TXT.`
  );
}

/** Panel Alat Isi Cepat: Tempel Teks Massal, Impor Excel (.xlsx), dan Ekstrak Soal & Kunci AI (Multi-Foto/PDF/Word/Teks). */
export default function BulkPastePanel({
  soalItems,
  onApply,
  onSuggestJudul,
  onSuggestMeta,
  onAppliedJumpToReview,
  defaultOpen = false,
  initialTab = 'text',
  onCloseDrawer,
}: BulkPastePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<ToolTab>(initialTab);

  // Tab 1: Text Paste
  const [rawText, setRawText] = useState('');
  const preview = useMemo(() => parseBulkKeyText(rawText, soalItems), [rawText, soalItems]);

  // Tab 2: Excel Import
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = useState(false);

  // Tab 3: AI Extract
  const [aiText, setAiText] = useState('');
  const [aiFiles, setAiFiles] = useState<PreparedAiFile[]>([]);
  const [aiMode, setAiMode] = useState<AiExtractMode>('auto');
  const [scaleTo100, setScaleTo100] = useState(true);
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [extractingAI, setExtractingAI] = useState(false);
  const [aiPreview, setAiPreview] = useState<SanitizedAiExtraction | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyText = () => {
    if (preview.appliedCount === 0) {
      toast.error('Tidak ada kunci jawaban valid yang terbaca. Coba format seperti "A B C D E" atau "1. A 2. B".');
      return;
    }
    onApply(preview.updatedItems);
    toast.success(`${preview.appliedCount} kunci jawaban berhasil diisi otomatis!`);
    setRawText('');
    setOpen(false);
    onAppliedJumpToReview?.();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingExcel(true);
    try {
      const res = await importKunciFromXlsx(file);
      onApply(res.items);
      toast.success(
        `${res.importedCount} butir kunci berhasil diimpor dari Excel${
          res.skippedCount > 0 ? ` (${res.skippedCount} baris dilewati)` : ''
        }.`
      );
      setOpen(false);
      onAppliedJumpToReview?.();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membaca file Excel.');
    } finally {
      setImportingExcel(false);
    }
  };

  const handleAiFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    const remainingSlots = MAX_AI_FILES - aiFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksimal ${MAX_AI_FILES} lampiran per ekstraksi.`);
      return;
    }

    setPreparingFiles(true);
    try {
      const added: PreparedAiFile[] = [];
      let runningKb = aiFiles.reduce((s, f) => s + f.sizeKb, 0);

      for (const file of picked.slice(0, remainingSlots)) {
        const prepared = await prepareFileForAi(file);
        if (runningKb + prepared.sizeKb > MAX_TOTAL_PAYLOAD_KB) {
          toast.error(`Total ukuran lampiran melebihi batas (~10 MB). File "${file.name}" dilewati.`);
          break;
        }
        runningKb += prepared.sizeKb;
        added.push(prepared);
      }

      if (added.length > 0) {
        setAiFiles((prev) => [...prev, ...added]);
        setAiPreview(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses file lampiran.');
    } finally {
      setPreparingFiles(false);
    }
  };

  const removeAiFile = (index: number) => {
    setAiFiles((prev) => prev.filter((_, idx) => idx !== index));
    setAiPreview(null);
  };

  const handleExtractAI = async () => {
    if (!aiText.trim() && aiFiles.length === 0) {
      toast.error('Tempel teks naskah soal/kunci atau pilih file Foto/PDF/Word terlebih dahulu.');
      return;
    }
    setExtractingAI(true);
    try {
      const res = await extractKunciWithAIAction({
        rawText: aiText.trim() || undefined,
        files: aiFiles.map((f) => ({
          name: f.name,
          base64: f.base64,
          mimeType: f.mimeType,
        })),
        mode: aiMode,
        scaleTo100,
      });
      if (!res.success || !res.data?.items?.length) {
        toast.error(res.message || 'AI tidak berhasil mengekstrak soal maupun kunci jawaban.');
        return;
      }

      setAiPreview(res.data);
      const warnUncertain =
        res.data.uncertainNumbers.length > 0
          ? ` (${res.data.uncertainNumbers.length} butir perlu dicek manual)`
          : '';
      toast.success(`AI mengekstrak ${res.data.items.length} butir soal${warnUncertain}. Periksa pratinjau lalu klik Terapkan.`);
    } catch (err: any) {
      toast.error(err?.message || 'Terjadi gangguan saat memproses AI.');
    } finally {
      setExtractingAI(false);
    }
  };

  const applyAiPreview = (strategy: 'replace' | 'append') => {
    if (!aiPreview) return;

    const incoming: SoalItem[] = aiPreview.items.map((it) => ({
      no: it.no,
      tipe: it.tipe,
      opsi: it.opsi,
      poin: it.poin,
      jawaban: it.jawaban,
      ...(it.jumlah_pernyataan ? { jumlah_pernyataan: it.jumlah_pernyataan } : {}),
      ...(it.jumlah_pasang ? { jumlah_pasang: it.jumlah_pasang } : {}),
      ...(it.panjang_jawaban ? { panjang_jawaban: it.panjang_jawaban } : {}),
    }));

    const finalItems =
      strategy === 'append' && soalItems.length > 0
        ? [...soalItems, ...incoming].map((s, idx) => ({ ...s, no: idx + 1 }))
        : incoming;

    onApply(finalItems);

    if (strategy === 'replace') {
      if (onSuggestMeta) {
        onSuggestMeta({
          judul: aiPreview.judul_saran || undefined,
          jenisAsesmen: aiPreview.jenis_asesmen_saran,
          semester: aiPreview.semester_saran,
        });
      } else if (aiPreview.judul_saran && onSuggestJudul) {
        onSuggestJudul(aiPreview.judul_saran);
      }
    }

    toast.success(
      strategy === 'append'
        ? `+${incoming.length} soal ditambahkan (total ${finalItems.length} butir)!`
        : `${incoming.length} butir soal & kunci berhasil diterapkan!`
    );

    setAiPreview(null);
    setAiText('');
    setAiFiles([]);
    setOpen(false);
    onAppliedJumpToReview?.();
  };

  const previewDist = useMemo(() => {
    if (!aiPreview) return {};
    return getTipeDistribusi(aiPreview.items);
  }, [aiPreview]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full p-3.5 rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 text-left flex items-center justify-between gap-3 transition-all group">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <ClipboardPaste className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
              <span>Input Kilat: Tempel Teks, Excel (.xlsx) &amp; AI</span>
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[9px] font-black uppercase">
                Hemat Waktu
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Tempel teks <code className="font-mono font-bold">ABCDE...</code>, impor Excel, atau ekstrak PDF/Word/Foto via AI
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-cyan-600 text-white text-[10px] font-black shrink-0 group-hover:scale-105 transition-transform">
          Buka →
        </span>
      </button>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/30 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'text' as const, label: 'Tempel Teks', icon: ClipboardPaste },
            { id: 'excel' as const, label: 'Impor Excel', icon: FileSpreadsheet },
            { id: 'ai' as const, label: 'Ekstrak AI', icon: Bot },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black inline-flex items-center gap-1.5 border transition-colors ${
                tab === item.id
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}>
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onCloseDrawer?.();
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Tutup Input Kilat">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: TEMPEL TEKS */}
      {tab === 'text' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Ketik atau tempel kunci berurutan dari no. 1 (misal <code className="font-mono font-bold">ABCDEABCDE</code>), dipisah spasi (<code className="font-mono font-bold">A B C D</code>), atau format bernomor (<code className="font-mono font-bold">1. A  2. B  3. AC</code>).
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setRawText('ABCDEABCDEABCDEABCDE')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-cyan-500">
              Contoh Rapat: ABCDE...
            </button>
            <button
              type="button"
              onClick={() => setRawText('1. A\n2. B\n3. C\n4. D\n5. E')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-cyan-500">
              Contoh Bernomor: 1. A ...
            </button>
          </div>

          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Tempel teks kunci di sini..."
            className="w-full p-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-cyan-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
              {rawText.trim() ? (
                <span>
                  Terdeteksi <strong className="text-cyan-600 dark:text-cyan-400">{preview.appliedCount}</strong> jawaban valid
                  {preview.skippedCount > 0 ? ` (${preview.skippedCount} diabaikan)` : ''}
                </span>
              ) : (
                <span className="text-slate-400">Menunggu teks kunci...</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleApplyText}
              disabled={preview.appliedCount === 0}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-1.5 transition-all">
              <Wand2 className="w-3.5 h-3.5" /> Terapkan ke Kunci
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: IMPOR EXCEL */}
      {tab === 'excel' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Isi tabel nomor, kode tipe (`PG-E`, `PG-D`, `B/S`, `PGK`, `MTF`, `JDH`, `JDH-1`, `ISN`, `ESI`), kunci jawaban, dan bobot poin di Excel, lalu unggah ke sini.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => downloadKunciTemplateXlsx()}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:border-cyan-500">
              <Download className="w-3.5 h-3.5 text-emerald-500" /> Unduh Template (.xlsx)
            </button>

            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={importingExcel}
              onClick={() => excelInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5">
              {importingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Unggah File Excel (.xlsx)
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: EKSTRAK AI (MULTI-FOTO, PDF, WORD .DOCX, & NASKAH TEKS) */}
      {tab === 'ai' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Tempel teks naskah soal/kunci atau unggah <strong>Foto (multi-halaman), PDF, Word (.docx), atau TXT</strong>. Foto kamera berukuran besar dikompresi otomatis, dan soal yang ragu tidak pernah ditebak asal.
          </p>

          {/* Selector Mode Ekstraksi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {[
              {
                id: 'auto' as const,
                label: 'Otomatis (Cerdas)',
                desc: 'Ambil kunci tertulis, atau jawab naskah soal bila kosong',
              },
              {
                id: 'extract_only' as const,
                label: 'Hanya Kunci Tertulis',
                desc: 'Ketat: lewati/kosongkan nomor tanpa kunci tertulis',
              },
              {
                id: 'solve_questions' as const,
                label: 'Pecahkan Soal (AI)',
                desc: 'Naskah belum ada kunci — AI analis & kerjakan soalnya',
              },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setAiMode(m.id);
                  setAiPreview(null);
                }}
                className={`p-2 rounded-xl border text-left transition-all ${
                  aiMode === m.id
                    ? 'bg-purple-600/15 border-purple-500 text-purple-900 dark:text-white'
                    : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}>
                <p className="text-[11px] font-black">{m.label}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={aiText}
            onChange={(e) => {
              setAiText(e.target.value);
              setAiPreview(null);
            }}
            placeholder="Tempel teks naskah soal lengkap atau tabel kunci jawaban di sini (opsional jika mengunggah file)..."
            className="w-full p-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs outline-none focus:border-purple-500"
          />

          {/* Daftar Lampiran Multi-File */}
          {aiFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {aiFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#050314] border border-purple-500/30 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {f.kind === 'image' ? (
                    <ImagePlus className="w-3 h-3 text-purple-500" />
                  ) : (
                    <FileText className="w-3 h-3 text-cyan-500" />
                  )}
                  <span className="max-w-[160px] truncate">{f.name}</span>
                  <span className="text-[9px] text-slate-400">({f.sizeKb} KB)</span>
                  <button
                    type="button"
                    onClick={() => removeAiFile(idx)}
                    className="p-0.5 text-rose-500 hover:bg-rose-500/10 rounded"
                    aria-label={`Hapus lampiran ${f.name}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={aiFileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.docx,.txt,.md,.csv"
                onChange={handleAiFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                disabled={preparingFiles || aiFiles.length >= MAX_AI_FILES}
                onClick={() => aiFileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-purple-400 disabled:opacity-50">
                {preparingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <ImagePlus className="w-3.5 h-3.5 text-purple-500" />}
                <span>
                  {aiFiles.length > 0
                    ? `Tambah File (${aiFiles.length}/${MAX_AI_FILES})`
                    : 'Pilih Foto / PDF / Word (.docx)'}
                </span>
              </button>

              <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={scaleTo100}
                  onChange={(e) => {
                    setScaleTo100(e.target.checked);
                    setAiPreview(null);
                  }}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Skalakan Bobot = 100</span>
              </label>
            </div>

            <button
              type="button"
              disabled={extractingAI || preparingFiles || (!aiText.trim() && aiFiles.length === 0)}
              onClick={handleExtractAI}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-1.5">
              {extractingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              <span>{extractingAI ? 'Memproses AI...' : 'Ekstrak Sekarang'}</span>
            </button>
          </div>

          {/* Kartu Pratinjau Hasil Ekstraksi AI Sebelum Diterapkan */}
          {aiPreview && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#050314] border border-purple-500/40 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Hasil Ekstraksi AI: {aiPreview.items.length} Butir Soal</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[9px] font-mono text-slate-500">
                    {aiPreview.modelUsed}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Total: {Math.round(aiPreview.items.reduce((s, it) => s + it.poin, 0) * 100) / 100} Poin
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(previewDist).map(([kode, count]) => {
                  const meta = getTipeMeta(kode);
                  return (
                    <span
                      key={kode}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${TIPE_COLOR[meta.color]}`}>
                      {meta.short}: {count}
                    </span>
                  );
                })}
                {aiPreview.jenis_asesmen_saran && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                    Saran: {aiPreview.jenis_asesmen_saran}
                    {aiPreview.semester_saran ? ` · ${aiPreview.semester_saran}` : ''}
                  </span>
                )}
              </div>

              {aiPreview.uncertainNumbers.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Ada <strong>{aiPreview.uncertainNumbers.length} butir</strong> yang belum terisi / perlu dicek manual (No.{' '}
                    {aiPreview.uncertainNumbers.slice(0, 12).join(', ')}
                    {aiPreview.uncertainNumbers.length > 12 ? ', ...' : ''}). AI sengaja mengosongkannya agar tidak menebak asal.
                  </span>
                </div>
              )}

              {aiPreview.catatan_ai && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic leading-snug">
                  Catatan AI: {aiPreview.catatan_ai}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAiPreview(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Batal
                </button>
                {soalItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => applyAiPreview('append')}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-black inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Tambahkan (+{aiPreview.items.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => applyAiPreview('replace')}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black inline-flex items-center gap-1">
                  <Wand2 className="w-3.5 h-3.5" />
                  {soalItems.length > 0 ? 'Timpa Semua Kunci' : 'Terapkan Kunci Jawaban'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
