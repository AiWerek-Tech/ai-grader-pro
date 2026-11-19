'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  HelpCircle,
  IdCard,
  MessageSquare,
  Printer,
  ShieldCheck,
  Table2,
  UserCheck,
  X,
} from 'lucide-react';

type GuideTab = 'ALUR' | 'BENDAHARA' | 'KASIR' | 'FAQ';

export function PanduanKeuanganModal({
  open,
  onClose,
  canEdit,
  canInputKasir,
  minPercentForExamCard,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  canInputKasir: boolean;
  minPercentForExamCard: number;
}) {
  const defaultTab: GuideTab = !canEdit && canInputKasir ? 'KASIR' : 'ALUR';
  const [tab, setTab] = useState<GuideTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setTab(!canEdit && canInputKasir ? 'KASIR' : 'ALUR');
    }
  }, [open, canEdit, canInputKasir]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const tabs: Array<{
    id: GuideTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'ALUR', label: 'Alur & Jabatan', icon: ShieldCheck },
    { id: 'BENDAHARA', label: 'Panduan Bendahara', icon: Table2 },
    { id: 'KASIR', label: 'Panduan Kasir', icon: CreditCard },
    { id: 'FAQ', label: 'FAQ & Tips', icon: HelpCircle },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/80 dark:from-emerald-500/10 dark:via-[#0b1120] dark:to-indigo-500/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                Panduan Lengkap Bendahara &amp; Kasir
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                SOP Posting Tagihan Excel, Surat Tagihan, Loket Kasir, Tutup Kas &amp; Syarat Kartu Ujian ({minPercentForExamCard}%)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Pills */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-1.5 bg-slate-50/60 dark:bg-white/[0.02]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-indigo-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* TAB 1: ALUR & PEMBAGIAN JABATAN */}
          {tab === 'ALUR' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2.5">
                  Alur Kerja Lengkap (End-to-End)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    {
                      step: 'LANGKAH 1',
                      role: 'Bendahara',
                      title: 'Posting Sisa Tagihan',
                      desc: 'Pindahkan saldo tunggakan siswa dari Excel lewat Input Cepat per Kelas atau Import File Excel (.xlsx). Siswa lunas cukup diisi Rp 0.',
                      cls: 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25',
                      badge: 'text-emerald-700 dark:text-emerald-300',
                    },
                    {
                      step: 'LANGKAH 2',
                      role: 'Bendahara / Kasir',
                      title: 'Cetak Surat & Kirim WA',
                      desc: 'Cetak Surat Tagihan berkop resmi (2 surat/A4 + garis potong) untuk dibagikan ke siswa sebelum ujian, atau salin pesan WA ke orang tua.',
                      cls: 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25',
                      badge: 'text-amber-700 dark:text-amber-300',
                    },
                    {
                      step: 'LANGKAH 3',
                      role: 'Kasir Loket',
                      title: 'Input Bayar & Kwitansi',
                      desc: `Siswa/ortu bayar Lunas 100% atau minimal ${minPercentForExamCard}% di loket. Kasir input nominal & cetak Kwitansi 2 Rangkap (Siswa + Arsip).`,
                      cls: 'bg-sky-50/80 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/25',
                      badge: 'text-sky-700 dark:text-sky-300',
                    },
                    {
                      step: 'LANGKAH 4',
                      role: 'Panitia & Pimpinan',
                      title: 'Kartu Ujian & Laporan',
                      desc: `Begitu terbayar ≥${minPercentForExamCard}% (atau Dispensasi), Kartu Ujian langsung terbuka. Sore hari tutup kas & cetak Laporan A4.`,
                      cls: 'bg-indigo-50/80 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/25',
                      badge: 'text-indigo-700 dark:text-indigo-300',
                    },
                  ].map((s) => (
                    <div key={s.step} className={`p-3.5 rounded-2xl border space-y-1.5 ${s.cls}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-black uppercase ${s.badge}`}>
                          {s.step}
                        </span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/20 text-slate-600 dark:text-slate-300">
                          {s.role}
                        </span>
                      </div>
                      <div className="font-black text-slate-900 dark:text-white text-xs">
                        {s.title}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                        {s.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                  Pembagian Wewenang Bendahara vs Kasir Loket
                </h3>
                <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-white/[0.05] text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                        <th className="py-2 px-3">Tugas / Fitur</th>
                        <th className="py-2 px-2 text-center w-24">Bendahara</th>
                        <th className="py-2 px-2 text-center w-24">Kasir Loket</th>
                        <th className="py-2 px-2 text-center w-24">Wali / Panitia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {[
                        ['Atur syarat % kartu, profil & TTD Bendahara', true, false, false],
                        ['Posting sisa tagihan (Grid Kelas / Import Excel / Bulanan)', true, false, false],
                        ['Edit nominal, potongan/beasiswa, hapus tagihan', true, false, false],
                        ['Beri / cabut Dispensasi Kartu Ujian', true, false, false],
                        ['Batalkan (VOID) transaksi kwitansi salah input', true, false, false],
                        ['Terima pembayaran loket & terbitkan Kwitansi', true, true, false],
                        ['Cetak Surat Tagihan & salin pesan WhatsApp', true, true, true],
                        ['Pantau kelayakan, cetak Laporan A4 & Export Excel', true, true, true],
                      ].map(([label, b, k, w], idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {label as string}
                          </td>
                          <td className="py-2 px-2 text-center font-black">
                            {b ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="py-2 px-2 text-center font-black">
                            {k ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="py-2 px-2 text-center font-black">
                            {w ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10.5px] text-slate-500 mt-2">
                  <strong>Catatan Admin:</strong> Penunjukan akun Bendahara Sekolah &amp; Kasir Loket SPP diatur lewat 1-klik preset di menu <strong>Pengaturan Sekolah → Hak Akses Guru</strong>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: PANDUAN BENDAHARA */}
          {tab === 'BENDAHARA' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-emerald-950 dark:text-emerald-200">
                  <strong>Tidak perlu input ulang pembayaran lama!</strong> Cukup posting angka <strong>sisa tunggakan terakhir</strong> tiap siswa dari buku/Excel Bendahara menjelang ujian. Siswa yang sudah lunas di Excel cukup dibiarkan <strong>Rp 0</strong> agar otomatis ditandai <strong>Lunas 100%</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white text-[10px] flex items-center justify-center">1</span>
                    Atur Profil Bendahara &amp; Syarat Kartu (Sekali)
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Buka tab <strong>2. Posting Tagihan &amp; Aturan</strong> → gulir ke bagian bawah.</li>
                    <li>Isi <strong>Ambang Minimal Kartu (%)</strong> (default <code>{minPercentForExamCard}%</code>) &amp; centang kunci cetak Kartu Peserta.</li>
                    <li>Isi <strong>Nama Lengkap, Jabatan, NIP/NRG, TTD Digital</strong> Bendahara (1 orang untuk SMP &amp; SMA) serta <strong>Info Rekening</strong>.</li>
                    <li>Klik <strong>Simpan Pengaturan Keuangan</strong>.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white text-[10px] flex items-center justify-center">2</span>
                    Cara Posting Sisa Tagihan (Pilih Tercepat)
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li>
                      <strong>Input Cepat per Kelas (Mirip Excel):</strong> Pilih kelas → ketik sisa tagihan &amp; keterangan (tekan <code>Enter</code> untuk lompat baris) → klik <strong>Posting Tagihan Kelas Ini</strong>.
                    </li>
                    <li>
                      <strong>Import Excel (.xlsx):</strong> Klik <strong>Download Template</strong> → copy-paste angka sisa dari Excel Anda ke kolom <code>TAGIHAN_TERSISA_RP</code> → unggah kembali → cek preview → <strong>Konfirmasi &amp; Posting</strong>.
                    </li>
                    <li>
                      <strong>Generate SPP Bulanan:</strong> Opsional bila ingin membuat tagihan rutin 6 bulan di awal semester baru.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-amber-600 text-white text-[10px] flex items-center justify-center">3</span>
                    Cetak Surat Tagihan &amp; Kirim WA
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Buka tab <strong>3. Surat Tagihan &amp; WA</strong>, filter unit/kelas.</li>
                    <li>Klik <strong>Preview</strong> bila ingin mengecek tampilan Kop Sekolah &amp; rincian.</li>
                    <li>Klik <strong>Pilih Semua Belum Layak</strong> → <strong>Cetak Surat</strong> (otomatis 2 surat per A4 dengan garis potong).</li>
                    <li>Klik <strong>Salin WA</strong> untuk mengirim pesan pengingat sopan ke orang tua.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-purple-600 text-white text-[10px] flex items-center justify-center">4</span>
                    Beasiswa, Dispensasi, VOID &amp; Laporan Resmi
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li><strong>Beasiswa / Edit:</strong> Di tab 1 klik <strong>Detail</strong> → <strong>Edit / Beasiswa</strong>.</li>
                    <li><strong>Dispensasi Ujian:</strong> Klik tombol ungu <strong>Disp.</strong> → isi alasan &amp; tanggal janji bayar → Kartu Ujian langsung terbuka.</li>
                    <li><strong>VOID Kwitansi:</strong> Di tab Kasir klik ikon merah <strong>Ban</strong> → isi alasan → saldo tagihan siswa otomatis kembali.</li>
                    <li><strong>Laporan Resmi A4:</strong> Pilih unit <strong>SMP &amp; SMA Gabung</strong> agar otomatis ditandatangani <strong>Direktur</strong> (Kepsek SMA) + Bendahara.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PANDUAN KASIR */}
          {tab === 'KASIR' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-sky-950 dark:text-sky-200">
                  Akun <strong>Kasir Loket SPP</strong> langsung diarahkan ke tab <strong>1. Loket Kasir &amp; Kwitansi</strong> saat membuka menu ini agar pelayanan siswa di loket berjalan cepat tanpa gangguan menu pengaturan.
                </p>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  Langkah Cepat Melayani Pembayaran di Loket
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    [
                      '1. Cari Siswa',
                      'Ketik 2–3 huruf nama siswa atau NIS pada kotak "Cari & Pilih Siswa", lalu klik tombol nama siswa yang muncul.',
                    ],
                    [
                      '2. Pilih Nominal Cepat',
                      `Klik tombol "Syarat ${minPercentForExamCard}%" agar pas syarat Kartu Ujian, klik "Lunasi Semua", atau ketik nominal cicilan bebas.`,
                    ],
                    [
                      '3. Cek Simulasi Status',
                      'Perhatikan kotak biru Simulasi Pembayaran: pastikan status proyeksi berubah menjadi LAYAK atau LUNAS 100%.',
                    ],
                    [
                      '4. Simpan & Cetak Kwitansi',
                      'Pilih Metode (Tunai / Transfer), pastikan Format = 2 Rangkap/A4, klik Simpan lalu klik Cetak Kwitansi.',
                    ],
                  ].map(([title, desc]) => (
                    <div
                      key={title}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10"
                    >
                      <div className="font-black text-slate-900 dark:text-white">{title}</div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 space-y-1">
                  <div className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" /> SOP Tutup Kas Sore Hari
                  </div>
                  <p className="text-[11px] text-emerald-900/85 dark:text-emerald-200/85">
                    Klik <strong>Rekap Setoran per Kasir</strong> di bar atas Tab Kasir untuk melihat total <strong>Tunai</strong> &amp; <strong>Transfer</strong> atas nama Anda hari ini. Cocokkan dengan uang fisik di laci + Lembar 2 (Arsip Kwitansi), lalu serahkan ke Bendahara Sekolah.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 space-y-1">
                  <div className="font-black text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Jika Salah Ketik Nominal
                  </div>
                  <p className="text-[11px] text-rose-900/85 dark:text-rose-200/85">
                    Jangan input transaksi ganda! Catat <strong>Nomor Kwitansi</strong> (mis. <code>KW-202611-0012</code>) lalu laporkan ke <strong>Bendahara Sekolah</strong> agar di-<strong>VOID</strong> terlebih dahulu, baru input ulang nominal yang benar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FAQ & TIPS */}
          {tab === 'FAQ' && (
            <div className="space-y-3">
              {[
                {
                  q: 'Bagaimana pengaruhnya ke menu Kartu Peserta Ujian?',
                  a: `Panitia Ujian otomatis melihat badge hijau (Lunas / Layak ≥${minPercentForExamCard}% / Dispensasi) atau merah (Terkunci). Siswa yang belum memenuhi syarat tidak dapat dicetak kartunya selama opsi kunci aktif. Begitu Kasir menyimpan pembayaran ≥${minPercentForExamCard}%, Panitia cukup klik Muat Ulang dan kartu langsung bisa dicetak.`,
                  icon: IdCard,
                },
                {
                  q: 'Kenapa laporan SMP & SMA gabung bertuliskan "Direktur" bukan "Kepala Sekolah"?',
                  a: 'Sesuai struktur WMVAA, jika laporan dicetak khusus Unit SMP maka ditandatangani Kepala Sekolah SMP; khusus Unit SMA ditandatangani Kepala Sekolah SMA; sedangkan laporan Gabungan SMP & SMA otomatis memakai pimpinan tertinggi (Kepsek SMA) dengan jabatan Direktur.',
                  icon: FileSpreadsheet,
                },
                {
                  q: 'Apakah Kwitansi punya tanda tangan Kasir dan Bendahara sekaligus?',
                  a: 'Ya! Jika akun Kasir yang menginput pembayaran berbeda dengan Nama Bendahara di pengaturan, kwitansi otomatis menampilkan 2 kolom tanda tangan: Petugas Kasir (kiri) dan Mengetahui, Bendahara Sekolah (kanan, lengkap dengan TTD digital).',
                  icon: MessageSquare,
                },
                {
                  q: 'Bagaimana jika Bendahara merevisi angka sisa tagihan lewat Excel lagi?',
                  a: 'Aman! Selama kode periode postingnya sama, sistem otomatis memperbarui nominal siswa yang belum bayar (tanpa duplikat), dan melindungi siswa yang sudah memiliki pembayaran kasir lebih besar dari angka baru.',
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.q}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-1"
                  >
                    <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
                      {item.q}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-6">
                      {item.a}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10.5px] font-semibold text-slate-500 flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-emerald-600" />
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 font-mono text-[10px]">Esc</kbd> atau klik Tutup untuk kembali bekerja.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer"
          >
            Mengerti, Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
