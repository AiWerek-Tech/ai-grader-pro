'use client';

import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { withBasePath } from '@/lib/base-path';
import { buildImageFallbackCandidates } from '@/lib/utils';
import {
  buildClassAbsenMap,
  CardThemePalette,
  groupScheduleRowsByDay,
  KartuPesertaConfig,
  KartuScheduleDayGroup,
  KartuStudentItem,
  KartuStudentOverride,
  normalizePortalBaseUrl,
  resolveParticipantMeta,
  splitDayGroupsBalanced,
} from '@/lib/kartu-peserta-utils';
import {
  extractStudentScheduleFromMaster,
  JadwalUjianUnitConfig,
} from '@/lib/jadwal-ujian-utils';

function KartuImage({
  src,
  defaultSrc = '',
  alt,
  style,
  className,
  fallbackNode,
}: {
  src?: string;
  defaultSrc?: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  fallbackNode?: React.ReactNode;
}) {
  const candidates = useMemo(
    () => buildImageFallbackCandidates(src, defaultSrc),
    [src, defaultSrc]
  );
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [prevKey, setPrevKey] = useState(`${src || ''}|${defaultSrc}`);

  const currentKey = `${src || ''}|${defaultSrc}`;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setCandidateIdx(0);
  }

  const activeUrl = candidates[candidateIdx] || '';

  if (!activeUrl) {
    return <>{fallbackNode ?? null}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        setCandidateIdx((idx) => idx + 1);
      }}
      style={style}
      className={className}
    />
  );
}

function KartuLogo({
  src,
  defaultSrc,
  alt,
  sizePx,
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
  sizePx: number;
}) {
  return (
    <KartuImage
      src={src}
      defaultSrc={defaultSrc}
      alt={alt}
      style={{ maxWidth: sizePx, maxHeight: sizePx }}
      className="w-auto h-auto object-contain mix-blend-multiply select-none shrink-0 relative z-10"
      fallbackNode={<div style={{ width: sizePx, height: sizePx }} className="shrink-0" />}
    />
  );
}

/**
 * Siluet vektor Pegunungan Wamena / Jayawijaya untuk latar header & gelombang bawah kartu
 */
function TopMountainBackdrop({ theme }: { theme: CardThemePalette }) {
  return (
    <svg
      viewBox="0 0 400 72"
      preserveAspectRatio="none"
      className="absolute inset-x-0 top-0 w-full h-[54px] pointer-events-none select-none opacity-65"
      aria-hidden="true"
    >
      <path
        d="M0,72 L0,52 L45,28 L88,46 L142,16 L195,44 L250,18 L302,42 L352,22 L400,45 L400,72 Z"
        fill={theme.mountainFillTop}
      />
      <path
        d="M0,72 L0,58 L62,38 L112,56 L170,29 L225,52 L288,30 L345,54 L400,36 L400,72 Z"
        fill={theme.mountainFillBack}
        opacity="0.4"
      />
    </svg>
  );
}

function BottomMountainWaveFront({ theme }: { theme: CardThemePalette }) {
  return (
    <svg
      viewBox="0 0 400 44"
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 w-full h-[24px] pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Siluet puncak lembut di sebelah kiri */}
      <path
        d="M0,44 L0,16 L34,5 L72,17 L115,6 L154,36 L400,41.5 L400,44 Z"
        fill={theme.mountainFillBack}
        opacity="0.32"
      />
      {/* Pita kiri untuk badge unit, turun cepat lalu menipis rata di dasar sisi kanan agar bebas tabrakan teks */}
      <path
        d="M0,17 L94,17 C124,17 136,41 162,41.2 L400,41.5 L400,44 L0,44 Z"
        fill={theme.primaryDark}
      />
      <path
        d="M0,23 L90,23 C121,23 135,42 162,42.3 L400,42.5 L400,44 L0,44 Z"
        fill={theme.mountainFillBottom}
        opacity="0.88"
      />
      {/* Garis aksen emas berjalan rata di tepi pita */}
      <path
        d="M0,16.5 L94,16.5 C124,16.5 136,40.5 162,40.7 L400,41"
        fill="none"
        stroke={theme.goldAccent}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function BottomMountainWave({ theme }: { theme: CardThemePalette }) {
  return (
    <svg
      viewBox="0 0 400 46"
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 w-full h-[34px] pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Back misty mountain range */}
      <path
        d="M0,46 L0,28 L42,14 L85,27 L135,10 L185,26 L236,15 L292,29 L350,12 L400,26 L400,46 Z"
        fill={theme.mountainFillBack}
        opacity="0.5"
      />
      {/* Main solid curved wave */}
      <path
        d="M0,26 Q115,44 230,30 T400,18 L400,46 L0,46 Z"
        fill={theme.primaryDark}
      />
      {/* Accent second ribbon */}
      <path
        d="M0,33 Q140,46 280,29 T400,25 L400,46 L0,46 Z"
        fill={theme.mountainFillBottom}
        opacity="0.85"
      />
      {/* Gold swoosh trim */}
      <path
        d="M0,25 Q115,43 230,29 T400,17"
        fill="none"
        stroke={theme.goldAccent}
        strokeWidth="1.8"
      />
    </svg>
  );
}

