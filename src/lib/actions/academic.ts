'use server';

import bcrypt from 'bcryptjs';
import {
  dbGetAll,
  dbReplaceSheetData,
  dbBatchUpdateRows,
  dbFindAndDeleteRow,
  clearSheetCache,
  generateId,
} from '@/lib/google-sheets';
import { requireAdmin } from '@/lib/session-server';
import { logger } from '@/lib/logger';
import { hitungSkorV3 } from '@/lib/ai/grader-engine';

export interface KurikulumMerdekaInitSummary {
  tahunAjaran: string;
  semester: string;
  totalKelas: number;
  totalMapel: number;
  totalGuru: number;
  totalSiswa: number;
  totalTugas: number;
  totalKunci: number;
  totalHasil: number;
}

/**
 * initializeKurikulumMerdeka2026Core
 * Fungsi inti untuk menyiapkan seluruh data awal Tahun Ajaran 2026/2027
 * Full Kurikulum Merdeka (Kelas VII SMP s/d Kelas XII SMA).
 * Dapat dipanggil baik dari Server Action Admin maupun endpoint /api/setup.
 */
export async function initializeKurikulumMerdeka2026Core(
  actorId: string = 'SYSTEM'
): Promise<KurikulumMerdekaInitSummary> {
  const tahunAjaran = '2026/2027';
  const semester = 'GANJIL';
  const nowIso = new Date().toISOString();

  // 1. SETTINGS — Konfigurasi penuh TA 2026/2027 Full Kurikulum Merdeka
  const settingsRows: [string, string][] = [
    ['tahun_ajaran', tahunAjaran],
    ['semester', semester],
    ['kurikulum', 'KURIKULUM MERDEKA (FASE D, E, F)'],
    ['nama_yayasan', 'YAYASAN PENDIDIKAN ADVENT PAPUA'],
    ['nama_sekolah_1', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'],
    ['nama_sekolah_2', 'SMP & SMA ADVENT SOGOKMO'],
    ['smp_nama_sekolah_1', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'],
    ['smp_nama_sekolah_2', 'SMP ADVENT SOGOKMO'],
    ['sma_nama_sekolah_1', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'],
    ['sma_nama_sekolah_2', 'SMA ADVENT SOGOKMO'],
    ['alamat_sekolah', 'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya'],
    ['logo_kiri_url', '/logo/logo_advent.png'],
    ['logo_kanan_url', '/logo/tut_wuri.png'],
    ['smp_logo_kiri_url', '/logo/logo_advent.png'],
    ['smp_logo_kanan_url', '/logo/tut_wuri.png'],
    ['sma_logo_kiri_url', '/logo/logo_advent.png'],
    ['sma_logo_kanan_url', '/logo/tut_wuri.png'],
    ['kkm_eksakta', '70'],
    ['kkm_non_eksakta', '75'],
    ['mapel_eksakta_keywords', 'IPA, Matematika, Fisika, Kimia, Biologi, Informatika'],
    ['ai_model', 'gemini-2.5-flash'],
    ['min_confidence', '60'],
    ['auto_sync', 'false'],
    ['smp_kepala_nama', 'Bpk. Daniel Walilo, M.Pd.'],
    ['smp_kepala_nip', '19840512 201001 1 008'],
    ['smp_panitia_nama', 'Ibu Ester Kogoya, S.Pd.'],
    ['smp_panitia_nip', '19880314 201403 2 005'],
    ['sma_kepala_nama', 'Pdt. Yohanes Asso, M.Fil.'],
    ['sma_kepala_nip', '19791103 200604 1 003'],
    ['sma_panitia_nama', 'Ibu Linda Wetapo, S.Pd.'],
    ['sma_panitia_nip', '19860721 201101 2 004'],
    ['kota_sekolah', 'Wamena'],
    ['ljk_essay_layout_default', 'integrated'],
    ['tampilkan_ttd_panitia', 'false'],
  ];

  // 2. KELAS — Full Kurikulum Merdeka dari Kelas 7 SMP (Fase D) s/d 12 SMA (Fase E & F)
  const kelasRows: [string, string, string, string, string][] = [
    ['KLS_VII', 'KELAS VII', 'SMP', tahunAjaran, semester],
    ['KLS_VIII', 'KELAS VIII', 'SMP', tahunAjaran, semester],
    ['KLS_IX', 'KELAS IX', 'SMP', tahunAjaran, semester],
    ['KLS_X', 'KELAS X', 'SMA', tahunAjaran, semester],
    ['KLS_XI', 'KELAS XI', 'SMA', tahunAjaran, semester],
    ['KLS_XII', 'KELAS XII', 'SMA', tahunAjaran, semester],
  ];

  // 3. MAPEL — Struktur Kurikulum Merdeka SMP & SMA Advent Sogokmo (Sesuai SK Penugasan)
  const mapelRows: [string, string][] = [
    ['MPL_AGM', 'Pendidikan Agama Kristen dan Budi Pekerti'],
    ['MPL_PKN', 'Pendidikan Pancasila'],
    ['MPL_BIN', 'Bahasa Indonesia'],
    ['MPL_ING', 'Bahasa Inggris'],
    ['MPL_MAT', 'Matematika'],
    ['MPL_IPA', 'Ilmu Pengetahuan Alam'],
    ['MPL_IPS', 'Ilmu Pengetahuan Sosial'],
    ['MPL_INF', 'Informatika'],
    ['MPL_KAI', 'Koding dan Kecerdasan Artifisial'],
    ['MPL_KES', 'Kesehatan'],
    ['MPL_PTH', 'Pathfinder'],
    ['MPL_PJK', 'Pendidikan Jasmani Olahraga dan Kesehatan'],
    ['MPL_SNB', 'Seni, Budaya, dan Prakarya'],
    ['MPL_EKO', 'Ekonomi'],
    ['MPL_GEO', 'Geografi'],
    ['MPL_SOS', 'Sosiologi'],
    ['MPL_FIS', 'Fisika'],
    ['MPL_KIM', 'Kimia'],
    ['MPL_BIO', 'Biologi'],
  ];

  // 4. USERS — Admin + 15 Dewan Guru Asli SMP & SMA Advent Sogokmo (TA 2026/2027)
  const adminHash = bcrypt.hashSync('admin123', 10);
  const guruHash = bcrypt.hashSync('guru12345', 10);

  const userRows: [string, string, string, string, string, string, string, string][] = [
    ['USR_ADMIN', 'admin', adminHash, 'ADMIN', 'Administrator Utama WMVAA', 'Aktif', '', 'admin123'],
    ['USR_GURU_01', 'anike.wetipo', guruHash, 'GURU', 'Anike Wetipo, S.Mis', 'Aktif', '', 'guru12345'],
    ['USR_GURU_02', 'florensia.manopo', guruHash, 'GURU', 'Florensia Saron Manopo', 'Aktif', '', 'guru12345'],
    ['USR_GURU_03', 'frengky.lokobal', guruHash, 'GURU', 'Frengky Lokobal', 'Aktif', '', 'guru12345'],
    ['USR_GURU_04', 'kayo.lokobal', guruHash, 'GURU', 'Kayo Lokobal, S.Pd', 'Aktif', '', 'guru12345'],
    ['USR_GURU_05', 'kevin.rori', guruHash, 'GURU', 'Kevin Geibel Rori, S.Pd', 'Aktif', '', 'guru12345'],
    ['USR_GURU_06', 'linda.wetapo', guruHash, 'GURU', 'Linda Wetapo, SE', 'Aktif', '', 'guru12345'],
    ['USR_GURU_07', 'maria.sinaga', guruHash, 'GURU', 'Maria Sinaga, S.Pd', 'Aktif', '', 'guru12345'],
    ['USR_GURU_08', 'marthen.refasi', guruHash, 'GURU', 'Marthen Refasi, S.Ag', 'Aktif', '', 'guru12345'],
    ['USR_GURU_09', 'martin.risakotta', guruHash, 'GURU', 'Martin Risakotta, S.Pd', 'Aktif', '', 'guru12345'],
    ['USR_GURU_10', 'natalia.tabuni', guruHash, 'GURU', 'Pdt. Natalia Tabuni, S.Th', 'Aktif', '', 'guru12345'],
    ['USR_GURU_11', 'saray.barusa', guruHash, 'GURU', 'Saray Barusa, S.Pd', 'Aktif', '', 'guru12345'],
    ['USR_GURU_12', 'sarlota.yansip', guruHash, 'GURU', 'Sarlota Yansip, S.Pd', 'Aktif', '', 'guru12345'],
    ['USR_GURU_13', 'steven.corputty', guruHash, 'GURU', 'Steven Pieter Rumbiak Corputty, ST', 'Aktif', '', 'guru12345'],
    ['USR_GURU_14', 'vero.wetipo', guruHash, 'GURU', 'Vero Wetipo, S.Tr.M', 'Aktif', '', 'guru12345'],
    ['USR_GURU_15', 'yohanis.ondy', guruHash, 'GURU', 'Yohanis Ondy, S.Fil', 'Aktif', '', 'guru12345'],
  ];

  // 5. SISWA — 122 Siswa Asli SMP (77 Siswa) & SMA (45 Siswa) Advent Sogokmo TA 2026/2027 Ganjil
  // Format: [id_siswa, nis, nama, id_kelas, tahun_ajaran, semester]
  const rawSiswaList: [string, string, string][] = [
    // ── SMP KELAS VII (27 Siswa) ──
    ['774', 'ABINUS ILIGTAMON', 'KLS_VII'],
    ['775', 'ABRAHAM ASSO', 'KLS_VII'],
    ['776', 'AGU WETAPO', 'KLS_VII'],
    ['777', 'ANDO ITLAY', 'KLS_VII'],
    ['778', 'ASTRID NOVELA ASSO', 'KLS_VII'],
    ['779', 'ATINA MULAIT', 'KLS_VII'],
    ['780', 'BESAN KUWAN', 'KLS_VII'],
    ['781', 'ELLA SIEP', 'KLS_VII'],
    ['782', 'JELPI ASSO', 'KLS_VII'],
    ['783', 'JHONEA MYRONEL ARON WETAPO', 'KLS_VII'],
    ['784', 'KOLO ASSO', 'KLS_VII'],
    ['785', 'LIA ASSO', 'KLS_VII'],
    ['786', 'LUSIANA ASSO', 'KLS_VII'],
    ['787', 'MARLIN ASSO', 'KLS_VII'],
    ['788', 'MIRA ASSO', 'KLS_VII'],
    ['789', 'NAFTALIS NEKAGAREK ITLAY', 'KLS_VII'],
    ['790', 'NATALIA SIEP', 'KLS_VII'],
    ['791', 'NIEL MATUAN', 'KLS_VII'],
    ['792', 'NIKELA ASSO', 'KLS_VII'],
    ['793', 'NIKO LOKOBAL', 'KLS_VII'],
    ['794', 'PERINA ASSO', 'KLS_VII'],
    ['795', 'PITA LOKOBAL', 'KLS_VII'],
    ['796', 'RAHEL MARSELAH ASSO', 'KLS_VII'],
    ['797', 'RIFKA MULAIT', 'KLS_VII'],
    ['798', 'SIBER LOKOBAL', 'KLS_VII'],
    ['799', 'YEHOL KUAN', 'KLS_VII'],
    ['800', 'YUBE SIEP', 'KLS_VII'],

    // ── SMP KELAS VIII (23 Siswa) ──
    ['751', 'ABRI LOKOBAL', 'KLS_VIII'],
    ['752', 'ARDON ASSO', 'KLS_VIII'],
    ['753', 'BETO LOKOBAL', 'KLS_VIII'],
    ['754', 'BOAS WAMU', 'KLS_VIII'],
    ['755', 'EJI WAMU', 'KLS_VIII'],
    ['756', 'ELIMELEK ASSO', 'KLS_VIII'],
    ['757', 'ERIK LOKOBAL', 'KLS_VIII'],
    ['758', 'ICA LOKOBAL', 'KLS_VIII'],
    ['759', 'IFAN PIE YEHESKIEL WETAPO', 'KLS_VIII'],
    ['760', 'IRNA WETAPO', 'KLS_VIII'],
    ['761', 'JAMES ASSO', 'KLS_VIII'],
    ['762', 'JEFRI WETAPO', 'KLS_VIII'],
    ['763', 'LAEN ASSO', 'KLS_VIII'],
    ['764', 'MALKI LOKOBAL', 'KLS_VIII'],
    ['765', 'MARLIN ASSO', 'KLS_VIII'],
    ['766', 'MARNEL WETAPO', 'KLS_VIII'],
    ['767', 'PASKALIS WETAPO', 'KLS_VIII'],
    ['768', 'PUTRI ASSO', 'KLS_VIII'],
    ['769', 'RIPA ASSO', 'KLS_VIII'],
    ['770', 'SALPINUS WETAPO', 'KLS_VIII'],
    ['771', 'SEMEKIUS LOKOBAL', 'KLS_VIII'],
    ['772', 'SIKELA MULAIT', 'KLS_VIII'],
    ['773', 'YANTI WETAPO', 'KLS_VIII'],

    // ── SMP KELAS IX (27 Siswa) ──
    ['722', 'ADETO KUWAN', 'KLS_IX'],
    ['723', 'AGUS ASSO', 'KLS_IX'],
    ['724', 'ALEN ITLAY', 'KLS_IX'],
    ['725', 'ALESTINA WETAPO', 'KLS_IX'],
    ['726', 'AULIA WETIPO', 'KLS_IX'],
    ['727', 'BRAYEN WETAPO', 'KLS_IX'],
    ['707', 'DARO ASSO', 'KLS_IX'],
    ['728', 'DINU WETAPO', 'KLS_IX'],
    ['729', 'EFRAT LOKOBAL', 'KLS_IX'],
    ['708', 'ELPIANA KUWAN', 'KLS_IX'],
    ['731', 'ERSON BAHABOL', 'KLS_IX'],
    ['709', 'GRESIA SABATINA MATUAN', 'KLS_IX'],
    ['710', 'HANISA ASSO', 'KLS_IX'],
    ['732', 'HANSON ASSO', 'KLS_IX'],
    ['711', 'HENDRA WAMU', 'KLS_IX'],
    ['733', 'HILIKO ASSO', 'KLS_IX'],
    ['712', 'IKA ASSO', 'KLS_IX'],
    ['713', 'JERICHO F BIHOY', 'KLS_IX'],
    ['714', 'KEPSON WETIPO', 'KLS_IX'],
    ['715', 'LUIS KUWAN', 'KLS_IX'],
    ['734', 'MARLON MATUAN', 'KLS_IX'],
    ['718', 'NINUS WETAPO', 'KLS_IX'],
    ['736', 'SAPRON WETAPO', 'KLS_IX'],
    ['719', 'TIMINA MATUAN', 'KLS_IX'],
    ['720', 'UNHE LISHE WETAPO', 'KLS_IX'],
    ['737', 'WELIMUS WETAPO', 'KLS_IX'],
    ['721', 'YANI ASSO', 'KLS_IX'],

    // ── SMA KELAS X / 10 (20 Siswa) ──
    ['000421', 'AGUS ANTO DELKA', 'KLS_X'],
    ['000422', 'ARMAN MULAIT', 'KLS_X'],
    ['000423', 'DEPKON KAKADI', 'KLS_X'],
    ['000424', 'DESPINA WETIPO', 'KLS_X'],
    ['000425', 'DEVOK YAMDAL', 'KLS_X'],
    ['000426', 'ELON MATUAN', 'KLS_X'],
    ['000427', 'GOSWIN KAKADI', 'KLS_X'],
    ['000428', 'HEBRON ASSO', 'KLS_X'],
    ['000429', 'KIMBERLY CANTIKA C. ASARIBAB', 'KLS_X'],
    ['000430', 'KONA ASSO', 'KLS_X'],
    ['000431', 'MARIK KUWAN', 'KLS_X'],
    ['000432', 'MARTON ILINTAMON', 'KLS_X'],
    ['000433', 'MELINA KUWAN', 'KLS_X'],
    ['000434', 'NATAN LOKOBAL', 'KLS_X'],
    ['000435', 'NOPERIUS YUAL', 'KLS_X'],
    ['000436', 'OPIANUS ASSO', 'KLS_X'],
    ['000437', 'QUINCY KAKADI', 'KLS_X'],
    ['000438', 'TAKLIPKI KAKADI', 'KLS_X'],
    ['000439', 'YEKISON KUWAN', 'KLS_X'],
    ['000440', 'JAMES MARZELLO WAROPEN', 'KLS_X'],

    // ── SMA KELAS XI / 11 (12 Siswa) ──
    ['000406', 'AGUSTINA LOKOBAL', 'KLS_XI'],
    ['000408', 'DETO DEMIUS DELKA', 'KLS_XI'],
    ['000409', 'IBE WETIPO', 'KLS_XI'],
    ['000410', 'KENDY MULAIT', 'KLS_XI'],
    ['000411', 'MARVEL ASSO', 'KLS_XI'],
    ['000412', 'NOBELIUS YUAL', 'KLS_XI'],
    ['000413', 'ONIUS ASSO', 'KLS_XI'],
    ['000414', 'PIRIUS ASSO', 'KLS_XI'],
    ['000415', 'TEKIU WETAPO', 'KLS_XI'],
    ['000416', 'TERNA SIEP', 'KLS_XI'],
    ['000419', 'NYANYU WETIPO', 'KLS_XI'],
    ['000001', 'MELIANUS LOKOBAL', 'KLS_XI'],

    // ── SMA KELAS XII / 12 (13 Siswa) ──
    ['000387', 'EKO TEPMUL', 'KLS_XII'],
    ['000388', 'FADIEN KRISBA KREY', 'KLS_XII'],
    ['000390', 'GLORIA ASSO', 'KLS_XII'],
    ['000391', 'IPAN WETIPO', 'KLS_XII'],
    ['000392', 'JUEN ASSO', 'KLS_XII'],
    ['000395', 'LAMEKA KAHANG', 'KLS_XII'],
    ['000396', 'PANUS ILINTAMON', 'KLS_XII'],
    ['000397', 'SELLA LOKOBAL', 'KLS_XII'],
    ['000398', 'SILA ASSO', 'KLS_XII'],
    ['000399', 'WENIUS WETIPO', 'KLS_XII'],
    ['000400', 'YANTI ASSO', 'KLS_XII'],
    ['000401', 'YULITA LOKOBAL', 'KLS_XII'],
    ['000405', 'SINAIDI ASSO', 'KLS_XII'],
  ];

  const siswaRows: [string, string, string, string, string, string][] = rawSiswaList.map(
    ([nis, nama, idKelas]) => [`SIS_${nis}`, nis, nama, idKelas, tahunAjaran, semester]
  );

  // 6. TUGAS_GURU — Penugasan Mengajar Resmi TA 2026/2027 (SMP SK_X_2025 + SMA Master Guru)
  // Format: [id_tugas, id_user, id_mapel, id_kelas, tahun_ajaran, semester]
  const rawTugasList: [string, string, string][] = [
    // ── PENUGASAN SMP KELAS IX (Sesuai Penugasan_01_SMP-SGO_SK_X_2025.csv) ──
    ['USR_GURU_10', 'MPL_AGM', 'KLS_IX'], // Natalia Tabuni - Agama IX
    ['USR_GURU_01', 'MPL_BIN', 'KLS_IX'], // Anike Wetipo - B. Indonesia IX
    ['USR_GURU_07', 'MPL_ING', 'KLS_IX'], // Maria Sinaga - B. Inggris IX
    ['USR_GURU_04', 'MPL_INF', 'KLS_IX'], // Kayo Lokobal - Informatika IX
    ['USR_GURU_13', 'MPL_IPA', 'KLS_IX'], // Steven Corputty - IPA IX
    ['USR_GURU_11', 'MPL_IPS', 'KLS_IX'], // Saray Barusa - IPS IX
    ['USR_GURU_03', 'MPL_KAI', 'KLS_IX'], // Frengky Lokobal - Koding & AI IX
    ['USR_GURU_15', 'MPL_KES', 'KLS_IX'], // Yohanis Ondy - Kesehatan IX
    ['USR_GURU_05', 'MPL_MAT', 'KLS_IX'], // Kevin Geibel Rori - Matematika IX
    ['USR_GURU_07', 'MPL_PTH', 'KLS_IX'], // Maria Sinaga - Pathfinder IX
    ['USR_GURU_09', 'MPL_PJK', 'KLS_IX'], // Martin Risakotta - PJOK IX
    ['USR_GURU_14', 'MPL_PKN', 'KLS_IX'], // Vero Wetipo - Pendidikan Pancasila IX
    ['USR_GURU_08', 'MPL_SNB', 'KLS_IX'], // Marthen Refasi - SBdP IX

    // ── PENUGASAN SMP KELAS VII (Sesuai Penugasan_01_SMP-SGO_SK_X_2025.csv) ──
    ['USR_GURU_10', 'MPL_AGM', 'KLS_VII'], // Natalia Tabuni - Agama VII
    ['USR_GURU_01', 'MPL_BIN', 'KLS_VII'], // Anike Wetipo - B. Indonesia VII
    ['USR_GURU_02', 'MPL_ING', 'KLS_VII'], // Florensia Saron Manopo - B. Inggris VII
    ['USR_GURU_04', 'MPL_INF', 'KLS_VII'], // Kayo Lokobal - Informatika VII
    ['USR_GURU_13', 'MPL_IPA', 'KLS_VII'], // Steven Corputty - IPA VII
    ['USR_GURU_11', 'MPL_IPS', 'KLS_VII'], // Saray Barusa - IPS VII
    ['USR_GURU_03', 'MPL_KAI', 'KLS_VII'], // Frengky Lokobal - Koding & AI VII
    ['USR_GURU_15', 'MPL_KES', 'KLS_VII'], // Yohanis Ondy - Kesehatan VII
    ['USR_GURU_05', 'MPL_MAT', 'KLS_VII'], // Kevin Geibel Rori - Matematika VII
    ['USR_GURU_15', 'MPL_PTH', 'KLS_VII'], // Yohanis Ondy - Pathfinder VII
    ['USR_GURU_09', 'MPL_PJK', 'KLS_VII'], // Martin Risakotta - PJOK VII
    ['USR_GURU_14', 'MPL_PKN', 'KLS_VII'], // Vero Wetipo - Pendidikan Pancasila VII
    ['USR_GURU_12', 'MPL_SNB', 'KLS_VII'], // Sarlota Yansip - SBdP VII

    // ── PENUGASAN SMP KELAS VIII (Sesuai Penugasan_01_SMP-SGO_SK_X_2025.csv) ──
    ['USR_GURU_09', 'MPL_AGM', 'KLS_VIII'], // Martin Risakotta - Agama VIII
    ['USR_GURU_01', 'MPL_BIN', 'KLS_VIII'], // Anike Wetipo - B. Indonesia VIII
    ['USR_GURU_07', 'MPL_ING', 'KLS_VIII'], // Maria Sinaga - B. Inggris VIII
    ['USR_GURU_04', 'MPL_INF', 'KLS_VIII'], // Kayo Lokobal - Informatika VIII
    ['USR_GURU_13', 'MPL_IPA', 'KLS_VIII'], // Steven Corputty - IPA VIII
    ['USR_GURU_11', 'MPL_IPS', 'KLS_VIII'], // Saray Barusa - IPS VIII
    ['USR_GURU_03', 'MPL_KAI', 'KLS_VIII'], // Frengky Lokobal - Koding & AI VIII
    ['USR_GURU_15', 'MPL_KES', 'KLS_VIII'], // Yohanis Ondy - Kesehatan VIII
    ['USR_GURU_05', 'MPL_MAT', 'KLS_VIII'], // Kevin Geibel Rori - Matematika VIII
    ['USR_GURU_12', 'MPL_PTH', 'KLS_VIII'], // Sarlota Yansip - Pathfinder VIII
    ['USR_GURU_09', 'MPL_PJK', 'KLS_VIII'], // Martin Risakotta - PJOK VIII
    ['USR_GURU_14', 'MPL_PKN', 'KLS_VIII'], // Vero Wetipo - Pendidikan Pancasila VIII
    ['USR_GURU_12', 'MPL_SNB', 'KLS_VIII'], // Sarlota Yansip - SBdP VIII

    // ── PENUGASAN SMA KELAS X, XI, XII (Sesuai Master Guru SMA Advent Sogokmo) ──
    // Yohanis Ondy, S.Fil (Agama SMA)
    ['USR_GURU_15', 'MPL_AGM', 'KLS_X'],
    ['USR_GURU_15', 'MPL_AGM', 'KLS_XI'],
    ['USR_GURU_15', 'MPL_AGM', 'KLS_XII'],
    // Linda Wetapo, SE (PKn, Ekonomi, Kesehatan X-XI)
    ['USR_GURU_06', 'MPL_PKN', 'KLS_X'],
    ['USR_GURU_06', 'MPL_PKN', 'KLS_XI'],
    ['USR_GURU_06', 'MPL_PKN', 'KLS_XII'],
    ['USR_GURU_06', 'MPL_EKO', 'KLS_X'],
    ['USR_GURU_06', 'MPL_EKO', 'KLS_XI'],
    ['USR_GURU_06', 'MPL_EKO', 'KLS_XII'],
    ['USR_GURU_06', 'MPL_KES', 'KLS_X'],
    ['USR_GURU_06', 'MPL_KES', 'KLS_XI'],
    // Marthen Refasi, S.Ag (Kesehatan XII & SBdP XII)
    ['USR_GURU_08', 'MPL_KES', 'KLS_XII'],
    ['USR_GURU_08', 'MPL_SNB', 'KLS_XII'],
    // Pdt. Natalia Tabuni, S.Th (SBdP X) & Kayo Lokobal, S.Pd (SBdP XI)
    ['USR_GURU_10', 'MPL_SNB', 'KLS_X'],
    ['USR_GURU_04', 'MPL_SNB', 'KLS_XI'],
    // Sarlota Yansip, S.Pd (Bahasa Indonesia SMA & Geografi XI-XII)
    ['USR_GURU_12', 'MPL_BIN', 'KLS_X'],
    ['USR_GURU_12', 'MPL_BIN', 'KLS_XI'],
    ['USR_GURU_12', 'MPL_BIN', 'KLS_XII'],
    ['USR_GURU_12', 'MPL_GEO', 'KLS_X'],
    ['USR_GURU_12', 'MPL_GEO', 'KLS_XI'],
    ['USR_GURU_12', 'MPL_GEO', 'KLS_XII'],
    // Maria Sinaga, S.Pd (Bahasa Inggris SMA)
    ['USR_GURU_07', 'MPL_ING', 'KLS_X'],
    ['USR_GURU_07', 'MPL_ING', 'KLS_XI'],
    ['USR_GURU_07', 'MPL_ING', 'KLS_XII'],
    // Kevin Geibel Rori, S.Pd (Matematika SMA)
    ['USR_GURU_05', 'MPL_MAT', 'KLS_X'],
    ['USR_GURU_05', 'MPL_MAT', 'KLS_XI'],
    ['USR_GURU_05', 'MPL_MAT', 'KLS_XII'],
    // Frengky Lokobal (Informatika SMA, Koding & AI SMA)
    ['USR_GURU_03', 'MPL_INF', 'KLS_X'],
    ['USR_GURU_03', 'MPL_INF', 'KLS_XI'],
    ['USR_GURU_03', 'MPL_INF', 'KLS_XII'],
    ['USR_GURU_03', 'MPL_KAI', 'KLS_X'],
    ['USR_GURU_03', 'MPL_KAI', 'KLS_XI'],
    ['USR_GURU_03', 'MPL_KAI', 'KLS_XII'],
    // Steven Pieter Rumbiak Corputty, ST (PJOK SMA)
    ['USR_GURU_13', 'MPL_PJK', 'KLS_X'],
    ['USR_GURU_13', 'MPL_PJK', 'KLS_XI'],
    ['USR_GURU_13', 'MPL_PJK', 'KLS_XII'],
    // Vero Wetipo, S.Tr.M (Sosiologi SMA)
    ['USR_GURU_14', 'MPL_SOS', 'KLS_X'],
    ['USR_GURU_14', 'MPL_SOS', 'KLS_XI'],
    ['USR_GURU_14', 'MPL_SOS', 'KLS_XII'],
  ];

  const tugasRows: [string, string, string, string, string, string][] = rawTugasList.map(
    ([idUser, idMapel, idKelas], idx) => [
      `TGS_26_${String(idx + 1).padStart(2, '0')}`,
      idUser,
      idMapel,
      idKelas,
      tahunAjaran,
      semester,
    ]
  );

  // 7. KUNCI_JAWABAN — Kunci Jawaban Resmi STS Ganjil 2026/2027
  // Koding & Kecerdasan Artifisial - Kelas XII SMA (Guru: Frengky Lokobal - USR_GURU_03)
  // Sumber: D:\STS 2026\SOAL\.SUDAH CETAK & INPUT\14. Sir frengky\Koding & KA - Kelas 12.docx
  const kunciKodingKelas12: any[] = [
    // Bagian A: Pilihan Ganda (No. 1 - 30)
    { no: 1, tipe: 'single_choice_4', jawaban: 'C', opsi: ['A', 'B', 'C', 'D'] },
    { no: 2, tipe: 'single_choice_4', jawaban: 'D', opsi: ['A', 'B', 'C', 'D'] },
    { no: 3, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    { no: 4, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    { no: 5, tipe: 'single_choice_4', jawaban: 'B', opsi: ['A', 'B', 'C', 'D'] },
    { no: 6, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    { no: 7, tipe: 'single_choice', jawaban: 'B', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 8, tipe: 'single_choice_4', jawaban: 'C', opsi: ['A', 'B', 'C', 'D'] },
    { no: 9, tipe: 'single_choice_4', jawaban: 'B', opsi: ['A', 'B', 'C', 'D'] },
    { no: 10, tipe: 'single_choice_4', jawaban: 'D', opsi: ['A', 'B', 'C', 'D'] },
    { no: 11, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 12, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 13, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 14, tipe: 'single_choice', jawaban: 'A', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 15, tipe: 'single_choice', jawaban: 'A', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 16, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 17, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 18, tipe: 'single_choice', jawaban: 'B', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 19, tipe: 'single_choice', jawaban: 'D', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 20, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 21, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 22, tipe: 'single_choice', jawaban: 'D', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 23, tipe: 'single_choice', jawaban: 'B', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 24, tipe: 'single_choice', jawaban: 'C', opsi: ['A', 'B', 'C', 'D', 'E'] },
    { no: 25, tipe: 'single_choice_4', jawaban: 'C', opsi: ['A', 'B', 'C', 'D'] },
    { no: 26, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    { no: 27, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    { no: 28, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    { no: 29, tipe: 'single_choice_4', jawaban: 'C', opsi: ['A', 'B', 'C', 'D'] },
    { no: 30, tipe: 'single_choice_4', jawaban: 'A', opsi: ['A', 'B', 'C', 'D'] },
    // Bagian B: Benar / Salah (No. 31 - 40)
    { no: 31, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 32, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 33, tipe: 'true_false', jawaban: 'S', opsi: ['B', 'S'] },
    { no: 34, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 35, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 36, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 37, tipe: 'true_false', jawaban: 'S', opsi: ['B', 'S'] },
    { no: 38, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 39, tipe: 'true_false', jawaban: 'B', opsi: ['B', 'S'] },
    { no: 40, tipe: 'true_false', jawaban: 'S', opsi: ['B', 'S'] },
  ];

  const kunciSegmenKoding12 = [
    { mulai: 1, selesai: 6, tipe: 'single_choice_4' },
    { mulai: 7, selesai: 7, tipe: 'single_choice' },
    { mulai: 8, selesai: 10, tipe: 'single_choice_4' },
    { mulai: 11, selesai: 24, tipe: 'single_choice' },
    { mulai: 25, selesai: 30, tipe: 'single_choice_4' },
    { mulai: 31, selesai: 40, tipe: 'true_false' },
  ];

  const kunciRows: any[][] = [
    [
      'KODKA-12-2627',
      'USR_GURU_03',
      'MPL_KAI',
      'KLS_XII',
      'STS Ganjil - Koding & Kecerdasan Artifisial Kelas XII',
      'single_choice',
      JSON.stringify({ benar: 1, salah: 0, kosong: 0 }),
      JSON.stringify(kunciKodingKelas12),
      nowIso,
      JSON.stringify(kunciSegmenKoding12),
      tahunAjaran,
      semester,
    ],
  ];
  const hasilRows: any[][] = [];

  // Tulis ulang seluruh tabel secara atomik
  await dbReplaceSheetData('SETTINGS', ['key', 'value'], settingsRows);
  await dbReplaceSheetData('KELAS', ['id_kelas', 'nama_kelas', 'jenjang', 'tahun_ajaran', 'semester'], kelasRows);
  await dbReplaceSheetData('MAPEL', ['id_mapel', 'nama_mapel'], mapelRows);
  await dbReplaceSheetData('USERS', ['id_user', 'username', 'password_hash', 'role', 'nama', 'status', 'profile_url', 'password_plain'], userRows);
  await dbReplaceSheetData('SISWA', ['id_siswa', 'nis', 'nama', 'id_kelas', 'tahun_ajaran', 'semester'], siswaRows);
  await dbReplaceSheetData('TUGAS_GURU', ['id_tugas', 'id_user', 'id_mapel', 'id_kelas', 'tahun_ajaran', 'semester'], tugasRows);
  await dbReplaceSheetData(
    'KUNCI_JAWABAN',
    ['id_kunci', 'id_guru', 'id_mapel', 'id_kelas', 'judul_ujian', 'tipe_soal', 'pengaturan_poin', 'data_json', 'timestamp', 'segmen', 'tahun_ajaran', 'semester'],
    kunciRows
  );
  await dbReplaceSheetData(
    'HASIL',
    ['id_hasil', 'id_kunci', 'id_siswa', 'id_guru', 'skor', 'detail_json', 'timestamp', 'is_override', 'override_reason', 'tahun_ajaran', 'semester'],
    hasilRows
  );

  clearSheetCache();
  await logger.warn(
    'INIT_TA_2026_2027',
    `Inisialisasi penuh Tahun Ajaran ${tahunAjaran} (${semester}) Full Kurikulum Merdeka (Kelas VII SMP - XII SMA) selesai.`,
    actorId
  );

  return {
    tahunAjaran,
    semester,
    totalKelas: kelasRows.length,
    totalMapel: mapelRows.length,
    totalGuru: userRows.filter(u => u[3] === 'GURU').length,
    totalSiswa: siswaRows.length,
    totalTugas: tugasRows.length,
    totalKunci: kunciRows.length,
    totalHasil: hasilRows.length,
  };
}

/**
 * Server Action untuk Admin: Reset & Siapkan Data Awal TA 2026/2027 Full Kurikulum Merdeka
 */
export async function initializeKurikulumMerdeka2026Action() {
  try {
    const session = await requireAdmin();
    const summary = await initializeKurikulumMerdeka2026Core(session.id);
    return {
      success: true,
      data: summary,
      message: `Tahun Ajaran ${summary.tahunAjaran} (${summary.semester}) Full Kurikulum Merdeka berhasil disiapkan! (${summary.totalKelas} Kelas, ${summary.totalMapel} Mapel, ${summary.totalGuru} Guru, ${summary.totalSiswa} Siswa, ${summary.totalKunci} Kunci Ujian).`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * Wizard Kenaikan Kelas Otomatis (Naik Kelas Massal VII->VIII, VIII->IX, IX->X/Lulus, X->XI, XI->XII, XII->Lulus)
 */
export async function promoteStudentsWizardAction(options: {
  targetTahunAjaran: string;
  targetSemester: 'GANJIL' | 'GENAP';
  promoteGrade9ToGrade10: boolean; // Jika true, lulusan IX SMP otomatis masuk Kelas X SMA
  graduateGrade12: boolean;        // Jika true, siswa Kelas XII SMA lulus (dihapus dari daftar aktif)
}) {
  try {
    const session = await requireAdmin();
    const targetTahun = String(options.targetTahunAjaran || '2026/2027').trim();
    const targetSem = String(options.targetSemester || 'GANJIL').trim().toUpperCase();

    const [allKelas, allSiswa, allSettings] = await Promise.all([
      dbGetAll('KELAS'),
      dbGetAll('SISWA'),
      dbGetAll('SETTINGS'),
    ]);

    const findKelasByGrade = (gradeRoman: string) => {
      return allKelas.find(k => {
        const norm = String(k.nama_kelas || '').toUpperCase().replace(/^KELAS\s+/i, '').trim();
        return norm === gradeRoman || norm.startsWith(gradeRoman + ' ');
      });
    };

    const klsVII = findKelasByGrade('VII');
    const klsVIII = findKelasByGrade('VIII');
    const klsIX = findKelasByGrade('IX');
    const klsX = findKelasByGrade('X');
    const klsXI = findKelasByGrade('XI');
    const klsXII = findKelasByGrade('XII');

    let promotedCount = 0;
    let graduatedCount = 0;
    const updates: { id: string; values: (string | number | boolean)[] }[] = [];
    const idsToDelete: string[] = [];

    for (const s of allSiswa) {
      const currentKelas = allKelas.find(k => String(k.id_kelas) === String(s.id_kelas));
      const normName = String(currentKelas?.nama_kelas || '').toUpperCase().replace(/^KELAS\s+/i, '').trim();

      let nextKelasId: string | null = null;
      let isGraduating = false;

      if (normName.startsWith('XII')) {
        if (options.graduateGrade12) isGraduating = true;
      } else if (normName.startsWith('XI') && klsXII) {
        nextKelasId = klsXII.id_kelas;
      } else if (normName.startsWith('X') && !normName.startsWith('XI') && klsXI) {
        nextKelasId = klsXI.id_kelas;
      } else if (normName.startsWith('IX')) {
        if (options.promoteGrade9ToGrade10 && klsX) {
          nextKelasId = klsX.id_kelas;
        } else {
          isGraduating = true;
        }
      } else if (normName.startsWith('VIII') && klsIX) {
        nextKelasId = klsIX.id_kelas;
      } else if (normName.startsWith('VII') && !normName.startsWith('VIII') && klsVIII) {
        nextKelasId = klsVIII.id_kelas;
      }

      if (isGraduating) {
        idsToDelete.push(s.id_siswa);
        graduatedCount++;
      } else if (nextKelasId) {
        updates.push({
          id: s.id_siswa,
          values: [s.id_siswa, s.nis, s.nama, nextKelasId, targetTahun, targetSem],
        });
        promotedCount++;
      } else {
        // Tetap di kelas saat ini namun perbarui Tahun Ajaran & Semester
        updates.push({
          id: s.id_siswa,
          values: [s.id_siswa, s.nis, s.nama, s.id_kelas, targetTahun, targetSem],
        });
      }
    }

    if (updates.length > 0) {
      await dbBatchUpdateRows('SISWA', updates);
    }

    for (const id of idsToDelete) {
      try {
        await dbFindAndDeleteRow('SISWA', id);
      } catch {
        // Abaikan jika siswa memiliki riwayat nilai
      }
    }

    // Update tahun_ajaran & semester pada seluruh KELAS
    const kelasUpdates = allKelas.map(k => ({
      id: String(k.id_kelas),
      values: [k.id_kelas, k.nama_kelas, k.jenjang || 'SMA', targetTahun, targetSem],
    }));
    if (kelasUpdates.length > 0) {
      await dbBatchUpdateRows('KELAS', kelasUpdates);
    }

    // Update SETTINGS aktif
    const settingsMap = new Map<string, string>();
    allSettings.forEach(r => {
      if (r.key) settingsMap.set(String(r.key), String(r.value ?? ''));
    });
    settingsMap.set('tahun_ajaran', targetTahun);
    settingsMap.set('semester', targetSem);
    await dbReplaceSheetData(
      'SETTINGS',
      ['key', 'value'],
      Array.from(settingsMap.entries()).map(([k, v]) => [k, v])
    );

    clearSheetCache();
    await logger.warn(
      'PROMOTE_CLASSES',
      `Kenaikan kelas massal ke TA ${targetTahun} (${targetSem}): ${promotedCount} siswa naik tingkat, ${graduatedCount} siswa lulus.`,
      session.id
    );

    return {
      success: true,
      promotedCount,
      graduatedCount,
      message: `Kenaikan Kelas ke TA ${targetTahun} (${targetSem}) berhasil! ${promotedCount} siswa naik kelas, ${graduatedCount} siswa lulus.`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
