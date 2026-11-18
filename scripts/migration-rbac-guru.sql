-- Migration / Seed Hak Akses Menu Guru Fleksibel (MySQL Hosting)
-- Aman dijalankan berulang kali (idempotent): tidak menimpa aturan yang sudah disimpan dari web.

CREATE TABLE IF NOT EXISTS `SETTINGS` (
  `key` VARCHAR(128) NOT NULL,
  `value` LONGTEXT,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `SETTINGS` (`key`, `value`) VALUES
('guru_menu_permissions_json', '{"guru":false,"siswa":false,"kartu-peserta":false,"kelas-mapel":false,"tugas-mengajar":false,"jadwal-ujian-edit":false,"daftar-hadir":false,"logs":false,"doctor":false}'),
('user_menu_overrides_json', '{}')
ON DUPLICATE KEY UPDATE `value` = `value`;
