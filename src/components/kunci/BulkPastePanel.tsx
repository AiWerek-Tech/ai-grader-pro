'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Bot,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractKunciWithAIAction } from '@/lib/actions/kunci';
import {
  downloadKunciTemplateXlsx,
  importKunciFromXlsx,
  parseBulkKeyText,
  SoalItem,
} from './kunci-utils';

type ToolTab = 'text' | 'excel' | 'ai';

interface BulkPastePanelProps {
  soalItems: SoalItem[];
  onApply: (updatedItems: SoalItem[]) => void;
  onSuggestJudul?: (judul: string) => void;
  onAppliedJumpToReview?: () => void;
  defaultOpen?: boolean;
  initialTab?: ToolTab;
  onCloseDrawer?: () => void;
}

/** Panel Alat Isi Cepat: Tempel Teks Massal, Impor Excel (.xlsx), dan Ekstrak Kunci AI. */
export default function BulkPastePanel({
  soalItems,
  onApply,
  onSuggestJudul,
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
  const [aiFile, setAiFile] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [extractingAI, setExtractingAI] = useState(false);
  const aiImageRef = useRef<HTMLInputElement>(null);

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

  const handleAiImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 4 MB agar proses AI tetap cepat.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      setAiFile({ name: file.name, base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  };

  const handleExtractAI = async () => {
    if (!aiText.trim() && !aiFile) {
      toast.error('Tempel naskah soal/kunci atau pilih foto dokumen kunci terlebih dahulu.');
      return;
    }
    setExtractingAI(true);
    try {
      const res = await extractKunciWithAIAction({
        rawText: aiText.trim() || undefined,
        imageBase64: aiFile?.base64,
        mimeType: aiFile?.mimeType,
      });
      if (!res.success || !res.data?.items?.length) {
        toast.error(res.message || 'AI tidak berhasil mengekstrak kunci jawaban.');
        return;
      }
      onApply(res.data.items as SoalItem[]);
      if (res.data.judul_saran && onSuggestJudul) {
        onSuggestJudul(res.data.judul_saran);
      }
      toast.success(`AI mengekstrak ${res.data.items.length} butir soal & kunci jawaban!`);
      setAiText('');
      setAiFile(null);
      setOpen(false);
      onAppliedJumpToReview?.();
    } catch (err: any) {
      toast.error(err?.message || 'Terjadi gangguan saat memproses AI.');
    } finally {
      setExtractingAI(false);
    }
  };

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
              Tempel teks <code className="font-mono font-bold">ABCDE...</code>, impor Excel, atau ekstrak foto kunci via AI
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
            Isi tabel nomor, kode tipe (`PG-E`, `PG-D`, `B/S`, `PGK`, `MTF`, `JDH`, `ISN`, `ESI`), kunci jawaban, dan bobot poin di Excel, lalu unggah ke sini.
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

      {/* TAB 3: EKSTRAK AI */}
      {tab === 'ai' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Tempel teks dokumen soal yang berisi kunci, atau unggah foto tabel kunci jawaban. AI otomatis mengenali jumlah soal, tipe AKM, dan jawabannya.
          </p>

          <textarea
            rows={3}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Tempel teks naskah soal/kunci di sini (opsional jika unggah foto)..."
            className="w-full p-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs outline-none focus:border-purple-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={aiImageRef}
                type="file"
                accept="image/*"
                onChange={handleAiImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => aiImageRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-purple-400">
                <ImagePlus className="w-3.5 h-3.5 text-purple-500" />
                {aiFile ? aiFile.name : 'Pilih Foto Kunci (Maks 4MB)'}
              </button>
              {aiFile && (
                <button
                  type="button"
                  onClick={() => setAiFile(null)}
                  className="text-[11px] font-bold text-rose-500 hover:underline">
                  Hapus Foto
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={extractingAI || (!aiText.trim() && !aiFile)}
              onClick={handleExtractAI}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-1.5">
              {extractingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              Ekstrak Sekarang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
