'use client';

import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildMachinePageLayout, getMachineQuestionOptions, type EssayLayoutMode } from '@/lib/scan/machine-layout';
import { withBasePath } from '@/lib/base-path';

function FidMarker({ pos }: { pos: string }) {
  let style: React.CSSProperties = { position: 'absolute', display: 'block', zIndex: 20 };
  if (pos.includes('top-left')) style = { ...style, top: '8px', left: '8px' };
  if (pos.includes('top-right')) style = { ...style, top: '8px', right: '8px' };
  if (pos.includes('bottom-left')) style = { ...style, bottom: '8px', left: '8px' };
  if (pos.includes('bottom-right')) style = { ...style, bottom: '8px', right: '8px' };

  return (
    <svg width="26" height="26" viewBox="0 0 26 26" style={style}>
      <rect width="26" height="26" fill="#000" />
      <rect x="3" y="3" width="20" height="20" fill="#fff" />
      <rect x="8" y="8" width="10" height="10" fill="#000" />
    </svg>
  );
}

const parseDriveUrl = (url?: string) => {
  if (!url) return '';
  const idMatch = url.match(/\/d\/([^/?]+)/) || url.match(/id=([^/?&]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return url;
};

function SchoolLogo({
  src,
  defaultSrc,
  alt,
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [hideAll, setHideAll] = useState(false);

  const primaryUrl = parseDriveUrl(src);
  const activeUrl = !useFallback && primaryUrl ? primaryUrl : defaultSrc;

  if (hideAll || !activeUrl) {
    return <div className="w-[74px] h-[74px]" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useFallback && primaryUrl && primaryUrl !== defaultSrc) {
          setUseFallback(true);
        } else {
          setHideAll(true);
        }
      }}
      className="max-w-[76px] max-h-[76px] w-auto h-auto object-contain select-none"
    />
  );
}

