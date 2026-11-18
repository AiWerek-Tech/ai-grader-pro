-- ============================================================================
-- WMVAA AI Grader Pro - Migrasi SQL Aman untuk Hosting (phpMyAdmin / MySQL)
-- Fitur: Kartu Peserta Asesmen, Tanda Tangan Digital, & Portal Verifikasi QR
-- Catatan:
--   1. TIDAK mengubah struktur kolom tabel utama (SISWA, KELAS, MAPEL, dll.)
--   2. Aman dijalankan ulang berkali-kali (idempoten) tanpa menimpa data lama
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Pastikan tabel SETTINGS ada dan kolom `value` bertipe LONGTEXT
--    (wajib LONGTEXT agar upload TTD digital base64 & JSON kartu tidak terpotong)
CREATE TABLE IF NOT EXISTS `SETTINGS` (
  `key` VARCHAR(128) NOT NULL,
  `value` LONGTEXT,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `SETTINGS`
  MODIFY COLUMN `value` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Tambahkan kunci pengaturan baru secara aman (tidak menimpa nilai yg sudah ada & bebas warning)
INSERT INTO `SETTINGS` (`key`, `value`) VALUES
  -- Kontrol Portal Verifikasi QR Siswa (Tanpa Login)
  ('kartu_portal_enabled', 'true'),
  ('kartu_portal_show_score', 'true'),
  ('kartu_public_base_url', 'https://app.wmvaa.id/ai-grader'),
  ('kartu_qr_token_epoch', '1'),

  -- Pengaturan Default Desain Kartu Peserta Landscape
  ('kartu_judul_ujian', 'SAS (Sumatif Akhir Semester)'),
  ('kartu_kurikulum_label', 'Kurikulum Merdeka'),
  ('kartu_prefix_nomor', '2026-SAS-'),
  ('kartu_kop_yayasan', 'YAYASAN PENDIDIKAN ADVENT PAPUA'),
  ('kartu_kop_akademi', 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'),
  ('kartu_kop_nama_sekolah', ''),
  ('kartu_kop_alamat', 'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya'),
  ('kartu_kota_cetak', 'Wamena'),
  ('kartu_room_mode', 'PER_KELAS'),
  ('kartu_ruang_default', 'R. 01'),
  ('kartu_kapasitas_ruang', '24'),
  ('kartu_signer_mode', 'PANITIA'),
  ('kartu_layout_mode', 'FRONT_ONLY'),
  ('kartu_theme_mode', 'AUTO_JENJANG'),
  ('kartu_rows_per_page', '4'),
  ('kartu_show_initials', 'true'),
  ('kartu_overrides_json', '{}'),

  -- Slot Tanda Tangan Digital Pejabat Unit SMP & SMA (Opsional, diisi via UI Pengaturan Sekolah)
  ('smp_kepala_ttd_url', ''),
  ('smp_panitia_ttd_url', ''),
  ('sma_kepala_ttd_url', ''),
  ('sma_panitia_ttd_url', '')
ON DUPLICATE KEY UPDATE `value` = `SETTINGS`.`value`;

SET FOREIGN_KEY_CHECKS = 1;
