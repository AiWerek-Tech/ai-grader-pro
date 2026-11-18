'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  BookOpen,
  ShieldCheck,
  Search,
  Lock,
  Sparkles,
  UserCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { buildImageFallbackCandidates } from '@/lib/utils';
import type {
  KartuPortalResult,
  MapelPortalStatus,
  PortalMapelRow,
} from '@/lib/kartu-portal-data';

function PortalLogo({
  src,
  defaultSrc,
  alt,
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
}) {
  const candidates = useMemo(
    () => buildImageFallbackCandidates(src, defaultSrc),
    [src, defaultSrc]
  );
  const [idx, setIdx] = useState(0);
  const [prevKey, setPrevKey] = useState(`${src || ''}|${defaultSrc}`);

  const currentKey = `${src || ''}|${defaultSrc}`;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setIdx(0);
  }

  const activeUrl = candidates[idx] || '';

  if (!activeUrl) return <div className="w-11 h-11 shrink-0" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setIdx((p) => p + 1)}
      className="w-11 h-11 sm:w-12 sm:h-12 object-contain mix-blend-multiply select-none shrink-0"
    />
  );
}

function getStatusBadgeMeta(status: MapelPortalStatus) {
  switch (status) {
    case 'SELESAI':
      return {
        label: 'Terintegrasi LJK • Selesai',
        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        accentBorder: 'border-l-4 border-l-emerald-500',
        icon: CheckCircle2,
      };
    case 'REVIEW_GURU':
      return {
        label: 'Terintegrasi LJK • Verifikasi Guru',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
        accentBorder: 'border-l-4 border-l-amber-500',
        icon: Clock,
      };
    case 'MENUNGGU_UJIAN':
      return {
        label: 'Terintegrasi LJK • Siap / Proses Ujian',
        cls: 'bg-sky-50 text-sky-800 border-sky-200',
        accentBorder: 'border-l-4 border-l-sky-500',
        icon: Sparkles,
      };
    default:
      return {
        label: 'Belum Terintegrasi LJK',
        cls: 'bg-slate-100 text-slate-600 border-slate-200',
        accentBorder: 'border-l-4 border-l-slate-300',
        icon: AlertCircle,
      };
  }
}