function MachineQuestionBlock({
  question,
  areaX,
  areaY,
  areaW,
  areaH,
  density,
  showSensorGrid,
}: {
  question: any;
  areaX: number;
  areaY: number;
  areaW: number;
  areaH: number;
  density: string;
  showSensorGrid: boolean;
}) {
  const localLeft = question.x - areaX;
  const localTop = question.y - areaY;
  const toPercent = (value: number, total: number) => `${(value / Math.max(total, 1)) * 100}%`;
  const headerW = question.headerWidth || 40;
  const isCompact = density === 'compact' || density === 'ultra';
  const hasRowHeaders = Array.isArray(question.rowHeaders) && question.rowHeaders.length > 0;
  const showTypeHint = question.type && question.type !== 'single_choice';

  return (
    <div
      className="absolute border-b border-slate-200/80"
      style={{
        left: toPercent(localLeft, areaW),
        top: toPercent(localTop, areaH),
        width: toPercent(question.w, areaW),
        height: toPercent(question.h, areaH),
      }}
    >
      {/* Nomor Soal Bersih & Proporsional */}
      <div
        className={`absolute left-0 top-0 bottom-0 flex ${
          hasRowHeaders
            ? ' flex-col items-start justify-start pl-2 pt-2'
            : ' items-center justify-end pr-1.5 gap-1'
        }`}
        style={{ width: toPercent(headerW, question.w) }}
      >
        <span
          className={`${
            isCompact ? 'text-[9.5px]' : 'text-[11px]'
          } font-black text-black leading-none tabular-nums select-none`}
        >
          {question.no}.
        </span>
        {showTypeHint && (
          <span className="text-[5.5px] font-black uppercase tracking-tighter px-1 py-[1px] rounded bg-slate-100 border border-slate-300 text-slate-700 leading-none select-none">
            {question.short || question.badge}
          </span>
        )}
      </div>

      {/* Soal Isian Singkat (Kotak Karakter Presisi) */}
      {question.type === 'short_answer' ? (
        <>
          {question.textBoxes?.map((box: any) => (
            <div
              key={`${question.no}-${box.index}`}
              className="absolute border-[1.4px] border-black rounded-[2px] bg-white"
              style={{
                left: toPercent(box.x - question.x, question.w),
                top: toPercent(box.y - question.y, question.h),
                width: toPercent(box.w, question.w),
                height: toPercent(box.h, question.h),
              }}
            />
          ))}
        </>
      ) : (
        <>
          {question.colHeaders?.map((header: any) => (
            <span
              key={`${question.no}-${header.text}`}
              className={`absolute ${
                isCompact ? 'text-[6.5px]' : 'text-[7.2px]'
              } font-black text-slate-700 leading-none select-none`}
              style={{
                left: toPercent(header.x - question.x, question.w),
                top: toPercent(header.y - question.y, question.h),
                transform: 'translateX(-50%)',
              }}
            >
              {header.text}
            </span>
          ))}

          {question.rowHeaders?.map((header: any) => (
            <span
              key={`${question.no}-${header.text}`}
              className={`absolute flex items-center justify-center ${
                isCompact ? 'w-[11px] h-[11px] text-[6px]' : 'w-[13px] h-[13px] text-[7px]'
              } rounded-full border border-slate-400 bg-slate-50 font-black text-slate-800 leading-none select-none`}
              style={{
                left: toPercent(header.x - question.x, question.w),
                top: toPercent(header.y - question.y, question.h),
              }}
            >
              {header.text}
            </span>
          ))}

          {question.cells.map((cell: any) => (
            <div
              key={`${question.no}-${cell.id}`}
              className="absolute"
              data-scan-question={question.no}
              data-scan-cell={cell.id}
              data-scan-row={cell.rowKey || ''}
              data-scan-value={cell.value}
              style={{
                left: toPercent(cell.x - question.x, question.w),
                top: toPercent(cell.y - question.y, question.h),
                width: toPercent(cell.w, question.w),
                height: toPercent(cell.h, question.h),
              }}
            >
              <div
                className={
                  cell.shape === 'square'
                    ? 'w-full h-full border-[1.5px] border-black rounded-[2.5px] bg-white flex items-center justify-center'
                    : 'w-full h-full border-[1.5px] border-black rounded-full bg-white flex items-center justify-center'
                }
              >
                <span
                  className={`${
                    isCompact ? 'text-[6.8px]' : 'text-[8px]'
                  } font-extrabold text-slate-600 leading-none select-none pointer-events-none`}
                >
                  {cell.value}
                </span>
              </div>
              {showSensorGrid && (
                <div className="print:hidden absolute inset-[18%] border border-dashed border-sky-500 bg-sky-500/20 pointer-events-none" />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export interface LJKSheetProps {
  siswa: any;
  mapel: string;
  title: string;
  idKunci?: string;
  examDate?: string;
  totalSoal: number;
  options?: string;
  pageIndex: number;
  totalPages: number;
  settings: Record<string, string>;
  questionConfig?: any[] | null;
  showSensorGrid?: boolean;
  essayLayoutMode?: EssayLayoutMode;
}

export function LJKSheet({
  siswa,
  mapel,
  title,
  idKunci,
  examDate,
  totalSoal,
  options,
  pageIndex,
  totalPages,
  settings = {},
  questionConfig,
  showSensorGrid = false,
  essayLayoutMode = 'integrated',
}: LJKSheetProps) {
  const questions = useMemo(() => {
    if (Array.isArray(questionConfig) && questionConfig.length > 0) {
      return questionConfig.map((q: any) => ({
        no: q.no,
        tipe: q.tipe || q.type || options || 'single_choice',
        poin: q.poin,
        opsi:
          q.opsi?.length > 0
            ? q.opsi
            : getMachineQuestionOptions({
                no: q.no,
                tipe: q.tipe || q.type || options || 'single_choice',
              }),
        jumlah_pernyataan: q.jumlah_pernyataan,
        jumlah_pasang: q.jumlah_pasang,
        panjang_jawaban: q.panjang_jawaban,
      }));
    }

    return Array.from({ length: totalSoal }, (_, index) => ({
      no: index + 1,
      tipe: options || 'single_choice',
      poin: 1,
      opsi: getMachineQuestionOptions({ no: index + 1, tipe: options || 'single_choice' }),
      panjang_jawaban: 10,
    }));
  }, [options, questionConfig, totalSoal]);

  const hideEssayOnMainPage = essayLayoutMode !== 'integrated';

  const machineLayout = useMemo(
    () => buildMachinePageLayout(questions, totalSoal, options, hideEssayOnMainPage),
    [options, questions, totalSoal, hideEssayOnMainPage]
  );

  const isBlankSheet =
    Boolean(siswa?.isBlank) ||
    !siswa?.nis ||
    siswa?.nis === '0000' ||
    String(siswa?.nama || '').includes('LEMBAR KOSONG');

  const qrPayload = JSON.stringify({
    v: 2,
    s: isBlankSheet ? '' : String(siswa?.nis || ''),
    id: isBlankSheet ? '' : String(siswa?.id_siswa || ''),
    k: String(idKunci || title || '').slice(0, 28),
  });

  const jenjang =
    siswa?.jenjang?.toUpperCase() === 'SMP' ||
    siswa?.kelas?.toUpperCase().includes('SMP') ||
    /^(KELAS\s+)?(VII|VIII|IX|7|8|9)\b/i.test(String(siswa?.kelas || '').trim())
      ? 'smp'
      : 'sma';

  // Pengaturan Kop Sekolah dengan fallback ke logo resmi lokal
  const logoKiri = settings[`${jenjang}_logo_kiri_url`] || settings.logo_kiri_url || '/logo/logo_advent.png';
  const logoKanan = settings[`${jenjang}_logo_kanan_url`] || settings.logo_kanan_url || '/logo/tut_wuri.png';
  const namaYayasan = settings.nama_yayasan || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const sekolahBaris1 =
    settings[`${jenjang}_nama_sekolah_1`] ||
    settings.nama_sekolah_1 ||
    'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
  const sekolahBaris2 =
    settings[`${jenjang}_nama_sekolah_2`] ||
    settings.nama_sekolah_2 ||
    (jenjang === 'smp' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
  const alamat =
    settings.alamat_sekolah ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';
  const tahunAjaran = settings.tahun_ajaran || '2026/2027';
  const semester = (settings.semester || 'GANJIL').toUpperCase();

  const essayQuestions = questions.filter(
    (question: any) =>
      question.tipe === 'essay' || question.tipe === 'ESAI' || question.tipe === 'URAIAN'
  );

  const toPagePercent = (value: number, total: number) =>
    `${(value / Math.max(total, 1)) * 100}%`;
  const boxStyle = (x: number, y: number, w: number, h: number): React.CSSProperties => ({
    position: 'absolute',
    left: toPagePercent(x, machineLayout.page.width),
    top: toPagePercent(y, machineLayout.page.height),
    width: toPagePercent(w, machineLayout.page.width),
    height: toPagePercent(h, machineLayout.page.height),
  });

  // Garis pemisah antar kolom di dalam objectiveArea
  const columnDividers = useMemo(() => {
    const cols = machineLayout.columns || 2;
    if (cols <= 1) return [];
    return Array.from({ length: cols - 1 }, (_, idx) => ((idx + 1) / cols) * 100);
  }, [machineLayout.columns]);

  const essayLineCount = essayQuestions.length <= 1 ? 5 : essayQuestions.length === 2 ? 3 : 2;
  const secondPageLineCount =
    essayQuestions.length <= 2 ? 12 : essayQuestions.length <= 4 ? 8 : essayQuestions.length <= 6 ? 6 : 4;

  return (
    <>
      <div className="w-[210mm] h-[297mm] bg-white text-black relative ljk-page box-border print:break-after-page last:print:break-after-auto shadow-2xl print:shadow-none shrink-0">
        <div className="relative w-full h-full border-[2px] border-black overflow-hidden bg-white">
          {/* 4 Fiducial Markers untuk koreksi perspektif OMR & AI */}
          <FidMarker pos="top-left" />
          <FidMarker pos="top-right" />
          <FidMarker pos="bottom-left" />
          <FidMarker pos="bottom-right" />

          {/* ── 1. KOP SURAT SEKOLAH (y: 16..122, x: 44..956) ── */}
        <div style={boxStyle(44, 16, 912, 106)} className="border-b-[2px] border-black">
          <div className="h-full px-2 flex items-center justify-between gap-3">
            <div className="w-[74px] h-[74px] flex items-center justify-center shrink-0">
              <SchoolLogo
                src={logoKiri}
                defaultSrc={withBasePath("/logo/logo_advent.png")}
                alt="Logo Yayasan"
              />
            </div>

            <div className="flex-1 text-center flex flex-col items-center justify-center min-w-0">
              <div className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-slate-800 leading-none truncate max-w-full">
                {namaYayasan}
              </div>
              <div className="mt-1 text-[13px] font-black uppercase tracking-[0.05em] text-black leading-none truncate max-w-full">
                {sekolahBaris1}
              </div>
              <div className="mt-1 text-[18.5px] font-black uppercase tracking-[0.04em] text-black leading-none truncate max-w-full">
                {sekolahBaris2}
              </div>
              <div className="mt-1 text-[7.8px] font-medium italic text-slate-700 leading-tight truncate max-w-[640px]">
                {alamat}
              </div>
            </div>

            <div className="w-[74px] h-[74px] flex items-center justify-center shrink-0">
              <SchoolLogo
                src={logoKanan}
                defaultSrc={withBasePath("/logo/tut_wuri.png")}
                alt="Logo Sekolah"
              />
            </div>
          </div>
        </div>

        {/* ── 2. BANNER DUA BARIS LJK (y: 128..174) ── */}
        <div
          style={boxStyle(44, 128, 912, 46)}
          className="border-[1.5px] border-black bg-slate-900 text-white rounded-md px-4 flex flex-col items-center justify-center text-center gap-1"
        >
          <div className="text-[11px] font-black uppercase tracking-[0.2em] leading-none">
            LEMBAR JAWABAN KOMPUTER (LJK)
          </div>
          <div className="text-[8.8px] font-bold uppercase tracking-[0.1em] text-slate-200 leading-none truncate max-w-full">
            {title} &nbsp;•&nbsp; TA {tahunAjaran} ({semester})
          </div>
        </div>

        {/* ── 3. KOTAK IDENTITAS PESERTA LENGKAP (y: 180..338, x: 44..628) ── */}
        <div
          style={boxStyle(44, 180, 584, 158)}
          className="border-[1.5px] border-black rounded-md bg-white px-4 py-2.5 flex flex-col justify-between"
        >
          <div className="space-y-1.5 text-[9.5px]">
            <div className="flex items-center gap-2 py-1 border-b border-dotted border-slate-400">
              <span className="font-bold w-[112px] shrink-0 tracking-wide text-[8.5px] text-slate-700">
                NAMA PESERTA
              </span>
              <span className="font-bold">:</span>
              <span className="flex-1 font-black text-[11px] uppercase tracking-wide truncate min-h-[15px]">
                {isBlankSheet ? '' : siswa?.nama || ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-1 border-b border-dotted border-slate-400">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold w-[112px] shrink-0 tracking-wide text-[8.5px] text-slate-700">
                  NIS / NO. PESERTA
                </span>
                <span className="font-bold">:</span>
                <span className="flex-1 font-black font-mono text-[10.5px] tracking-wider truncate min-h-[14px]">
                  {isBlankSheet ? '' : siswa?.nis || ''}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold shrink-0 tracking-wide text-[8.5px] text-slate-700">
                  KELAS
                </span>
                <span className="font-bold">:</span>
                <span className="flex-1 font-black text-[10px] uppercase tracking-wide truncate min-h-[14px]">
                  {isBlankSheet && siswa?.kelas === 'CONTOH' ? '' : siswa?.kelas || ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 py-1 border-b border-dotted border-slate-400">
              <span className="font-bold w-[112px] shrink-0 tracking-wide text-[8.5px] text-slate-700">
                MATA PELAJARAN
              </span>
              <span className="font-bold">:</span>
              <span className="flex-1 font-black text-[10px] uppercase tracking-wide truncate min-h-[14px]">
                {mapel}
              </span>
            </div>
          </div>

          {/* Baris Tanggal & Tanda Tangan Peserta */}
          <div className="grid grid-cols-2 gap-5 pt-1.5 text-[8.2px]">
            <div className="flex items-end gap-1.5">
              <span className="font-bold text-slate-700 shrink-0">TANGGAL :</span>
              <span className="flex-1 border-b border-black font-bold text-[8.8px] pb-[1px] min-h-[13px] truncate">
                {examDate || ''}
              </span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="font-bold text-slate-700 shrink-0">TANDA TANGAN :</span>
              <span className="flex-1 border-b border-black min-h-[13px]" />
            </div>
          </div>
        </div>

        {/* ── 4. PANDUAN VISUAL SINGKAT (y: 180..338, x: 640..956) ── */}
        <div
          style={boxStyle(640, 180, 316, 158)}
          className="border-[1.5px] border-black rounded-md px-3 py-2 bg-slate-50/70 flex flex-col justify-between"
        >
          <div className="font-black uppercase text-[7.8px] tracking-[0.14em] text-center border-b border-slate-300 pb-1 text-slate-800">
            CARA PENGISIAN JAWABAN
          </div>

          {/* Contoh Visual Cara Menandai */}
          <div className="grid grid-cols-3 gap-1.5 text-center text-[6.8px] font-bold my-auto py-0.5">
            <div className="border border-slate-300 rounded bg-white py-1.5 px-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-3 h-3 rounded-full border-[1.5px] border-black bg-black inline-block" />
                <span className="w-3 h-3 rounded-full border-[1.5px] border-black bg-white inline-flex items-center justify-center text-[8.5px] font-black leading-none">
                  ×
                </span>
              </div>
              <span className="text-black font-black tracking-wide">BENAR</span>
            </div>
            <div className="border border-slate-300 rounded bg-white py-1.5 px-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-3 h-3 rounded-full border-[1.5px] border-black bg-white inline-flex items-center justify-center text-[7px] leading-none">
                  ✓
                </span>
                <span className="w-3 h-3 rounded-full border-[1.5px] border-black bg-slate-300 inline-block" />
              </div>
              <span className="text-slate-600 font-black tracking-wide">SALAH</span>
            </div>
            <div className="border border-slate-300 rounded bg-white py-1.5 px-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-3 h-3 rounded-full border-[1.5px] border-black bg-white inline-flex items-center justify-center text-[8.5px] font-black leading-none">
                  =
                </span>
              </div>
              <span className="text-slate-600 font-black tracking-wide">BATAL</span>
            </div>
          </div>

          <div className="text-[7px] text-slate-700 leading-[1.3] border-t border-slate-300 pt-1 space-y-0.5">
            <div>• Gunakan <b>pensil 2B</b> atau <b>pena hitam</b> (jangan keluar garis).</div>
            <div>• <b>Bulatan (○)</b>: 1 pilihan &nbsp;|&nbsp; <b>Kotak (□)</b>: Boleh &gt;1 pilihan.</div>
          </div>
        </div>

        {/* ── 5. HEADER BAR LEMBAR JAWABAN (y: 346..376) ── */}
        <div
          style={boxStyle(44, 346, 912, 30)}
          className="flex items-center justify-between border-[1.5px] border-b-0 border-black rounded-t-md px-4 bg-slate-100"
        >
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-black">
            LEMBAR JAWABAN
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-700">
            {essayQuestions.length > 0 && essayLayoutMode === 'separate_manual'
              ? `${totalSoal - essayQuestions.length} OBJEKTIF · ${essayQuestions.length} URAIAN (LEMBAR TERPISAH)`
              : essayQuestions.length > 0 && essayLayoutMode === 'second_page'
                ? `HAL 1: ${totalSoal - essayQuestions.length} OBJEKTIF · HAL 2: ${essayQuestions.length} URAIAN`
                : `${totalSoal} BUTIR SOAL`}
          </span>
        </div>

        {/* ── 6. AREA JAWABAN UTAMA OMR / AI (y: 376..1248 — Adaptif Elastis) ── */}
        <div
          style={boxStyle(
            machineLayout.objectiveArea.x,
            machineLayout.objectiveArea.y,
            machineLayout.objectiveArea.w,
            machineLayout.objectiveArea.h
          )}
          className="border-[1.5px] border-black rounded-b-md bg-white overflow-hidden"
        >
          {/* Garis vertikal pembatas antar kolom */}
          {columnDividers.map((leftPct, i) => (
            <div
              key={i}
              className="absolute top-3 bottom-3 border-l border-dashed border-slate-200 pointer-events-none"
              style={{ left: `${leftPct}%` }}
            />
          ))}

          {machineLayout.questions.map((question) => (
            <MachineQuestionBlock
              key={question.no}
              question={question}
              areaX={machineLayout.objectiveArea.x}
              areaY={machineLayout.objectiveArea.y}
              areaW={machineLayout.objectiveArea.w}
              areaH={machineLayout.objectiveArea.h}
              density={machineLayout.density}
              showSensorGrid={showSensorGrid}
            />
          ))}
        </div>

        {/* ── 7. AREA JAWABAN URAIAN / ESAI (Jika ada soal esai & mode integrated) ── */}
        {machineLayout.essayArea && (
          <div
            style={boxStyle(
              machineLayout.essayArea.x,
              machineLayout.essayArea.y,
              machineLayout.essayArea.w,
              machineLayout.essayArea.h
            )}
            className="border-[1.5px] border-black px-3.5 py-2 rounded-md bg-white overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-center justify-between border-b border-black pb-1 mb-1">
              <span className="text-[8.5px] font-black uppercase tracking-[0.14em]">
                JAWABAN URAIAN / ESAI
              </span>
              <span className="text-[7px] font-bold text-slate-600 uppercase tracking-wider">
                Tulis jawaban dengan jelas di dalam garis • Kolom kanan untuk skor guru
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-around gap-1.5">
              {essayQuestions.map((question: any) => (
                <div key={question.no} className="flex items-start gap-2.5">
                  <div className="px-2 py-0.5 rounded border border-black bg-slate-100 text-[8.5px] font-black shrink-0 mt-0.5">
                    {question.no}.
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {Array.from({ length: essayLineCount }).map((_, lineIndex) => (
                      <div
                        key={lineIndex}
                        className="w-full h-[14px] border-b border-dotted border-slate-400"
                      />
                    ))}
                  </div>
                  <div className="px-1.5 py-0.5 rounded border border-dashed border-slate-400 text-[7px] font-mono font-bold text-slate-600 shrink-0 mt-0.5">
                    Skor: ___/{question.poin || 8}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 8. FOOTER MINIMALIS & PENGAWAS (y: 1264..1384, x: 44..790) ── */}
        <div
          style={boxStyle(44, 1264, 746, 120)}
          className="border-[1.5px] border-black rounded-md bg-white px-4 py-2.5 flex items-center justify-between gap-4 text-[7.8px] text-slate-800"
        >
          {/* Ringkasan Identitas Lembar */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-black text-black uppercase text-[8.5px] truncate">
              {isBlankSheet ? 'LEMBAR CADANGAN' : siswa?.nama || '-'}
              {!isBlankSheet && siswa?.nis ? ` (${siswa.nis})` : ''}
            </div>
            <div className="text-slate-600 font-semibold truncate">
              {siswa?.kelas || '-'} &nbsp;•&nbsp; {mapel}
            </div>
            <div className="text-[7px] font-mono text-slate-500 pt-0.5">
              KODE: {idKunci || 'STD'} &nbsp;•&nbsp; HAL {pageIndex + 1}/{totalPages}
            </div>
          </div>

          {/* Kehadiran Peserta */}
          <div className="border-l border-slate-300 pl-4 py-1 shrink-0">
            <div className="text-[6.8px] font-black uppercase tracking-wider text-slate-600 mb-2">
              KEHADIRAN PESERTA
            </div>
            <div className="flex items-center gap-3 font-bold text-black text-[7.5px]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-black inline-block bg-white" /> Hadir
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-black inline-block bg-white" /> Izin/Sakit
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-black inline-block bg-white" /> Alpa
              </span>
            </div>
          </div>

          {/* Paraf Pengawas */}
          <div className="border-l border-slate-300 pl-4 py-1 w-[130px] shrink-0 flex flex-col justify-between h-[64px]">
            <div className="text-[6.8px] font-black uppercase tracking-wider text-slate-600">
              PARAF PENGAWAS
            </div>
            <div className="border-b border-black w-full" />
          </div>
        </div>

        {/* ── 9. QR CODE ANCHOR (Koordinat Tetap x: 806, y: 1264, w: 142, h: 120) ── */}
        <div
          style={boxStyle(806, 1264, 142, 120)}
          className="border-[1.5px] border-black rounded-md bg-white p-2 text-center flex flex-col items-center justify-center gap-1"
        >
          <div className="inline-block border border-black p-[3px] bg-white">
            <QRCodeSVG value={qrPayload} size={86} level="M" />
          </div>
          <div className="text-[6.8px] text-black font-mono font-bold leading-none truncate max-w-full">
            {isBlankSheet ? 'BLANKO' : siswa?.nis || '-'}
          </div>
        </div>
      </div>
    </div>

    {/* ══════════════════════════════════════════════════════════════════
        HALAMAN 2 (OPSIONAL): LEMBAR LAMPIRAN JAWABAN URAIAN / ESAI LUAS
    ══════════════════════════════════════════════════════════════════ */}
    {essayLayoutMode === 'second_page' && essayQuestions.length > 0 && (
      <div className="w-[210mm] h-[297mm] bg-white text-black relative ljk-page box-border print:break-after-page last:print:break-after-auto shadow-2xl print:shadow-none shrink-0 mt-6 print:mt-0">
        <div className="relative w-full h-full border-[2px] border-black overflow-hidden bg-white">
          <FidMarker pos="top-left" />
          <FidMarker pos="top-right" />
          <FidMarker pos="bottom-left" />
          <FidMarker pos="bottom-right" />

          {/* Header Ringkas Lembar Lampiran Uraian */}
          <div style={boxStyle(44, 24, 912, 110)} className="border-[1.5px] border-black rounded-md bg-slate-50 px-5 py-3 flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">
                {sekolahBaris1} — {sekolahBaris2}
              </div>
              <div className="text-[13px] font-black uppercase tracking-tight text-black truncate">
                LEMBAR JAWABAN URAIAN / ESAI — {title}
              </div>
              <div className="text-[9px] font-bold text-slate-700 flex flex-wrap items-center gap-3 pt-0.5">
                <span>NAMA: <b className="text-black uppercase">{isBlankSheet ? '________________________' : siswa?.nama || '-'}</b></span>
                <span>•</span>
                <span>NIS: <b className="text-black font-mono">{isBlankSheet ? '________' : siswa?.nis || '-'}</b></span>
                <span>•</span>
                <span>KELAS: <b className="text-black">{siswa?.kelas || '-'}</b></span>
                <span>•</span>
                <span>MAPEL: <b className="text-black">{mapel}</b></span>
              </div>
            </div>
            <div className="border-[1.5px] border-black rounded bg-white px-4 py-2 text-center shrink-0">
              <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">TOTAL SKOR ESAI</div>
              <div className="text-[14px] font-black text-black mt-1 font-mono">
                ____ / {essayQuestions.reduce((acc: number, q: any) => acc + (Number(q.poin) || 8), 0)}
              </div>
            </div>
          </div>

          {/* Area Garis Jawaban Uraian Luas (y: 148..1248) */}
          <div
            style={boxStyle(44, 148, 912, 1100)}
            className="border-[1.5px] border-black rounded-md bg-white p-5 flex flex-col justify-between gap-3 overflow-hidden"
          >
            {essayQuestions.map((question: any) => (
              <div key={question.no} className="flex-1 flex flex-col justify-between border border-slate-300 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
                  <span className="px-2.5 py-0.5 rounded bg-black text-white text-[9.5px] font-black">
                    SOAL URAIAN NO. {question.no}
                  </span>
                  <span className="px-2.5 py-0.5 rounded border border-black bg-slate-100 text-[8.5px] font-mono font-black">
                    SKOR GURU: _____ / {question.poin || 8} POIN
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-around">
                  {Array.from({ length: secondPageLineCount }).map((_, lIdx) => (
                    <div key={lIdx} className="w-full h-[18px] border-b border-dotted border-slate-400" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer & QR Halaman 2 */}
          <div
            style={boxStyle(44, 1264, 746, 120)}
            className="border-[1.5px] border-black rounded-md bg-white px-4 py-2.5 flex items-center justify-between gap-4 text-[7.8px] text-slate-800"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="font-black text-black uppercase text-[8.5px] truncate">
                LAMPIRAN URAIAN: {isBlankSheet ? 'LEMBAR CADANGAN' : siswa?.nama || '-'}
              </div>
              <div className="text-slate-600 font-semibold truncate">
                Pastikan lembar lampiran ini disatukan dengan lembar LJK utama saat dikumpulkan.
              </div>
              <div className="text-[7px] font-mono text-slate-500 pt-0.5">
                KODE: {idKunci || 'STD'} &nbsp;•&nbsp; HALAMAN LAMPIRAN ESAI ({essayQuestions.length} SOAL)
              </div>
            </div>
            <div className="border-l border-slate-300 pl-4 py-1 w-[130px] shrink-0 flex flex-col justify-between h-[64px]">
              <div className="text-[6.8px] font-black uppercase tracking-wider text-slate-600">
                PARAF GURU / KOREKTOR
              </div>
              <div className="border-b border-black w-full" />
            </div>
          </div>

          <div
            style={boxStyle(806, 1264, 142, 120)}
            className="border-[1.5px] border-black rounded-md bg-white p-2 text-center flex flex-col items-center justify-center gap-1"
          >
            <div className="inline-block border border-black p-[3px] bg-white">
              <QRCodeSVG value={qrPayload} size={86} level="M" />
            </div>
            <div className="text-[6.8px] text-black font-mono font-bold leading-none truncate max-w-full">
              {isBlankSheet ? 'BLANKO-ESAI' : `${siswa?.nis || '-'}-ESAI`}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
