-- ============================================================================
-- WMVAA AI Grader Pro - Migrasi SQL Aman untuk Hosting (phpMyAdmin / MySQL)
-- Fitur: Modul Tagihan Biaya Sekolah (SPP & Ujian) + Integrasi Kartu Peserta
-- Bonus: Perbaikan tipe kolom KUNCI_JAWABAN.segmen (VARCHAR(128) -> TEXT)
-- Catatan:
--   1. TIDAK mengubah/menghapus data pada tabel lama
--   2. Idempoten (aman dijalankan ulang berkali-kali tanpa warning duplikat)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Buat tabel TAGIHAN (per siswa per periode/kategori biaya)
CREATE TABLE IF NOT EXISTS `TAGIHAN` (
  `id_tagihan` VARCHAR(64) NOT NULL,
  `id_siswa` VARCHAR(64) NOT NULL,
  `tahun_ajaran` VARCHAR(32) DEFAULT '',
  `semester` VARCHAR(32) DEFAULT '',
  `kategori` VARCHAR(64) DEFAULT 'SPP',
  `periode_bulan` VARCHAR(32) DEFAULT '',
  `nama_tagihan` VARCHAR(160) NOT NULL,
  `nominal` BIGINT NOT NULL DEFAULT 0,
  `potongan` BIGINT NOT NULL DEFAULT 0,
  `nominal_akhir` BIGINT NOT NULL DEFAULT 0,
  `terbayar` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'BELUM_BAYAR',
  `jatuh_tempo` VARCHAR(32) DEFAULT '',
  `catatan` TEXT,
  `updated_at` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (`id_tagihan`),
  INDEX `idx_tagihan_siswa` (`id_siswa`),
  INDEX `idx_tagihan_tahun_sem` (`tahun_ajaran`, `semester`),
  INDEX `idx_tagihan_periode` (`periode_bulan`),
  INDEX `idx_tagihan_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Buat tabel PEMBAYARAN (riwayat setoran/cicilan & kwitansi resmi)
CREATE TABLE IF NOT EXISTS `PEMBAYARAN` (
  `id_pembayaran` VARCHAR(64) NOT NULL,
  `no_kwitansi` VARCHAR(64) NOT NULL,
  `id_tagihan` VARCHAR(64) NOT NULL,
  `id_siswa` VARCHAR(64) NOT NULL,
  `tanggal_bayar` VARCHAR(32) DEFAULT '',
  `nominal_bayar` BIGINT NOT NULL DEFAULT 0,
  `metode` VARCHAR(32) DEFAULT 'TUNAI',
  `status_transaksi` VARCHAR(32) NOT NULL DEFAULT 'VALID',
  `id_petugas` VARCHAR(64) DEFAULT '',
  `nama_petugas` VARCHAR(128) DEFAULT '',
  `catatan` TEXT,
  `timestamp` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (`id_pembayaran`),
  INDEX `idx_bayar_kwitansi` (`no_kwitansi`),
  INDEX `idx_bayar_tagihan` (`id_tagihan`),
  INDEX `idx_bayar_siswa` (`id_siswa`),
  INDEX `idx_bayar_tanggal` (`tanggal_bayar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Inisialisasi konfigurasi default modul keuangan di SETTINGS (tidak menimpa nilai lama)
INSERT INTO `SETTINGS` (`key`, `value`) VALUES
  ('keuangan_config_json', '{"tarifSppSmp":0,"tarifSppSma":0,"minPercentForExamCard":50,"enforceOnKartuPeserta":true,"examRequiredPeriods":[],"bendaharaNama":"","bendaharaNip":"","bendaharaJabatan":"Bendahara Sekolah","bendaharaTtdUrl":"","rekeningInfo":"","catatanKwitansi":"Simpan kwitansi ini sebagai bukti pembayaran resmi biaya sekolah.","dispensasiBySiswaId":{}}'),
  ('kartu_back_mirror_duplex', 'true')
ON DUPLICATE KEY UPDATE `value` = `SETTINGS`.`value`;

-- 4. Perbaikan kolom KUNCI_JAWABAN.segmen agar JSON segmen soal panjang tidak terpotong
ALTER TABLE `KUNCI_JAWABAN`
  MODIFY COLUMN `segmen` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
