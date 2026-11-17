'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSettingsAction } from '@/lib/actions/settings';
import { buildMachinePageLayout } from '@/lib/scan/machine-layout';
import { LJKSheet } from '@/components/ljk/LJKSheet';
import {
  Printer, ZoomIn, ZoomOut, Eye, HelpCircle, Plus, Trash2,
  Search, CheckCircle2, ArrowLeft
} from 'lucide-react';

export default function PrintPage() {
  const router = useRouter();
  const [dataReady, setDataReady] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});

  // Print Studio UI states
  const [zoom, setZoom] = useState<number>(85);
  const [showSensorGrid, setShowSensorGrid] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPageIdx, setSelectedPageIdx] = useState<number | 'ALL'>('ALL');
  const [examDate, setExamDate] = useState<string>('');

  useEffect(() => {
    async function init() {
      try {
        const settingsResult = await getSettingsAction();
        if (settingsResult.success) setSettings(settingsResult.data || {});
      } catch (error) {
        console.error('Gagal memuat settings:', error);
      }

      const raw = localStorage.getItem('WMVAA_PRINT_PAYLOAD');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.siswaList && Array.isArray(parsed.siswaList)) {
            parsed.siswaList.sort((a: any, b: any) => {
              if (a.isBlank && !b.isBlank) return 1;
              if (!a.isBlank && b.isBlank) return -1;
              return (a.nama || '').localeCompare(b.nama || '', undefined, { numeric: true });
            });
          }
          setPrintData(parsed);
          if (parsed.examDate !== undefined) {
            setExamDate(parsed.examDate);
          } else {
            setExamDate(new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
          }
          setDataReady(true);
          return;
        } catch (error) {
          console.error('Gagal memuat data cetak:', error);
        }
      }

      setPrintData({
        title: 'ASESMEN SUMATIF KURIKULUM MERDEKA',
        mapel: 'Bahasa Indonesia',
        totalSoal: 10,
        options: 'single_choice',
        siswaList: [{ nis: '0000', nama: 'LEMBAR CADANGAN', kelas: 'KELAS XII', isBlank: true }],
      });
      setExamDate(new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
      setDataReady(true);
    }

    init();
  }, []);

  const layoutDiagnostic = useMemo(() => {
    if (!printData) return null;
    const questions = Array.isArray(printData.questionConfig) && printData.questionConfig.length > 0
      ? printData.questionConfig
      : Array.from({ length: printData.totalSoal || 10 }, (_, i) => ({
          no: i + 1,
          tipe: printData.options || 'single_choice',
        }));
    const hideEssay = (printData.essayLayoutMode || 'integrated') !== 'integrated';
    return buildMachinePageLayout(questions, printData.totalSoal || 10, printData.options, hideEssay);
  }, [printData]);

  const visibleSiswaList = useMemo(() => {
    if (!printData?.siswaList) return [];
    let list = printData.siswaList.map((item: any, idx: number) => ({ ...item, _origIndex: idx }));
    if (selectedPageIdx !== 'ALL') {
      list = list.filter((item: any) => item._origIndex === selectedPageIdx);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item: any) =>
          String(item.nama || '').toLowerCase().includes(q) ||
          String(item.nis || '').toLowerCase().includes(q) ||
          String(item.kelas || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [printData, selectedPageIdx, searchQuery]);

  const handleAddBlankSheet = () => {
    if (!printData) return;
    const blankCount = (printData.siswaList || []).filter((s: any) => s.isBlank).length + 1;
    const defaultKelas = printData.siswaList?.[0]?.kelas || '';
    const defaultJenjang = printData.siswaList?.[0]?.jenjang || 'SMA';
    const nextList = [
      ...(printData.siswaList || []),
      {
        nis: '0000',
        nama: `LEMBAR CADANGAN #${blankCount}`,
        kelas: defaultKelas,
        jenjang: defaultJenjang,
        isBlank: true,
      },
    ];
    const updated = { ...printData, siswaList: nextList };
    setPrintData(updated);
    localStorage.setItem('WMVAA_PRINT_PAYLOAD', JSON.stringify(updated));
  };

  const handleRemoveBlankSheets = () => {
    if (!printData) return;
    const nonBlank = (printData.siswaList || []).filter((s: any) => !s.isBlank);
    if (nonBlank.length === 0) return;
    const updated = { ...printData, siswaList: nonBlank };
    setPrintData(updated);
    setSelectedPageIdx('ALL');
    localStorage.setItem('WMVAA_PRINT_PAYLOAD', JSON.stringify(updated));
  };

  const handleTriggerPrint = () => {
    if (showSensorGrid) setShowSensorGrid(false);
    setTimeout(() => window.print(), 60);
  };

  if (!dataReady || !printData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-10 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        <div className="font-bold text-slate-200 tracking-wide">
          Menyiapkan Lembar Cetak LJK...
        </div>
      </div>
    );
  }

  const blankSheetCount = (printData.siswaList || []).filter((s: any) => s.isBlank).length;

  return (
    <div className="bg-slate-900 min-h-screen flex flex-col items-center">
      <header className="sticky top-0 inset-x-0 w-full bg-slate-950/95 backdrop-blur-xl border-b border-white/10 text-white z-50 print:hidden shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              onClick={() => router.push('/dashboard/ljk')}
              title="Kembali ke halaman Cetak LJK di Dashboard"
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all shrink-0 flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white truncate max-w-[200px] sm:max-w-[280px]">
                  {printData.title}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Siap Cetak
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 font-medium flex items-center gap-1.5 whitespace-nowrap mt-0.5">
                <span className="truncate max-w-[140px]">{printData.mapel}</span>
                <span>•</span>
                <span className="text-sky-400 font-bold">{printData.totalSoal} Soal</span>
                {layoutDiagnostic && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-300 font-bold">
                      {layoutDiagnostic.columns} Kolom
                    </span>
                  </>
                )}
                <span>•</span>
                <span>{visibleSiswaList.length} Lembar</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap justify-end flex-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa/NIS..."
                className="bg-white/5 border border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-32 sm:w-36"
              />
            </div>

            <select
              value={selectedPageIdx}
              onChange={(e) =>
                setSelectedPageIdx(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-sky-500 max-w-[155px]"
            >
              <option value="ALL" className="bg-slate-900">
                Semua ({printData.siswaList.length} Lembar)
              </option>
              {printData.siswaList.map((s: any, idx: number) => (
                <option key={idx} value={idx} className="bg-slate-900">
                  #{idx + 1} - {s.nama} ({s.nis})
                </option>
              ))}
            </select>

            <input
              type="text"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              placeholder="Tanggal Ujian..."
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-32"
            />

            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(55, z - 10))}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-mono font-bold text-slate-200 min-w-[40px] text-center">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(125, z + 10))}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddBlankSheet}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>+Blanko</span>
            </button>

            {blankSheetCount > 0 && printData.siswaList.length > blankSheetCount && (
              <button
                type="button"
                onClick={handleRemoveBlankSheets}
                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowSensorGrid((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                showSensorGrid
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Sensor AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className={`p-1.5 rounded-xl border transition-all shrink-0 ${
                showGuide
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleTriggerPrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider py-2 px-4 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak {visibleSiswaList.length} LJK</span>
            </button>
          </div>
        </div>
      </header>

      {showGuide && (
        <div className="w-full max-w-4xl mx-auto mt-4 px-4 print:hidden">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-1.5">
            <div className="font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <span>🖨️ Panduan Pengaturan Printer Standar OMR &amp; AI Vision</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div>• <b>Ukuran Kertas (Paper Size)</b>: A4 Portrait (210 × 297 mm)</div>
              <div>• <b>Margin Kertas (Margins)</b>: None / Tanpa Tepi (0 mm)</div>
              <div>• <b>Skala Cetak (Scale)</b>: Default / 100% (Jangan Fit-to-Page)</div>
              <div>• <b>Grafis Latar (Background Graphics)</b>: Centang / Aktifkan</div>
            </div>
          </div>
        </div>
      )}

      <div
        id="print-area"
        className="py-8 print:py-0 flex flex-col items-center gap-8 print:gap-0 origin-top transition-transform duration-150"
        style={{
          transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
        }}
      >
        {visibleSiswaList.map((siswa: any, index: number) => (
          <LJKSheet
            key={`${siswa.nis || 'blank'}-${siswa._origIndex ?? index}`}
            siswa={siswa}
            mapel={printData.mapel}
            title={printData.title}
            idKunci={printData.idKunci}
            examDate={examDate}
            totalSoal={printData.totalSoal}
            options={printData.options}
            pageIndex={index}
            totalPages={visibleSiswaList.length}
            settings={settings}
            questionConfig={printData.questionConfig || null}
            showSensorGrid={showSensorGrid}
            essayLayoutMode={printData.essayLayoutMode || 'integrated'}
          />
        ))}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .print-layout-wrapper { background: white !important; margin: 0 !important; padding: 0 !important; }
          #print-area { width: 210mm !important; transform: none !important; padding: 0 !important; gap: 0 !important; }
          .ljk-page { page-break-after: always; break-after: page; }
          .ljk-page:last-child { page-break-after: auto !important; break-after: auto !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        html { color-scheme: light !important; }
      `,
        }}
      />
    </div>
  );
}
