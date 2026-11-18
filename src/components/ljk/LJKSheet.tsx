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
    return <div className="w-[70px] h-[70px]" />;
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
      className="max-w-[70px] max-h-[70px] w-auto h-auto object-contain select-none"
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
  const showTypeHint =
    question.type &&
    question.type !== 'single_choice' &&
    question.type !== 'single_choice_4';

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
            ? 'flex-col items-start justify-start pl-1.5 pt-2'
            : 'items-center justify-start pl-1 pr-1 gap-1'
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

      {/* Soal Isian Singkat (Area Kosong Terbuka / Open Write-in Box) */}
      {question.type === 'short_answer' ? (
        question.answerBox ? (
          <div
            data-scan-question={question.no}
            data-scan-type="short_answer"
            className="absolute border-[1.4px] border-black rounded-[3px] bg-white flex items-end px-2 pb-[3px]"
            style={{
              left: toPercent(question.answerBox.x - question.x, question.w),
              top: toPercent(question.answerBox.y - question.y, question.h),
              width: toPercent(question.answerBox.w, question.w),
              height: toPercent(question.answerBox.h, question.h),
            }}
          >
            <div className="w-full border-b border-dotted border-slate-400" />
            {showSensorGrid && (
              <div className="print:hidden absolute inset-[8%] border border-dashed border-sky-500 bg-sky-500/15 pointer-events-none" />
            )}
          </div>
        ) : null
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

  // Hindari duplikasi kata semester jika judul ujian sudah mencantumkan Semester Ganjil/Genap
  const titleAlreadyHasSemester = /SEMESTER\s+(GANJIL|GENAP|1|2|I|II)/i.test(title || '');
  const bannerSubtitle = titleAlreadyHasSemester
    ? `${title} • TA ${tahunAjaran}`
    : `${title} • TA ${tahunAjaran} (${semester})`;

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

  // Hitung jumlah garis tulis per soal esai secara adaptif agar pas dengan tinggi essayArea
  const integratedEssayLines = useMemo(() => {
    if (!machineLayout.essayArea || essayQuestions.length === 0) return 2;
    const perQuestionUnits = (machineLayout.essayArea.h - 30) / essayQuestions.length;
    if (perQuestionUnits >= 95) return 4;
    if (perQuestionUnits >= 66) return 3;
    if (perQuestionUnits >= 44) return 2;
    return 1;
  }, [machineLayout.essayArea, essayQuestions.length]);

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

          {/* ── 1. KOP SURAT SEKOLAH (y: 14..112, x: 44..956) ── */}
          <div style={boxStyle(44, 14, 912, 98)} className="border-b-[2px] border-black">
            <div className="h-full px-2 flex items-center justify-between gap-3">
              <div className="w-[70px] h-[70px] flex items-center justify-center shrink-0">
                <SchoolLogo
                  src={logoKiri}
                  defaultSrc={withBasePath('/logo/logo_advent.png')}
                  alt="Logo Yayasan"
                />
              </div>

              <div className="flex-1 text-center flex flex-col items-center justify-center min-w-0">
                <div className="text-[8.2px] font-bold uppercase tracking-[0.16em] text-slate-800 leading-none truncate max-w-full">
                  {namaYayasan}
                </div>
                <div className="mt-1 text-[12.5px] font-black uppercase tracking-[0.05em] text-black leading-none truncate max-w-full">
                  {sekolahBaris1}
                </div>
                <div className="mt-1 text-[18px] font-black uppercase tracking-[0.04em] text-black leading-none truncate max-w-full">
                  {sekolahBaris2}
                </div>
                <div className="mt-1 text-[7.5px] font-medium italic text-slate-700 leading-tight truncate max-w-[640px]">
                  {alamat}
                </div>
              </div>

              <div className="w-[70px] h-[70px] flex items-center justify-center shrink-0">
                <SchoolLogo
                  src={logoKanan}
                  defaultSrc={withBasePath('/logo/tut_wuri.png')}
                  alt="Logo Sekolah"
                />
              </div>
            </div>
          </div>

          {/* ── 2. BANNER DUA BARIS LJK (y: 118..160) ── */}
          <div
            style={boxStyle(44, 118, 912, 42)}
            className="border-[1.5px] border-black bg-slate-900 text-white rounded-md px-4 flex flex-col items-center justify-center text-center gap-0.5"
          >
            <div className="text-[10.5px] font-black uppercase tracking-[0.2em] leading-none">
              LEMBAR JAWABAN KOMPUTER (LJK)
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-slate-200 leading-none truncate max-w-full">
              {bannerSubtitle}
            </div>
          </div>

          {/* ── 3A. KOTAK IDENTITAS PESERTA (y: 166..304, x: 44..568) ── */}
          <div
            style={boxStyle(44, 166, 524, 138)}
            className="border-[1.5px] border-black rounded-md bg-white px-3.5 py-2 flex flex-col justify-between"
          >
            <div className="space-y-1 text-[9px]">
              <div className="flex items-center gap-2 py-0.5 border-b border-dotted border-slate-400">
                <span className="font-bold w-[102px] shrink-0 tracking-wide text-[8px] text-slate-700">
                  NAMA PESERTA
                </span>
                <span className="font-bold">:</span>
                <span className="flex-1 font-black text-[10.5px] uppercase tracking-wide truncate min-h-[14px]">
                  {isBlankSheet ? '' : siswa?.nama || ''}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2 py-0.5 border-b border-dotted border-slate-400">
                <div className="col-span-7 flex items-center gap-2 min-w-0">
                  <span className="font-bold w-[102px] shrink-0 tracking-wide text-[8px] text-slate-700">
                    NIS / NO. PESERTA
                  </span>
                  <span className="font-bold">:</span>
                  <span className="flex-1 font-black font-mono text-[10px] tracking-wider truncate min-h-[13px]">
                    {isBlankSheet ? '' : siswa?.nis || ''}
                  </span>
                </div>
                <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                  <span className="font-bold shrink-0 tracking-wide text-[8px] text-slate-700">
                    KELAS :
                  </span>
                  <span className="flex-1 font-black text-[9.5px] uppercase tracking-wide truncate min-h-[13px]">
                    {isBlankSheet && siswa?.kelas === 'CONTOH' ? '' : siswa?.kelas || ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 py-0.5 border-b border-dotted border-slate-400">
                <span className="font-bold w-[102px] shrink-0 tracking-wide text-[8px] text-slate-700">
                  MATA PELAJARAN
                </span>
                <span className="font-bold">:</span>
                <span className="flex-1 font-black text-[9.5px] uppercase tracking-wide truncate min-h-[13px]">
                  {mapel}
                </span>
              </div>
            </div>

            {/* Baris Tanggal & Tanda Tangan Peserta */}
            <div className="grid grid-cols-2 gap-4 pt-1 text-[8px]">
              <div className="flex items-end gap-1.5">
                <span className="font-bold text-slate-700 shrink-0">TANGGAL :</span>
                <span className="flex-1 border-b border-black font-bold text-[8.5px] pb-[1px] min-h-[12px] truncate">
                  {examDate || ''}
                </span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="font-bold text-slate-700 shrink-0">TANDA TANGAN :</span>
                <span className="flex-1 border-b border-black min-h-[12px]" />
              </div>
            </div>
          </div>

          {/* ── 3B. PETUNJUK PENGISIAN & KODE KUNCI (y: 166..304, x: 576..806) ── */}
          <div
            style={boxStyle(576, 166, 230, 138)}
            className="border-[1.5px] border-black rounded-md px-2.5 py-1.5 bg-slate-50/70 flex flex-col justify-between"
          >
            <div className="font-black uppercase text-[7.2px] tracking-[0.12em] text-center border-b border-slate-300 pb-0.5 text-slate-800">
              CARA PENGISIAN JAWABAN
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-[6.4px] font-bold my-auto py-0.5">
              <div className="border border-slate-300 rounded bg-white py-1 px-0.5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full border-[1.4px] border-black bg-black inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full border-[1.4px] border-black bg-white inline-flex items-center justify-center text-[7.5px] font-black leading-none">
                    ×
                  </span>
                </div>
                <span className="text-black font-black">BENAR</span>
              </div>
              <div className="border border-slate-300 rounded bg-white py-1 px-0.5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full border-[1.4px] border-black bg-white inline-flex items-center justify-center text-[6.5px] leading-none">
                    ✓
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full border-[1.4px] border-black bg-slate-300 inline-block" />
                </div>
                <span className="text-slate-600 font-black">SALAH</span>
              </div>
              <div className="border border-slate-300 rounded bg-white py-1 px-0.5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full border-[1.4px] border-black bg-black text-white inline-flex items-center justify-center text-[7.5px] font-black leading-none">
                    =
                  </span>
                </div>
                <span className="text-slate-600 font-black">BATAL</span>
              </div>
            </div>

            <div className="text-[6.4px] text-slate-700 leading-[1.25] border-t border-slate-300 pt-1 space-y-0.5">
              <div>• <b>Pensil 2B / pena hitam</b> • ○: 1 opsi | □: &gt;1 opsi</div>
              <div className="font-mono font-bold text-[6.2px] text-slate-500 truncate">
                KODE: {idKunci || 'STD'} • HAL {pageIndex + 1}/{totalPages}
              </div>
            </div>
          </div>

          {/* ── 3C. QR CODE ANCHOR ATAS (y: 166..304, x: 814..956) ── */}
          <div
            style={boxStyle(814, 166, 142, 138)}
            className="border-[1.5px] border-black rounded-md bg-white p-1.5 text-center flex flex-col items-center justify-between"
          >
            <div className="inline-block border border-black p-[2px] bg-white my-auto">
              <QRCodeSVG value={qrPayload} size={80} level="M" />
            </div>
            <div className="text-[6.8px] text-black font-mono font-black leading-none truncate max-w-full pb-0.5">
              {isBlankSheet ? 'BLANKO' : `NIS: ${siswa?.nis || '-'}`}
            </div>
          </div>

          {/* ── 4. HEADER BAR LEMBAR JAWABAN (y: 310..338) ── */}
          <div
            style={boxStyle(44, 310, 912, 28)}
            className="flex items-center justify-between border-[1.5px] border-b-0 border-black rounded-t-md px-4 bg-slate-100"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-black">
              LEMBAR JAWABAN
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-700">
              {essayQuestions.length > 0 && essayLayoutMode === 'separate_manual'
                ? `${totalSoal - essayQuestions.length} OBJEKTIF/ISIAN · ${essayQuestions.length} URAIAN (LEMBAR TERPISAH)`
                : essayQuestions.length > 0 && essayLayoutMode === 'second_page'
                  ? `HAL 1: ${totalSoal - essayQuestions.length} OBJEKTIF/ISIAN · HAL 2: ${essayQuestions.length} URAIAN`
                  : essayQuestions.length > 0
                    ? `${totalSoal - essayQuestions.length} OBJEKTIF/ISIAN · ${essayQuestions.length} URAIAN (${totalSoal} SOAL)`
                    : `${totalSoal} BUTIR SOAL`}
            </span>
          </div>

          {/* ── 5. AREA JAWABAN UTAMA OMR / AI (y: 338..objectiveBottom — Seimbang & Presisi) ── */}
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
                className="absolute top-2.5 bottom-2.5 border-l border-dashed border-slate-200 pointer-events-none"
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

          {/* ── 6. AREA JAWABAN URAIAN / ESAI TERPADU (Proporsional & Anti-Terpotong) ── */}
          {machineLayout.essayArea && (
            <div
              style={boxStyle(
                machineLayout.essayArea.x,
                machineLayout.essayArea.y,
                machineLayout.essayArea.w,
                machineLayout.essayArea.h
              )}
              className="border-[1.5px] border-black px-3.5 py-1.5 rounded-md bg-white overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-black pb-1 mb-1 shrink-0">
                <span className="text-[8.5px] font-black uppercase tracking-[0.14em]">
                  JAWABAN URAIAN / ESAI ({essayQuestions.length} SOAL)
                </span>
                <span className="text-[6.8px] font-bold text-slate-600 uppercase tracking-wider">
                  Tulis jawaban dengan jelas di dalam kotak/garis • Kolom kanan untuk skor guru
                </span>
              </div>
              <div className="flex-1 min-h-0 flex flex-col gap-1">
                {essayQuestions.map((question: any) => (
                  <div
                    key={question.no}
                    data-scan-question={question.no}
                    data-scan-type="essay"
                    className="flex-1 min-h-0 flex items-stretch gap-2.5 border border-slate-300/90 rounded px-2 py-1 bg-white"
                  >
                    <div className="px-2 py-0.5 rounded border border-black bg-slate-100 text-[8.5px] font-black shrink-0 self-start">
                      {question.no}.
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col justify-evenly">
                      {Array.from({ length: integratedEssayLines }).map((_, lineIndex) => (
                        <div
                          key={lineIndex}
                          className="w-full border-b border-dotted border-slate-400"
                        />
                      ))}
                    </div>
                    <div className="px-1.5 py-0.5 rounded border border-dashed border-slate-400 text-[6.8px] font-mono font-bold text-slate-600 shrink-0 self-start">
                      Skor: ___/{question.poin || 8}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

            {/* Header Ringkas Lembar Lampiran Uraian + QR Code Atas (y: 20..144) */}
            <div
              style={boxStyle(44, 20, 912, 124)}
              className="border-[1.5px] border-black rounded-md bg-slate-50 px-4 py-2.5 flex items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-600 truncate">
                  {sekolahBaris1} — {sekolahBaris2}
                </div>
                <div className="text-[12.5px] font-black uppercase tracking-tight text-black truncate">
                  LEMBAR JAWABAN URAIAN / ESAI — {title}
                </div>
                <div className="text-[8.8px] font-bold text-slate-700 flex flex-wrap items-center gap-2.5 pt-0.5">
                  <span>
                    NAMA: <b className="text-black uppercase">{isBlankSheet ? '________________________' : siswa?.nama || '-'}</b>
                  </span>
                  <span>•</span>
                  <span>
                    NIS: <b className="text-black font-mono">{isBlankSheet ? '________' : siswa?.nis || '-'}</b>
                  </span>
                  <span>•</span>
                  <span>
                    KELAS: <b className="text-black">{siswa?.kelas || '-'}</b>
                  </span>
                  <span>•</span>
                  <span>
                    MAPEL: <b className="text-black">{mapel}</b>
                  </span>
                </div>
                <div className="text-[7px] font-mono text-slate-500">
                  KODE: {idKunci || 'STD'} • LAMPIRAN URAIAN ({essayQuestions.length} SOAL) • HAL {pageIndex + 1}/{totalPages}
                </div>
              </div>

              <div className="border-[1.5px] border-black rounded bg-white px-3.5 py-2 text-center shrink-0">
                <div className="text-[6.8px] font-black uppercase tracking-wider text-slate-500">TOTAL SKOR ESAI</div>
                <div className="text-[13px] font-black text-black mt-1 font-mono">
                  ____ / {essayQuestions.reduce((acc: number, q: any) => acc + (Number(q.poin) || 8), 0)}
                </div>
              </div>

              <div className="border-[1.5px] border-black rounded bg-white p-1.5 text-center flex flex-col items-center justify-center shrink-0">
                <div className="inline-block border border-black p-[2px] bg-white">
                  <QRCodeSVG value={qrPayload} size={78} level="M" />
                </div>
                <div className="text-[6.2px] text-black font-mono font-bold leading-none mt-0.5">
                  {isBlankSheet ? 'BLANKO-ESAI' : `${siswa?.nis || '-'}-ESAI`}
                </div>
              </div>
            </div>

            {/* Area Garis Jawaban Uraian Luas Penuh (y: 152..1380) */}
            <div
              style={boxStyle(44, 152, 912, 1228)}
              className="border-[1.5px] border-black rounded-md bg-white p-4 flex flex-col justify-between gap-2.5 overflow-hidden"
            >
              {essayQuestions.map((question: any) => (
                <div
                  key={question.no}
                  className="flex-1 min-h-0 flex flex-col justify-between border border-slate-300 rounded-md p-3 bg-white"
                >
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-1.5 shrink-0">
                    <span className="px-2.5 py-0.5 rounded bg-black text-white text-[9.5px] font-black">
                      SOAL URAIAN NO. {question.no}
                    </span>
                    <span className="px-2.5 py-0.5 rounded border border-black bg-slate-100 text-[8.5px] font-mono font-black">
                      SKOR GURU: _____ / {question.poin || 8} POIN
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col justify-evenly">
                    {Array.from({ length: secondPageLineCount }).map((_, lIdx) => (
                      <div key={lIdx} className="w-full border-b border-dotted border-slate-400" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