export function KartuPortalClient({
  data,
}: {
  data: Extract<KartuPortalResult, { valid: true }>;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'INTEGRATED' | 'NOT_INTEGRATED' | 'SELESAI'>(
    'ALL'
  );
  const [search, setSearch] = useState('');

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 700);
  };

  const { schoolBranding, academicSession, configSummary, student, stats, mapelList, portalShowScore } =
    data;

  const filteredMapels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mapelList.filter((m: PortalMapelRow) => {
      if (filterTab === 'INTEGRATED' && !m.isIntegrated) return false;
      if (filterTab === 'NOT_INTEGRATED' && m.isIntegrated) return false;
      if (
        filterTab === 'SELESAI' &&
        m.overallStatus !== 'SELESAI' &&
        m.overallStatus !== 'REVIEW_GURU'
      ) {
        return false;
      }
      if (q) {
        const hay = `${m.namaMapel} ${m.guruNama} ${m.assessments
          .map((a) => a.judulUjian)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mapelList, filterTab, search]);

  const checkedDateFormatted = useMemo(() => {
    try {
      return new Date(data.checkedAtIso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [data.checkedAtIso]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-10">
      {/* Top School Verification Header */}
      <header
        className="text-white shadow-md relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${student.primaryDark} 0%, ${student.primaryMid} 100%)`,
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-3 relative z-10">
          <div className="bg-white/95 text-slate-900 rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between gap-2.5">
            <PortalLogo
              src={schoolBranding.logoKiri}
              defaultSrc="/logo/logo_advent.png"
              alt="Logo Sekolah"
            />
            <div className="flex-1 text-center min-w-0 leading-tight">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                {schoolBranding.yayasan}
              </div>
              <div
                className="text-[11px] sm:text-xs font-black uppercase tracking-tight truncate"
                style={{ color: student.primaryDark }}
              >
                {schoolBranding.akademi}
              </div>
              <div
                className="text-sm sm:text-base font-black uppercase tracking-tight truncate"
                style={{ color: student.primaryDark }}
              >
                {schoolBranding.sekolah}
              </div>
              <div className="text-[10px] font-semibold text-slate-600 truncate mt-0.5">
                {schoolBranding.alamat}
                {schoolBranding.npsn ? ` • NPSN ${schoolBranding.npsn}` : ''}
              </div>
            </div>
            <PortalLogo
              src={schoolBranding.logoKanan}
              defaultSrc="/logo/tut_wuri.png"
              alt="Logo Kemendikbud"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Portal Verifikasi Peserta Asesmen
              </div>
              <div className="text-sm sm:text-base font-black tracking-tight">
                {configSummary.judulUjian} • TA {academicSession.tahunAjaran} ({academicSession.semester})
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                <UserCheck className="w-3.5 h-3.5" />
                Status: Aktif
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Perbarui status integrasi LJK & nilai terbaru"
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-2 space-y-4">
        {/* Student Profile Card */}
        <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-sm"
              style={{ background: student.avatarBg }}
            >
              {student.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase"
                  style={{
                    backgroundColor: student.pillBg,
                    color: student.pillText,
                    border: `1px solid ${student.pillBorder}`,
                  }}
                >
                  {student.jenjang} • {student.nama_kelas}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                  No. Urut {student.noAbsen}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight truncate mt-1">
                {student.nama}
              </h1>
              <p className="text-xs font-mono font-bold text-slate-500">
                No. Peserta: {student.noPeserta}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-400">NIS</div>
              <div className="text-xs sm:text-sm font-mono font-black text-slate-900 mt-0.5">
                {student.nis || '-'}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-400">Ruang Ujian</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 truncate">
                {student.ruang}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-400">No. Meja</div>
              <div className="text-xs sm:text-sm font-mono font-black text-slate-900 mt-0.5">
                Meja {student.meja}
              </div>
            </div>
          </div>
        </section>

        {/* Progress KPI Strip */}
        <section className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-2xs">
            <div className="text-[10px] font-extrabold uppercase text-slate-500">Mapel Kelas</div>
            <div className="text-xl font-black text-slate-950 mt-0.5">{stats.totalMapel}</div>
            <div className="text-[10px] font-semibold text-slate-400">Terdaftar</div>
          </div>
          <div className="bg-white rounded-2xl border border-sky-200 p-3 text-center shadow-2xs">
            <div className="text-[10px] font-extrabold uppercase text-sky-700">Integrasi LJK</div>
            <div className="text-xl font-black text-sky-900 mt-0.5">{stats.integratedCount}</div>
            <div className="text-[10px] font-semibold text-sky-600">Ada Kunci</div>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-3 text-center shadow-2xs">
            <div className="text-[10px] font-extrabold uppercase text-emerald-700">Proses / Nilai</div>
            <div className="text-xl font-black text-emerald-900 mt-0.5">{stats.completedCount}</div>
            <div className="text-[10px] font-semibold text-emerald-600">Terkoreksi</div>
          </div>
        </section>

        {/* Subject Integration List */}
        <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm sm:text-base font-black text-slate-950">
                Daftar Mata Pelajaran &amp; Status LJK
              </h2>
            </div>
            <span className="text-[10px] font-bold text-slate-500">
              {student.nama_kelas}
            </span>
          </div>

          {/* Search & Filter Pills */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari mata pelajaran atau nama guru..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: `Semua (${stats.totalMapel})` },
                { key: 'INTEGRATED', label: `Terintegrasi (${stats.integratedCount})` },
                { key: 'NOT_INTEGRATED', label: `Belum (${stats.notIntegratedCount})` },
                { key: 'SELESAI', label: `Ada Hasil (${stats.completedCount})` },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterTab(t.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                    filterTab === t.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mapel Rows */}
          <div className="space-y-2.5">
            {filteredMapels.length === 0 ? (
              <div className="py-10 text-center text-xs font-semibold text-slate-500">
                Tidak ada mata pelajaran pada filter ini.
              </div>
            ) : (
              filteredMapels.map((mapel, idx) => {
                const badge = getStatusBadgeMeta(mapel.overallStatus);
                const BadgeIcon = badge.icon;
                const prevMapel = idx > 0 ? filteredMapels[idx - 1] : null;
                const showIntegratedHeader =
                  filterTab === 'ALL' && idx === 0 && mapel.isIntegrated;
                const showUnintegratedHeader =
                  filterTab === 'ALL' &&
                  !mapel.isIntegrated &&
                  (idx === 0 || Boolean(prevMapel?.isIntegrated));

                return (
                  <React.Fragment key={mapel.idMapel}>
                    {showIntegratedHeader && (
                      <div className="flex items-center justify-between pt-1 pb-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        <span>✓ Prioritas Terintegrasi LJK</span>
                        <span>{filteredMapels.filter((m) => m.isIntegrated).length} Mapel</span>
                      </div>
                    )}
                    {showUnintegratedHeader && (
                      <div className="flex items-center justify-between pt-2.5 pb-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>○ Belum Terintegrasi Kunci LJK</span>
                        <span>{filteredMapels.filter((m) => !m.isIntegrated).length} Mapel</span>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl border p-3.5 transition ${badge.accentBorder} ${
                        mapel.isIntegrated
                          ? 'bg-white border-slate-200 shadow-2xs'
                          : 'bg-slate-50/75 border-dashed border-slate-200/80'
                      }`}
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-950 leading-snug">
                          {mapel.namaMapel}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          Pengampu: {mapel.guruNama} • KKM {mapel.kkm}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-extrabold shrink-0 ${badge.cls}`}
                      >
                        <BadgeIcon className="w-3 h-3 shrink-0" />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {!mapel.isIntegrated ? (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 text-[11px] font-medium text-slate-500">
                        Belum terdapat kunci jawaban LJK aktif untuk kelas {student.nama_kelas}.
                      </div>
                    ) : (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
                        {mapel.assessments.map((ass) => (
                          <div
                            key={ass.idKunci}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/90 border border-slate-200/70 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-extrabold text-slate-900 truncate">
                                {ass.judulUjian}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                {ass.status === 'MENUNGGU_UJIAN' &&
                                  'Kunci LJK siap • Menunggu ujian atau hasil scan'}
                                {ass.status === 'REVIEW_GURU' &&
                                  'LJK sudah dipindai • Sedang diverifikasi guru'}
                                {ass.status === 'SELESAI' &&
                                  (portalShowScore
                                    ? `Benar ${ass.benar ?? '-'} • Salah ${ass.salah ?? '-'} • Kosong ${ass.kosong ?? '-'}`
                                    : 'Hasil koreksi LJK telah selesai')}
                              </div>
                            </div>

                            {ass.status === 'SELESAI' ? (
                              portalShowScore && ass.skor !== null ? (
                                <div className="text-right shrink-0">
                                  <div className="flex items-baseline justify-end gap-1">
                                    <span
                                      className={`text-lg font-black leading-none ${
                                        ass.lulus ? 'text-emerald-700' : 'text-rose-700'
                                      }`}
                                    >
                                      {ass.skor}
                                    </span>
                                    {ass.predikat && (
                                      <span className="text-[10px] font-black text-slate-500">
                                        ({ass.predikat})
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                      ass.lulus
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {ass.lulus ? 'TUNTAS' : 'TIDAK TUNTAS'}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black shrink-0">
                                  <Lock className="w-3 h-3" />
                                  Selesai
                                </span>
                              )
                            ) : ass.status === 'REVIEW_GURU' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-black shrink-0">
                                Proses Review
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 text-[10px] font-black shrink-0">
                                Proses Ujian
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </section>

        {/* Verification Footer */}
        <footer className="text-center space-y-1.5 pt-2 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-1.5 font-bold text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dokumen Digital Terverifikasi Token QR Resmi Sekolah</span>
          </div>
          <p className="text-[10px] text-slate-400">
            {schoolBranding.sekolah} • WMVAA AI Grader Pro • Diperiksa {checkedDateFormatted}
          </p>
        </footer>
      </main>
    </div>
  );
}

export function KartuPortalErrorState({
  reason,
  schoolName,
}: {
  reason: 'INVALID_TOKEN' | 'DISABLED' | 'NOT_FOUND';
  schoolName: string;
}) {
  const copy =
    reason === 'DISABLED'
      ? {
          title: 'Portal QR Kartu Sedang Dinonaktifkan',
          desc: 'Administrator sekolah menonaktifkan sementara akses portal verifikasi peserta melalui QR Code.',
        }
      : reason === 'NOT_FOUND'
        ? {
            title: 'Data Peserta Tidak Ditemukan',
            desc: 'Data siswa pada sesi akademik ini sudah tidak aktif atau dipindahkan.',
          }
        : {
            title: 'Akses Ditolak — QR Tidak Valid / Kedaluwarsa',
            desc: 'Halaman ini hanya dapat diakses melalui pemindaian QR Code resmi pada Kartu Peserta Asesmen.',
          };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-black text-slate-950">{copy.title}</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
            {copy.desc}
          </p>
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400">
          <Building2 className="w-3.5 h-3.5" />
          <span>{schoolName} • WMVAA</span>
        </div>
      </div>
    </div>
  );
}