interface CardSharedProps {
  student: KartuStudentItem;
  indexInSelection: number;
  config: KartuPesertaConfig;
  overrides: Record<string, KartuStudentOverride>;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
  classAbsenMap?: Record<string, number>;
  portalUrl?: string;
  jadwalMaster?: { SMP?: JadwalUjianUnitConfig; SMA?: JadwalUjianUnitConfig };
}

/**
 * SISI DEPAN KARTU (Desain Landscape Formal Minimalis Gambar 1 & Gambar 4)
 */
export function KartuPesertaFrontCard({
  student,
  indexInSelection,
  config,
  overrides,
  settings,
  academicSession,
  classAbsenMap = {},
  portalUrl,
}: CardSharedProps) {
  const isSpacious = config.rowsPerPage === 3;
  const prefix = student.jenjang === 'SMP' ? 'smp_' : 'sma_';

  const yayasanName =
    config.kopYayasan?.trim() ||
    settings['nama_yayasan'] ||
    'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const akademiName =
    config.kopAkademi?.trim() ||
    settings[prefix + 'nama_sekolah_1'] ||
    settings['nama_sekolah_1'] ||
    'Wamena Mountain View Adventist Academy';
  const sekolahName =
    config.kopNamaSekolah?.trim() ||
    settings[prefix + 'nama_sekolah_2'] ||
    settings['nama_sekolah_2'] ||
    (student.jenjang === 'SMP' ? 'SMP Advent Sogokmo' : 'SMA Advent Sogokmo');
  const alamatSekolah =
    config.kopAlamat?.trim() ||
    settings['alamat_sekolah'] ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';

  const npsn =
    student.jenjang === 'SMP'
      ? settings['smp_npsn'] || ''
      : settings['sma_npsn'] || '';
  const kotaSekolah = config.kotaCetak?.trim() || settings['kota_sekolah'] || 'Wamena';

  const logoKiri = settings[prefix + 'logo_kiri_url'] || settings['logo_kiri_url'];
  const logoKanan = settings[prefix + 'logo_kanan_url'] || settings['logo_kanan_url'];

  const signerTitle =
    config.signerMode === 'KEPALA' ? 'Kepala Sekolah,' : 'Ketua Panitia Ujian,';
  const signerName =
    config.signerMode === 'KEPALA'
      ? settings[prefix + 'kepala_nama'] || settings['kepala_nama'] || ''
      : settings[prefix + 'panitia_nama'] || settings['panitia_nama'] || '';
  const signerNip =
    config.signerMode === 'KEPALA'
      ? settings[prefix + 'kepala_nip'] || settings['kepala_nip'] || ''
      : settings[prefix + 'panitia_nip'] || settings['panitia_nip'] || '';
  const signerTtdUrl =
    config.signerMode === 'KEPALA'
      ? settings[prefix + 'kepala_ttd_url'] || settings['kepala_ttd_url'] || ''
      : settings[prefix + 'panitia_ttd_url'] || settings['panitia_ttd_url'] || '';

  const meta = resolveParticipantMeta(
    student,
    indexInSelection,
    config,
    overrides,
    classAbsenMap,
    settings,
    academicSession,
    portalUrl
  );
  const { theme } = meta;

  const cardHeightMm = isSpacious ? '86mm' : '64mm';
  const logoSize = isSpacious ? 39 : 31;
  const qrSize = isSpacious ? 98 : 78;

  return (
    <div
      className="relative bg-white text-slate-900 rounded-[8px] overflow-hidden flex flex-col justify-between box-border select-none"
      style={{
        height: cardHeightMm,
        border: `1.2px solid ${theme.primaryDark}`,
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      }}
    >
      {/* 1. HEADER KOP + SILUET PEGUNUNGAN */}
      <div
        className={`relative flex items-center justify-between gap-1.5 ${
          isSpacious ? 'px-3 pt-2 pb-2' : 'px-2.5 pt-1.5 pb-1.5'
        } shrink-0 overflow-hidden bg-white`}
      >
        <TopMountainBackdrop theme={theme} />

        <KartuLogo
          src={logoKiri}
          defaultSrc={withBasePath('/logo/logo_advent.png')}
          alt="Logo Sekolah"
          sizePx={logoSize}
        />

        <div className="flex-1 text-center min-w-0 relative z-10 leading-[1.12] px-0.5">
          <div
            className={`${
              isSpacious ? 'text-[6.8px]' : 'text-[5.2px]'
            } font-extrabold uppercase tracking-[0.06em] text-slate-600 truncate`}
          >
            {yayasanName}
          </div>
          <div
            className={`${
              isSpacious ? 'text-[8.8px]' : 'text-[6.8px]'
            } font-black uppercase tracking-tight truncate mt-[0.5px]`}
            style={{ color: theme.primaryDark }}
          >
            {akademiName}
          </div>
          <div
            className={`${
              isSpacious ? 'text-[10.8px]' : 'text-[8.4px]'
            } font-black uppercase tracking-tight truncate`}
            style={{ color: theme.primaryDark }}
          >
            {sekolahName}
          </div>
          <div
            className={`${
              isSpacious ? 'text-[6.2px]' : 'text-[5px]'
            } font-semibold text-slate-700 truncate mt-[0.5px]`}
          >
            {alamatSekolah}
            {npsn ? ` • NPSN: ${npsn}` : ''}
          </div>
        </div>

        <KartuLogo
          src={logoKanan}
          defaultSrc={withBasePath('/logo/tut_wuri.png')}
          alt="Logo Kemendikbud"
          sizePx={logoSize}
        />
      </div>

      {/* 2. BANNER GELAP KARTU PESERTA ASESMEN */}
      <div
        className={`w-full text-center font-black uppercase tracking-[0.1em] text-white shrink-0 ${
          isSpacious ? 'py-[4px] text-[10px]' : 'py-[2.5px] text-[8.2px]'
        }`}
        style={{
          backgroundColor: theme.primaryDark,
          borderBottom: `1.5px solid ${theme.goldAccent}`,
        }}
      >
        KARTU PESERTA ASESMEN
      </div>

      {/* 3. SUBHEADER PILL JENIS ASESMEN & TAHUN AJARAN */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 shrink-0 ${
          isSpacious ? 'px-3 py-1.5' : 'px-2.5 py-[3px]'
        }`}
      >
        <div
          className={`rounded-full font-extrabold truncate max-w-[54%] ${
            isSpacious ? 'px-2.5 py-0.5 text-[8px]' : 'px-2 py-[2px] text-[6.8px]'
          }`}
          style={{
            backgroundColor: theme.pillBg,
            border: `1px solid ${theme.pillBorder}`,
            color: theme.pillText,
          }}
        >
          {config.judulUjian}
        </div>
        <div className="h-4 w-[1px] bg-slate-300 shrink-0" />
        <div
          className={`flex-1 text-center font-bold text-slate-800 leading-[1.15] min-w-0 ${
            isSpacious ? 'text-[7.5px]' : 'text-[6.2px]'
          }`}
        >
          <div className="truncate">Tahun Ajaran {academicSession.tahunAjaran}</div>
          <div className="truncate text-slate-600">{config.kurikulumLabel}</div>
        </div>
      </div>

      {/* 4. BADAN IDENTITAS + QR CODE + TANDA TANGAN (Proporsional & Tanpa Ruang Kosong) */}
      <div
        className={`relative flex-1 flex items-stretch min-h-0 ${
          isSpacious ? 'gap-3 px-3 pt-2 pb-2' : 'gap-2.5 px-2.5 pt-1.5 pb-1.5'
        }`}
      >
        <BottomMountainWaveFront theme={theme} />

        {/* Kolom Kiri: QR Code Besar + Pill No. Urut/Meja + Badge Unit */}
        <div
          className={`relative z-10 shrink-0 flex flex-col items-center justify-between pb-[1px] ${
            isSpacious ? 'w-[106px]' : 'w-[84px]'
          }`}
        >
          <div className="my-auto flex flex-col items-center">
            <div className="p-[5px] bg-white border-[1.2px] border-slate-300 rounded-[6px] shadow-xs">
              <QRCodeSVG
                value={meta.qrPayload}
                size={qrSize}
                level="L"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div
              className={`mt-[4px] rounded-full font-mono font-black tracking-tight leading-none ${
                isSpacious ? 'px-2.5 py-[3px] text-[7.5px]' : 'px-2 py-[2.5px] text-[6.2px]'
              }`}
              style={{
                backgroundColor: theme.pillBg,
                border: `1px solid ${theme.pillBorder}`,
                color: theme.pillText,
              }}
            >
              ABSEN {meta.noAbsen} • {config.portalEnabled && portalUrl ? 'SCAN QR' : 'AKTIF'}
            </div>
          </div>
          <div className="text-[5.8px] font-black uppercase tracking-wider text-white leading-none pt-0.5 self-start">
            {student.jenjang} • {kotaSekolah}
          </div>
        </div>

        {/* Kolom Kanan: Kartu Biodata Padat Rapi + Zona Pengesahan Berstempel Jelas */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-between pb-[5px]">
          <div
            className={`rounded-[6px] border border-slate-200/90 bg-slate-50/65 ${
              isSpacious ? 'px-2.5 py-1.5' : 'px-2 py-1'
            }`}
          >
            <table
              className={`w-full border-collapse ${
                isSpacious ? 'text-[9.2px] leading-[1.45]' : 'text-[7.8px] leading-[1.36]'
              }`}
            >
              <tbody className="divide-y divide-slate-200/60">
                <tr>
                  <td
                    className={`font-semibold text-slate-600 whitespace-nowrap align-middle py-[1.5px] ${
                      isSpacious ? 'w-[68px]' : 'w-[58px]'
                    }`}
                  >
                    No. Urut
                  </td>
                  <td className="font-semibold w-[8px] align-middle py-[1.5px]">:</td>
                  <td className="font-black text-slate-950 align-middle py-[1.5px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono">{meta.noAbsen}</span>
                      <span
                        className={`rounded font-mono font-extrabold ${
                          isSpacious ? 'px-1.5 py-[1px] text-[7.5px]' : 'px-1.5 py-[0.5px] text-[6.2px]'
                        }`}
                        style={{
                          backgroundColor: theme.pillBg,
                          color: theme.pillText,
                        }}
                      >
                        Meja {meta.meja}
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold text-slate-600 whitespace-nowrap align-middle py-[1.5px]">
                    Nama Peserta
                  </td>
                  <td className="font-semibold align-middle py-[1.5px]">:</td>
                  <td className="font-black text-slate-950 uppercase align-middle py-[1.5px]">
                    <div className="flex items-center gap-1 min-w-0">
                      {config.showInitialsBadge && (
                        <span
                          className="inline-flex items-center justify-center rounded-full font-black text-[6px] leading-none shrink-0"
                          style={{
                            width: isSpacious ? '16px' : '13px',
                            height: isSpacious ? '16px' : '13px',
                            background: meta.avatarColors.bg,
                            color: meta.avatarColors.text,
                          }}
                        >
                          {meta.initials}
                        </span>
                      )}
                      <span className="truncate">{student.nama}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold text-slate-600 whitespace-nowrap align-middle py-[1.5px]">
                    Kelas / NIS
                  </td>
                  <td className="font-semibold align-middle py-[1.5px]">:</td>
                  <td className="font-bold text-slate-900 align-middle py-[1.5px] truncate">
                    {student.nama_kelas}
                    {student.nis ? ` • NIS ${student.nis}` : ''}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold text-slate-600 whitespace-nowrap align-middle py-[1.5px]">
                    Nomor Peserta
                  </td>
                  <td className="font-semibold align-middle py-[1.5px]">:</td>
                  <td className="font-black font-mono text-slate-950 align-middle py-[1.5px] truncate">
                    {meta.noPeserta}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold text-slate-600 whitespace-nowrap align-middle py-[1.5px]">
                    Ruang Ujian
                  </td>
                  <td className="font-semibold align-middle py-[1.5px]">:</td>
                  <td className="font-extrabold text-slate-900 align-middle py-[1.5px] truncate">
                    {meta.ruang}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Baris Bawah Kolom Kanan: Zona Pengesahan Berstempel Jelas (bersih dari teks footer bertumpuk) */}
          <div className="flex items-end justify-end mt-auto pt-[2px]">
            <div
              className={`text-right leading-[1.12] pr-0.5 ${
                isSpacious ? 'text-[7.5px]' : 'text-[6.2px]'
              }`}
            >
              {config.tanggalCetak && (
                <div className="font-semibold text-slate-700 truncate max-w-[140px] ml-auto">
                  {kotaSekolah}, {config.tanggalCetak}
                </div>
              )}
              <div className="font-bold text-slate-900 relative z-10">{signerTitle}</div>
              {signerTtdUrl ? (
                <div
                  className={`flex items-center justify-end relative z-0 ${
                    isSpacious ? 'h-[40px] -my-[4px]' : 'h-[30px] -my-[4px]'
                  }`}
                >
                  <KartuImage
                    src={signerTtdUrl}
                    alt={`Tanda Tangan ${signerTitle}`}
                    style={{ maxHeight: isSpacious ? 48 : 36, maxWidth: isSpacious ? 124 : 98 }}
                    className="w-auto h-auto object-contain mix-blend-multiply select-none"
                    fallbackNode={<div className={isSpacious ? 'h-[20px]' : 'h-[14px]'} />}
                  />
                </div>
              ) : (
                <div className={isSpacious ? 'h-[22px]' : 'h-[15px]'} />
              )}
              <div className="font-black text-slate-950 underline underline-offset-2 relative z-10">
                {signerName || '( ............................ )'}
              </div>
              {signerNip && (
                <div className="text-[5.2px] font-mono text-slate-700 mt-[0.5px] relative z-10">
                  NIP/NRG. {signerNip}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SHORT_ID_MONTHS: Array<[RegExp, string]> = [
  [/\bJanuari\b/gi, 'Jan'],
  [/\bFebruari\b/gi, 'Feb'],
  [/\bMaret\b/gi, 'Mar'],
  [/\bApril\b/gi, 'Apr'],
  [/\bAgustus\b/gi, 'Agu'],
  [/\bSeptember\b/gi, 'Sep'],
  [/\bOktober\b/gi, 'Okt'],
  [/\bNovember\b/gi, 'Nov'],
  [/\bDesember\b/gi, 'Des'],
];

function formatDateForScheduleCell(dateLabel: string, compact: boolean): string {
  const clean = String(dateLabel || '').trim();
  if (!clean || !compact) return clean;
  let shortened = clean;
  for (const [pattern, abbr] of SHORT_ID_MONTHS) {
    shortened = shortened.replace(pattern, abbr);
  }
  return shortened;
}

function formatTimeForScheduleCell(waktu: string, compact: boolean): string {
  const clean = String(waktu || '').trim();
  if (!compact) return clean;
  return clean.replace(/\s*[–—-]\s*/g, '-');
}

function KartuScheduleGroupTable({
  groups,
  theme,
  compact,
  isSpacious,
  relaxedRows = false,
}: {
  groups: KartuScheduleDayGroup[];
  theme: CardThemePalette;
  compact: boolean;
  isSpacious: boolean;
  relaxedRows?: boolean;
}) {
  const textSizeClass = compact
    ? isSpacious
      ? relaxedRows
        ? 'text-[6.8px]'
        : 'text-[6px]'
      : relaxedRows
      ? 'text-[6px]'
      : 'text-[5.2px]'
    : isSpacious
    ? relaxedRows
      ? 'text-[8px]'
      : 'text-[7.4px]'
    : relaxedRows
    ? 'text-[7px]'
    : 'text-[6.3px]';

  const cellPadClass = compact
    ? relaxedRows
      ? isSpacious
        ? 'py-[3.6px] px-1'
        : 'py-[2.6px] px-[3px]'
      : 'py-[1.5px] px-[3px]'
    : relaxedRows
    ? isSpacious
      ? 'py-[4.2px] px-1.5'
      : 'py-[3.2px] px-1.5'
    : 'py-[2.4px] px-1.5';

  const noPadClass = compact
    ? relaxedRows
      ? isSpacious
        ? 'py-[3.6px] px-0'
        : 'py-[2.6px] px-0'
      : 'py-[1.5px] px-0'
    : relaxedRows
    ? isSpacious
      ? 'py-[4.2px] px-0.5'
      : 'py-[3.2px] px-0.5'
    : 'py-[2.4px] px-0.5';

  const jamPadClass = compact
    ? relaxedRows
      ? isSpacious
        ? 'py-[3.6px] px-0.5 tracking-tighter'
        : 'py-[2.6px] px-0.5 tracking-tighter'
      : 'py-[1.5px] px-0.5 tracking-tighter'
    : relaxedRows
    ? isSpacious
      ? 'py-[4.2px] px-1'
      : 'py-[3.2px] px-1'
    : 'py-[2.4px] px-1';

  const headPadClass = compact ? 'py-[2.5px] px-[3px]' : 'py-[3.2px] px-1.5';
  const dateFontClass = compact
    ? relaxedRows
      ? 'text-[5.2px] mt-[1.5px]'
      : 'text-[4.6px] mt-[1px]'
    : relaxedRows
    ? 'text-[6.2px] mt-[1.5px]'
    : 'text-[5.7px] mt-[1.5px]';

  return (
    <table className={`w-full table-fixed border-collapse border border-slate-300 ${textSizeClass}`}>
      <thead>
        <tr
          className="text-white font-extrabold"
          style={{ backgroundColor: theme.tableHeaderBg }}
        >
          <th className={`border border-slate-300 ${headPadClass} text-center w-[24.5%]`}>
            {compact ? 'Hari, Tgl' : 'Hari, Tanggal'}
          </th>
          <th
            className={`border border-slate-300 ${
              compact ? 'py-[2.5px] px-0' : 'py-[3.2px] px-0.5'
            } text-center w-[6.5%]`}
          >
            No
          </th>
          <th className={`border border-slate-300 ${headPadClass} text-left w-[45.5%]`}>
            {compact ? 'Mapel' : 'Mata Pelajaran'}
          </th>
          <th
            className={`border border-slate-300 ${
              compact ? 'py-[2.5px] px-0.5' : 'py-[3.2px] px-1'
            } text-center w-[23.5%]`}
          >
            {compact ? 'Jam' : 'Waktu'}
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, dayIdx) => {
          const dayBg = dayIdx % 2 === 1 ? theme.tableStripeBg : '#ffffff';
          const dateText = formatDateForScheduleCell(group.dateLabel, compact);

          return group.items.map((item, itemIdx) => (
            <tr
              key={item.id || `${group.key}-${itemIdx}`}
              style={{ backgroundColor: dayBg }}
            >
              {itemIdx === 0 && (
                <td
                  rowSpan={group.items.length}
                  className={`border border-slate-300 ${
                    compact ? 'px-[2px] py-[2px]' : 'px-1 py-[2.5px]'
                  } align-middle text-center leading-[1.15]`}
                >
                  <div className="font-extrabold text-slate-900 truncate">{group.dayName}</div>
                  {dateText && (
                    <div className={`font-semibold text-slate-600 truncate ${dateFontClass}`}>
                      {dateText}
                    </div>
                  )}
                </td>
              )}
              <td
                className={`border-x border-slate-200 ${
                  itemIdx === 0 && dayIdx > 0
                    ? 'border-t border-t-slate-300'
                    : 'border-t border-t-slate-200'
                } border-b border-b-slate-200 ${noPadClass} text-center font-mono font-extrabold text-slate-800`}
              >
                {item.noUrut}
              </td>
              <td
                className={`border-x border-slate-200 ${
                  itemIdx === 0 && dayIdx > 0
                    ? 'border-t border-t-slate-300'
                    : 'border-t border-t-slate-200'
                } border-b border-b-slate-200 ${cellPadClass} font-bold text-slate-950 ${
                  relaxedRows ? 'leading-[1.18]' : 'truncate'
                }`}
              >
                {relaxedRows ? (
                  <span className="line-clamp-2">{item.mapel}</span>
                ) : (
                  item.mapel
                )}
              </td>
              <td
                className={`border-x border-slate-200 border-r-slate-300 ${
                  itemIdx === 0 && dayIdx > 0
                    ? 'border-t border-t-slate-300'
                    : 'border-t border-t-slate-200'
                } border-b border-b-slate-200 ${jamPadClass} text-center font-mono font-bold text-slate-800 whitespace-nowrap`}
              >
                {formatTimeForScheduleCell(item.waktu, compact)}
              </td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}

/**
 * SISI BELAKANG KARTU: JADWAL ASESMEN (Desain Gambar 4 Kanan)
 */
export function KartuPesertaBackJadwalCard({
  student,
  indexInSelection,
  config,
  overrides,
  settings,
  academicSession,
  jadwalMaster,
}: CardSharedProps) {
  const isSpacious = config.rowsPerPage === 3;
  const prefix = student.jenjang === 'SMP' ? 'smp_' : 'sma_';

  const sekolah2 =
    config.kopNamaSekolah?.trim() ||
    settings[prefix + 'nama_sekolah_2'] ||
    settings['nama_sekolah_2'] ||
    (student.jenjang === 'SMP' ? 'SMP Advent Sogokmo' : 'SMA Advent Sogokmo');

  const meta = resolveParticipantMeta(student, indexInSelection, config, overrides);
  const { theme } = meta;

  const cardHeightMm = isSpacious ? '86mm' : '64mm';
  const maxSingleRows = isSpacious ? 7 : 5;

  const masterRows =
    config.jadwalSource !== 'CUSTOM' && jadwalMaster
      ? extractStudentScheduleFromMaster(student.nama_kelas, student.jenjang, jadwalMaster)
      : [];

  const allRows =
    masterRows.length > 0
      ? masterRows.map((r, i) => ({
          id: `master-${i}`,
          hariTanggal: r.hariTanggal,
          mapel: r.mapel,
          waktu: r.waktu,
        }))
      : config.jadwalRows || [];

  const useTwoColumns = allRows.length > maxSingleRows;
  const maxTwoColRows = isSpacious ? 18 : 16;
  const displayLimit = useTwoColumns ? maxTwoColRows : maxSingleRows;

  // Kelompokkan per hari terlebih dahulu agar jam terurut, lalu batasi kapasitas kartu
  // sebelum merender sel merge Hari/Tanggal + nomor urut per hari.
  const orderedAllRows = groupScheduleRowsByDay(allRows).flatMap((g) => g.items);
  const displayRows = orderedAllRows.slice(0, displayLimit);
  const displayGroups = groupScheduleRowsByDay(displayRows);
  const { leftGroups, rightGroups } = useTwoColumns
    ? splitDayGroupsBalanced(displayGroups)
    : { leftGroups: displayGroups, rightGroups: [] };

  const leftRowCount = leftGroups.reduce((acc, g) => acc + g.items.length, 0);
  const rightRowCount = rightGroups.reduce((acc, g) => acc + g.items.length, 0);
  const maxColRows = Math.max(leftRowCount, rightRowCount);
  const relaxedRows = useTwoColumns
    ? isSpacious
      ? maxColRows <= 7
      : maxColRows <= 6
    : isSpacious
    ? maxColRows <= 5
    : maxColRows <= 4;

  const shortJudul = config.judulUjian.split('(')[0]?.trim() || config.judulUjian;
  const footerSchoolLabel = sekolah2.toUpperCase().includes(student.jenjang)
    ? `${sekolah2} • WMVAA`
    : `${sekolah2} • ${student.jenjang} • WMVAA`;

  return (
    <div
      className="relative bg-white text-slate-900 rounded-[8px] overflow-hidden flex flex-col justify-between box-border select-none"
      style={{
        height: cardHeightMm,
        border: `1.2px solid ${theme.primaryDark}`,
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      }}
    >
      {/* Header Solid Banner + Aksen Emas */}
      <div
        className={`text-center text-white shrink-0 ${
          isSpacious ? 'py-1.5 px-3' : 'py-[4px] px-2.5'
        }`}
        style={{
          backgroundColor: theme.primaryDark,
          borderBottom: `2px solid ${theme.goldAccent}`,
        }}
      >
        <div
          className={`${
            isSpacious ? 'text-[10px]' : 'text-[8.2px]'
          } font-black uppercase tracking-[0.09em] leading-none`}
        >
          JADWAL ASESMEN
        </div>
        <div
          className={`${
            isSpacious ? 'text-[7.2px] mt-1' : 'text-[5.9px] mt-[3px]'
          } font-bold opacity-95 truncate leading-none`}
        >
          {shortJudul} • {student.nama_kelas} • {meta.ruang} • TA {academicSession.tahunAjaran}
        </div>
      </div>

      {/* Strip Identitas Singkat (memudahkan cocokkan sisi depan/belakang & cetak mandiri) */}
      <div
        className={`shrink-0 flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/90 ${
          isSpacious ? 'px-2.5 py-[3.5px] text-[6.8px]' : 'px-2 py-[2.5px] text-[5.8px]'
        }`}
      >
        <div className="truncate font-bold text-slate-800">
          <span className="text-slate-500 font-semibold">Peserta:</span>{' '}
          <span className="uppercase">{student.nama}</span>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {displayRows.length > 0 && (
            <span className="font-bold text-slate-600">{displayRows.length} Mapel</span>
          )}
          <span className="font-mono font-extrabold text-slate-900 bg-slate-200/75 px-1.5 py-[0.5px] rounded">
            {meta.noPeserta}
          </span>
        </div>
      </div>

      {/* Tabel Jadwal */}
      <div
        className={`flex-1 relative min-h-0 flex flex-col justify-between overflow-hidden ${
          isSpacious ? 'px-2.5 pt-1.5 pb-1' : 'px-2 pt-1.5 pb-1'
        }`}
      >
        {displayGroups.length === 0 ? (
          <div className="h-full flex items-center justify-center rounded-md border border-dashed border-slate-300 text-[6.5px] text-slate-400 italic">
            Belum ada jadwal asesmen untuk kelas {student.nama_kelas}.
          </div>
        ) : (
          <>
            {useTwoColumns ? (
              <div className="grid grid-cols-2 gap-1.5 items-start">
                <KartuScheduleGroupTable
                  groups={leftGroups}
                  theme={theme}
                  compact
                  isSpacious={isSpacious}
                  relaxedRows={relaxedRows}
                />
                <KartuScheduleGroupTable
                  groups={rightGroups}
                  theme={theme}
                  compact
                  isSpacious={isSpacious}
                  relaxedRows={relaxedRows}
                />
              </div>
            ) : (
              <KartuScheduleGroupTable
                groups={displayGroups}
                theme={theme}
                compact={false}
                isSpacious={isSpacious}
                relaxedRows={relaxedRows}
              />
            )}

            {relaxedRows && (
              <div
                className={`mt-auto rounded-[4px] border border-slate-200/90 bg-slate-50/90 text-slate-600 font-semibold text-center truncate ${
                  isSpacious ? 'px-2 py-[3px] text-[6px]' : 'px-1.5 py-[2px] text-[5.3px]'
                }`}
              >
                Catatan: Hadir 15 menit sebelum ujian • Bawa kartu peserta, alat tulis &amp; pensil 2B • Tanpa HP.
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Wave + Nama Sekolah */}
      <div className="relative h-[22px] shrink-0 flex items-end justify-center pb-[3px] overflow-hidden">
        <BottomMountainWave theme={theme} />
        <div className="relative z-10 text-center leading-none">
          <span className="text-[6.6px] font-black tracking-wide text-white uppercase">
            {footerSchoolLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

interface KartuPesertaSheetProps {
  students: KartuStudentItem[];
  config: KartuPesertaConfig;
  overrides: Record<string, KartuStudentOverride>;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
  indexOffset?: number;
  classAbsenMap?: Record<string, number>;
  qrTokensByStudentId?: Record<string, string>;
  portalBaseUrl?: string;
  jadwalMaster?: { SMP?: JadwalUjianUnitConfig; SMA?: JadwalUjianUnitConfig };
}

/**
 * Paginasi Lembar A4 Cetak Kartu Peserta:
 * - Mode FRONT_ONLY (Gambar 1): 2 kartu per baris x rowsPerPage (default 8 kartu / A4 atau 6 kartu / A4)
 * - Mode BACK_ONLY: Halaman Belakang Jadwal saja dalam grid 2 kolom identik (mendukung mirror kolom untuk cetak 2 sisi A4)
 * - Mode FRONT_BACK_JADWAL (Gambar 4): 1 baris per siswa (Kiri = Depan, Kanan = Belakang Jadwal) -> 4 pasang / A4 atau 3 pasang / A4
 */
export function KartuPesertaSheet({
  students,
  config,
  overrides,
  settings,
  academicSession,
  indexOffset = 0,
  classAbsenMap,
  qrTokensByStudentId = {},
  portalBaseUrl = '',
  jadwalMaster,
}: KartuPesertaSheetProps) {
  const isFrontBack = config.layoutMode === 'FRONT_BACK_JADWAL';
  const isBackOnly = config.layoutMode === 'BACK_ONLY';
  const rowsPerPage = config.rowsPerPage === 3 ? 3 : 4;
  const studentsPerPage = isFrontBack ? rowsPerPage : rowsPerPage * 2;
  const cleanPortalBase = normalizePortalBaseUrl(config.publicBaseUrl || portalBaseUrl);

  const getStudentPortalUrl = (idSiswa: string) => {
    const token = qrTokensByStudentId[idSiswa];
    if (!token || !cleanPortalBase) return undefined;
    return `${cleanPortalBase}/kartu/v/${token}`;
  };

  const resolvedAbsenMap = useMemo(
    () => classAbsenMap ?? buildClassAbsenMap(students),
    [classAbsenMap, students]
  );

  const pages = useMemo(() => {
    const chunks: KartuStudentItem[][] = [];
    for (let i = 0; i < students.length; i += studentsPerPage) {
      chunks.push(students.slice(i, i + studentsPerPage));
    }
    return chunks;
  }, [students, studentsPerPage]);

  if (pages.length === 0) return null;

  return (
    <>
      {pages.map((pageStudents, pageIdx) => (
        <div
          key={`kartu-page-${pageIdx}`}
          className="kartu-page bg-white mx-auto box-border"
          style={{
            width: '210mm',
            minHeight: '295mm',
            padding: '8mm',
          }}
        >
          {isFrontBack ? (
            /* MODE GAMBAR 4: Depan (Kiri) + Belakang Jadwal (Kanan) per siswa dalam 1 baris potong */
            <div
              className="flex flex-col"
              style={{ gap: rowsPerPage === 3 ? '7mm' : '4.5mm' }}
            >
              {pageStudents.map((student, rowIdx) => {
                const globalIdx = indexOffset + pageIdx * studentsPerPage + rowIdx;
                return (
                  <div
                    key={student.id_siswa || `${student.nis}-${globalIdx}`}
                    className="grid grid-cols-2 items-stretch border border-dashed border-slate-400/90 p-[1.5mm] rounded-[10px]"
                    style={{ gap: '3mm' }}
                  >
                    <KartuPesertaFrontCard
                      student={student}
                      indexInSelection={globalIdx}
                      config={config}
                      overrides={overrides}
                      settings={settings}
                      academicSession={academicSession}
                      classAbsenMap={resolvedAbsenMap}
                      portalUrl={getStudentPortalUrl(student.id_siswa)}
                    />
                    <KartuPesertaBackJadwalCard
                      student={student}
                      indexInSelection={globalIdx}
                      config={config}
                      overrides={overrides}
                      settings={settings}
                      academicSession={academicSession}
                      jadwalMaster={jadwalMaster}
                    />
                  </div>
                );
              })}
            </div>
          ) : isBackOnly ? (
            /* MODE BACK_ONLY: Halaman Belakang / Jadwal Saja (2 Kolom Presisi A4; opsional mirror bolak-balik) */
            <div
              className="grid grid-cols-2"
              style={{
                columnGap: '5mm',
                rowGap: rowsPerPage === 3 ? '7mm' : '5mm',
              }}
            >
              {(() => {
                const slots: Array<{ student: KartuStudentItem | null; globalIdx: number }> = [];
                if (config.backMirrorDuplex) {
                  for (let r = 0; r < pageStudents.length; r += 2) {
                    const leftStudent = pageStudents[r];
                    const rightStudent = pageStudents[r + 1] ?? null;
                    slots.push({
                      student: rightStudent,
                      globalIdx: indexOffset + pageIdx * studentsPerPage + r + 1,
                    });
                    slots.push({
                      student: leftStudent,
                      globalIdx: indexOffset + pageIdx * studentsPerPage + r,
                    });
                  }
                } else {
                  pageStudents.forEach((student, slotIdx) => {
                    slots.push({
                      student,
                      globalIdx: indexOffset + pageIdx * studentsPerPage + slotIdx,
                    });
                  });
                }

                return slots.map((slot, renderIdx) => {
                  if (!slot.student) {
                    return <div key={`empty-back-${pageIdx}-${renderIdx}`} aria-hidden="true" />;
                  }
                  return (
                    <div
                      key={slot.student.id_siswa || `${slot.student.nis}-${slot.globalIdx}`}
                      className="border border-dashed border-slate-400/80 p-[1.2mm] rounded-[9px]"
                    >
                      <KartuPesertaBackJadwalCard
                        student={slot.student}
                        indexInSelection={slot.globalIdx}
                        config={config}
                        overrides={overrides}
                        settings={settings}
                        academicSession={academicSession}
                        jadwalMaster={jadwalMaster}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            /* MODE GAMBAR 1: Kartu Depan Landscape 2 Kolom */
            <div
              className="grid grid-cols-2"
              style={{
                columnGap: '5mm',
                rowGap: rowsPerPage === 3 ? '7mm' : '5mm',
              }}
            >
              {pageStudents.map((student, slotIdx) => {
                const globalIdx = indexOffset + pageIdx * studentsPerPage + slotIdx;
                return (
                  <div
                    key={student.id_siswa || `${student.nis}-${globalIdx}`}
                    className="border border-dashed border-slate-400/80 p-[1.2mm] rounded-[9px]"
                  >
                    <KartuPesertaFrontCard
                      student={student}
                      indexInSelection={globalIdx}
                      config={config}
                      overrides={overrides}
                      settings={settings}
                      academicSession={academicSession}
                      classAbsenMap={resolvedAbsenMap}
                      portalUrl={getStudentPortalUrl(student.id_siswa)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
