'use client';

import React, { useMemo, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { buildImageFallbackCandidates } from '@/lib/utils';
import {
  DaftarHadirConfig,
  DaftarHadirDocumentSpec,
} from '@/lib/daftar-hadir-utils';

function SheetLogo({
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

  const activeUrl = candidates[idx] || defaultSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < candidates.length) setIdx((i) => i + 1);
      }}
      className="w-[58px] h-[58px] object-contain select-none"
    />
  );
}

function SheetSignature({ src }: { src?: string }) {
  const candidates = useMemo(() => buildImageFallbackCandidates(src, ''), [src]);
  const [idx, setIdx] = useState(0);
  const [prevSrc, setPrevSrc] = useState(src || '');

  if ((src || '') !== prevSrc) {
    setPrevSrc(src || '');
    setIdx(0);
  }

  const activeUrl = candidates[idx] || '';
  if (!activeUrl) return <div className="h-12" />;

  return (
    <div className="h-12 flex items-center justify-center -my-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeUrl}
        alt="Tanda Tangan"
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
        className="max-h-12 max-w-[130px] w-auto h-auto object-contain mix-blend-multiply select-none"
      />
    </div>
  );
}

function KopSuratResmi({
  jenjang,
  settings,
}: {
  jenjang: 'SMP' | 'SMA';
  settings: Record<string, string>;
}) {
  const prefix = jenjang === 'SMP' ? 'smp_' : 'sma_';
  const namaYayasan = settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const sekolah1 =
    settings[`${prefix}nama_sekolah_1`] ||
    settings['nama_sekolah_1'] ||
    'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
  const sekolah2 =
    settings[`${prefix}nama_sekolah_2`] ||
    settings['nama_sekolah_2'] ||
    (jenjang === 'SMP' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
  const alamat =
    settings['alamat_sekolah'] ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya - Papua';

  const logoKiri =
    settings[`${prefix}logo_kiri_url`] || settings['logo_kiri_url'] || '/logo/logo_advent.png';
  const logoKanan =
    settings[`${prefix}logo_kanan_url`] || settings['logo_kanan_url'] || '/logo/tut_wuri.png';

  return (
    <div className="border-b-[2.5px] border-black pb-1.5 mb-2.5">
      <div className="border-b border-black pb-1.5 flex items-center justify-between gap-3">
        <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0">
          <SheetLogo
            src={logoKiri}
            defaultSrc={withBasePath('/logo/logo_advent.png')}
            alt="Logo Sekolah"
          />
        </div>

        <div className="flex-1 text-center leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-black">
            {namaYayasan}
          </div>
          <div className="text-[12px] font-black uppercase tracking-[0.03em] text-black mt-0.5">
            {sekolah1}
          </div>
          <div className="text-[15.5px] font-black uppercase tracking-[0.03em] text-black">
            {sekolah2}
          </div>
          <div className="text-[8.5px] italic text-slate-900 mt-0.5">{alamat}</div>
        </div>

        <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0">
          <SheetLogo
            src={logoKanan}
            defaultSrc={withBasePath('/logo/tut_wuri.png')}
            alt="Logo Tut Wuri"
          />
        </div>
      </div>
    </div>
  );
}

function resolveOfficialSigner(
  jenjang: 'SMP' | 'SMA',
  signerMode: 'PANITIA' | 'KEPSEK' | 'NONE',
  settings: Record<string, string>
) {
  const prefix = jenjang === 'SMP' ? 'smp_' : 'sma_';
  if (signerMode === 'KEPSEK') {
    return {
      jabatan: 'Kepala Sekolah',
      nama:
        settings[`${prefix}kepsek_nama`] ||
        settings['kepsek_nama'] ||
        '........................................',
      nip: settings[`${prefix}kepsek_nip`] || settings['kepsek_nip'] || '',
      ttdUrl: settings[`${prefix}kepsek_ttd_url`] || settings['kepsek_ttd_url'] || '',
    };
  }
  return {
    jabatan: 'Ketua Panitia Ujian',
    nama:
      settings[`${prefix}panitia_nama`] ||
      settings['panitia_nama'] ||
      '........................................',
    nip: settings[`${prefix}panitia_nip`] || settings['panitia_nip'] || '',
    ttdUrl: settings[`${prefix}panitia_ttd_url`] || settings['panitia_ttd_url'] || '',
  };
}

function DaftarHadirSinglePage({
  doc,
  config,
  settings,
  judulUjian,
  academicSession,
}: {
  doc: DaftarHadirDocumentSpec;
  config: DaftarHadirConfig;
  settings: Record<string, string>;
  judulUjian: string;
  academicSession: { tahunAjaran: string; semester: string };
}) {
  const { group } = doc;
  const participants = group.participants;
  const isDense = participants.length > 25;
  const rowPad = isDense ? 'py-[2.5px] px-1.5' : 'py-[4px] px-2';
  const fontSize = isDense ? 'text-[9px]' : 'text-[9.8px]';

  const kota = settings['kota_sekolah'] || 'Wamena';
  const official = resolveOfficialSigner(group.jenjang, config.signerMode, settings);

  return (
    <div className="daftar-hadir-page bg-white text-black w-full max-w-[200mm] mx-auto p-6 sm:p-7 print:p-0 print:max-w-none font-serif box-border">
      <KopSuratResmi jenjang={group.jenjang} settings={settings} />

      {/* Judul Dokumen */}
      <div className="text-center mb-2.5 leading-snug">
        <h2 className="text-[13px] font-black uppercase tracking-[0.04em] text-black">
          DAFTAR HADIR PESERTA {judulUjian.toUpperCase()}
        </h2>
        <div className="text-[11px] font-bold uppercase tracking-[0.03em] text-black">
          TAHUN PELAJARAN {academicSession.tahunAjaran} • SEMESTER {academicSession.semester}
        </div>
      </div>

      {/* Metadata Identitas Ruang & Sesi */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] mb-2.5 border border-black p-2 bg-slate-50/40">
        <div className="space-y-0.5">
          <div className="flex">
            <span className="w-28 font-bold shrink-0">Kelas / Ruang</span>
            <span className="mr-1.5">:</span>
            <span className="font-bold">
              {group.kelasLabel} ({group.ruangLabel})
            </span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold shrink-0">Hari, Tanggal</span>
            <span className="mr-1.5">:</span>
            <span className="font-semibold">{doc.hariTanggal}</span>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex">
            <span className="w-28 font-bold shrink-0">
              {doc.mode === 'PER_HARI' ? 'Sesi Ujian' : 'Mata Pelajaran'}
            </span>
            <span className="mr-1.5">:</span>
            <span className="font-bold truncate">
              {doc.mode === 'PER_HARI' ? `${doc.daySessions.length} Mata Pelajaran` : doc.mapel}
            </span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold shrink-0">Waktu / Pukul</span>
            <span className="mr-1.5">:</span>
            <span className="font-semibold">{doc.waktu} WIT</span>
          </div>
        </div>
      </div>

      {/* Tabel Daftar Hadir */}
      {doc.mode === 'PER_HARI' && doc.daySessions.length > 0 ? (
        <table className={`w-full border-collapse border border-black ${fontSize} text-black`}>
          <thead>
            <tr className="bg-slate-100 font-black uppercase text-center">
              <th rowSpan={2} className="border border-black py-1 px-1 w-[4%]">
                No
              </th>
              <th rowSpan={2} className="border border-black py-1 px-1.5 w-[18%]">
                Nomor Peserta
              </th>
              <th rowSpan={2} className="border border-black py-1 px-2 w-[28%]">
                Nama Peserta Didik
              </th>
              <th
                colSpan={doc.daySessions.length}
                className="border border-black py-1 px-1 text-center"
              >
                Tanda Tangan Per Sesi Mata Pelajaran
              </th>
              <th rowSpan={2} className="border border-black py-1 px-1 w-[6%]">
                Ket.
              </th>
            </tr>
            <tr className="bg-slate-50 font-bold text-center text-[8.5px]">
              {doc.daySessions.map((sess, sIdx) => (
                <th key={sess.slotId || sIdx} className="border border-black py-1 px-1">
                  <div className="font-black leading-tight">{sess.mapel}</div>
                  <div className="font-normal text-[7.5px]">{sess.waktu}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((p, idx) => (
              <tr key={p.student.id_siswa || idx}>
                <td className={`border border-black ${rowPad} text-center font-semibold`}>
                  {idx + 1}
                </td>
                <td className={`border border-black ${rowPad} text-center font-mono text-[8.8px]`}>
                  {p.noPeserta}
                </td>
                <td className={`border border-black ${rowPad} font-semibold uppercase`}>
                  {p.student.nama}
                </td>
                {doc.daySessions.map((sess, sIdx) => (
                  <td
                    key={sess.slotId || sIdx}
                    className={`border border-black ${rowPad} text-[8px] text-slate-500`}
                  >
                    {idx + 1}.
                  </td>
                ))}
                <td className={`border border-black ${rowPad} text-center`} />
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className={`w-full border-collapse border border-black ${fontSize} text-black`}>
          <thead>
            <tr className="bg-slate-100 font-black uppercase text-center">
              <th className="border border-black py-1.5 px-1 w-[5%]">No</th>
              <th className="border border-black py-1.5 px-1.5 w-[20%]">Nomor Peserta</th>
              <th className="border border-black py-1.5 px-1.5 w-[10%]">NIS</th>
              <th className="border border-black py-1.5 px-2 w-[33%]">Nama Peserta Didik</th>
              <th colSpan={2} className="border border-black py-1.5 px-2 w-[25%]">
                Tanda Tangan
              </th>
              <th className="border border-black py-1.5 px-1 w-[7%]">Ket.</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, idx) => {
              const isOdd = (idx + 1) % 2 === 1;
              return (
                <tr key={p.student.id_siswa || idx}>
                  <td className={`border border-black ${rowPad} text-center font-semibold`}>
                    {idx + 1}
                  </td>
                  <td className={`border border-black ${rowPad} text-center font-mono text-[9px]`}>
                    {p.noPeserta}
                  </td>
                  <td className={`border border-black ${rowPad} text-center font-mono text-[9px]`}>
                    {p.student.nis || '-'}
                  </td>
                  <td className={`border border-black ${rowPad} font-semibold uppercase`}>
                    {p.student.nama}
                  </td>
                  {/* Zig-Zag Signature Columns */}
                  <td className={`border border-black ${rowPad} w-[12.5%] text-[8.5px]`}>
                    {isOdd ? `${idx + 1}.` : ''}
                  </td>
                  <td className={`border border-black ${rowPad} w-[12.5%] text-[8.5px]`}>
                    {!isOdd ? `${idx + 1}.` : ''}
                  </td>
                  <td className={`border border-black ${rowPad} text-center`} />
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Footer Rekapitulasi Kehadiran & Pengawas Ruang */}
      <div className="mt-3 grid grid-cols-12 gap-4 items-start break-inside-avoid text-[9.5px]">
        {/* Rekapitulasi Kehadiran */}
        <div className="col-span-5 border border-black p-2 space-y-1">
          <div className="font-black uppercase text-[9px] border-b border-black pb-0.5 mb-1">
            Rekapitulasi Kehadiran Peserta
          </div>
          <div className="flex justify-between">
            <span>1. Jumlah Peserta Seharusnya</span>
            <span className="font-bold">: {participants.length} orang</span>
          </div>
          <div className="flex justify-between">
            <span>2. Jumlah Peserta Hadir</span>
            <span>: ........ orang</span>
          </div>
          <div className="flex justify-between">
            <span>3. Jumlah Tidak Hadir (S/I/A)</span>
            <span>: ........ orang</span>
          </div>
          <div className="pt-0.5 text-[8.5px] italic text-slate-700">
            Ket: S = Sakit, I = Izin, A = Tanpa Keterangan
          </div>
        </div>

        {/* Blok Tanda Tangan Pengawas & Pejabat */}
        <div className="col-span-7 flex justify-around items-start text-center pt-0.5">
          {config.signerMode !== 'NONE' && (
            <div className="min-w-[125px]">
              <p className="text-[9px]">Mengetahui,</p>
              <p className="font-bold text-[9.5px]">{official.jabatan}</p>
              <SheetSignature src={official.ttdUrl} />
              <p className="font-bold underline underline-offset-2 text-[9.5px]">
                {official.nama}
              </p>
              {official.nip && <p className="text-[8.5px]">NIP. {official.nip}</p>}
            </div>
          )}

          <div className="min-w-[125px]">
            <p className="text-[9px]">{config.jumlahPengawas === 2 ? 'Pengawas I' : `${kota}, ................`}</p>
            <p className="font-bold text-[9.5px]">Pengawas Ruang {config.jumlahPengawas === 2 ? 'I' : ''}</p>
            <div className="h-12" />
            <p className="font-bold underline underline-offset-2 text-[9.5px]">
              {config.pengawas1Nama || '....................................'}
            </p>
            {config.pengawas1Nip && <p className="text-[8.5px]">NIP. {config.pengawas1Nip}</p>}
          </div>

          {config.jumlahPengawas === 2 && (
            <div className="min-w-[125px]">
              <p className="text-[9px]">&nbsp;</p>
              <p className="font-bold text-[9.5px]">Pengawas Ruang II</p>
              <div className="h-12" />
              <p className="font-bold underline underline-offset-2 text-[9.5px]">
                {config.pengawas2Nama || '....................................'}
              </p>
              {config.pengawas2Nip && <p className="text-[8.5px]">NIP. {config.pengawas2Nip}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BeritaAcaraSinglePage({
  doc,
  config,
  settings,
  judulUjian,
  academicSession,
}: {
  doc: DaftarHadirDocumentSpec;
  config: DaftarHadirConfig;
  settings: Record<string, string>;
  judulUjian: string;
  academicSession: { tahunAjaran: string; semester: string };
}) {
  const { group } = doc;
  const prefix = group.jenjang === 'SMP' ? 'smp_' : 'sma_';
  const sekolah2 =
    settings[`${prefix}nama_sekolah_2`] ||
    settings['nama_sekolah_2'] ||
    (group.jenjang === 'SMP' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
  const official = resolveOfficialSigner(group.jenjang, config.signerMode === 'NONE' ? 'PANITIA' : config.signerMode, settings);

  return (
    <div className="daftar-hadir-page bg-white text-black w-full max-w-[200mm] mx-auto p-6 sm:p-8 print:p-0 print:max-w-none font-serif box-border">
      <KopSuratResmi jenjang={group.jenjang} settings={settings} />

      <div className="text-center mb-4 leading-snug">
        <h2 className="text-[13.5px] font-black uppercase underline underline-offset-4 tracking-[0.04em]">
          BERITA ACARA PELAKSANAAN ASESMEN
        </h2>
        <div className="text-[11px] font-bold uppercase mt-1">
          {judulUjian} • TAHUN PELAJARAN {academicSession.tahunAjaran} ({academicSession.semester})
        </div>
      </div>

      <div className="text-[10.5px] leading-relaxed space-y-3 text-justify">
        <p>
          Pada hari ini <b>{doc.hariTanggal}</b>, bertempat di <b>{sekolah2}</b>, telah
          diselenggarakan <b>{judulUjian}</b> Tahun Pelajaran{' '}
          <b>{academicSession.tahunAjaran}</b> Semester <b>{academicSession.semester}</b> untuk:
        </p>

        <div className="border border-black p-3 space-y-1.5 bg-slate-50/30">
          <div className="flex">
            <span className="w-48 font-bold shrink-0">1. Mata Pelajaran</span>
            <span className="mr-2">:</span>
            <span className="font-bold">{doc.mapel}</span>
          </div>
          <div className="flex">
            <span className="w-48 font-bold shrink-0">2. Kelas / Ruang Ujian</span>
            <span className="mr-2">:</span>
            <span className="font-bold">
              {group.kelasLabel} ({group.ruangLabel})
            </span>
          </div>
          <div className="flex">
            <span className="w-48 font-bold shrink-0">3. Waktu / Pukul</span>
            <span className="mr-2">:</span>
            <span className="font-semibold">{doc.waktu} WIT</span>
          </div>
          <div className="flex">
            <span className="w-48 font-bold shrink-0">4. Jumlah Peserta Seharusnya</span>
            <span className="mr-2">:</span>
            <span className="font-bold">{group.participants.length} Orang</span>
          </div>
          <div className="flex">
            <span className="w-48 font-bold shrink-0">5. Jumlah Peserta yang Hadir</span>
            <span className="mr-2">:</span>
            <span>.............. Orang</span>
          </div>
          <div className="flex">
            <span className="w-48 font-bold shrink-0">6. Jumlah Peserta Tidak Hadir</span>
            <span className="mr-2">:</span>
            <span>.............. Orang</span>
          </div>
          <div className="flex">
            <span className="w-48 font-bold shrink-0">7. Nomor Peserta Tidak Hadir</span>
            <span className="mr-2">:</span>
            <span>............................................................................................</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-bold">
            Catatan Kejadian Penting / Khusus Selama Pelaksanaan Ujian:
          </p>
          <div className="border border-black h-20 p-2 text-[9.5px] italic text-slate-500">
            (Tulis &quot;NIHIL / TERTIB &amp; LANCAR&quot; apabila tidak ada kendala khusus)
          </div>
        </div>

        <p>
          Demikian Berita Acara pelaksanaan asesmen ini dibuat dengan sesungguhnya untuk dapat
          dipergunakan sebagaimana mestinya.
        </p>
      </div>

      {/* Blok Tanda Tangan Berita Acara */}
      <div className="mt-6 flex justify-around items-start text-center text-[10.5px]">
        <div className="min-w-[150px]">
          <p>Mengetahui,</p>
          <p className="font-bold">{official.jabatan}</p>
          <SheetSignature src={official.ttdUrl} />
          <p className="font-bold underline underline-offset-2">{official.nama}</p>
          {official.nip && <p className="text-[9px]">NIP. {official.nip}</p>}
        </div>

        <div className="min-w-[150px]">
          <p>&nbsp;</p>
          <p className="font-bold">Pengawas Ruang {config.jumlahPengawas === 2 ? 'I' : ''}</p>
          <div className="h-14" />
          <p className="font-bold underline underline-offset-2">
            {config.pengawas1Nama || '........................................'}
          </p>
          {config.pengawas1Nip && <p className="text-[9px]">NIP. {config.pengawas1Nip}</p>}
        </div>

        {config.jumlahPengawas === 2 && (
          <div className="min-w-[150px]">
            <p>&nbsp;</p>
            <p className="font-bold">Pengawas Ruang II</p>
            <div className="h-14" />
            <p className="font-bold underline underline-offset-2">
              {config.pengawas2Nama || '........................................'}
            </p>
            {config.pengawas2Nip && <p className="text-[9px]">NIP. {config.pengawas2Nip}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DaftarHadirSheet({
  documents,
  config,
  settings,
  judulUjian,
  academicSession,
}: {
  documents: DaftarHadirDocumentSpec[];
  config: DaftarHadirConfig;
  settings: Record<string, string>;
  judulUjian: string;
  academicSession: { tahunAjaran: string; semester: string };
}) {
  if (documents.length === 0) {
    return (
      <div className="p-10 text-center text-slate-400 text-xs italic bg-white rounded-2xl">
        Tidak ada lembar daftar hadir yang cocok dengan filter saat ini.
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-0">
      {documents.map((doc) => (
        <React.Fragment key={doc.id}>
          <DaftarHadirSinglePage
            doc={doc}
            config={config}
            settings={settings}
            judulUjian={judulUjian}
            academicSession={academicSession}
          />
          {config.includeBeritaAcara && (
            <BeritaAcaraSinglePage
              doc={doc}
              config={config}
              settings={settings}
              judulUjian={judulUjian}
              academicSession={academicSession}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
