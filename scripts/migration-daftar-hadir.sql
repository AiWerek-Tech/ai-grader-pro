-- Migration / Seed Daftar Hadir & Berita Acara Ujian (MySQL Hosting)
-- Aman dijalankan berulang kali (idempotent): tidak menimpa konfigurasi yang sudah disimpan dari web.

CREATE TABLE IF NOT EXISTS `SETTINGS` (
  `key` VARCHAR(128) NOT NULL,
  `value` LONGTEXT,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `SETTINGS` (`key`, `value`) VALUES
('daftar_hadir_config_json', '{"mode":"PER_SESI","groupMode":"PER_KELAS","includeBeritaAcara":false,"jumlahPengawas":2,"pengawas1Nama":"","pengawas1Nip":"","pengawas2Nama":"","pengawas2Nip":"","signerMode":"PANITIA","customHariTanggal":"","customWaktu":"07.30 - 09.00","customMapel":""}')
ON DUPLICATE KEY UPDATE `value` = `value`;
