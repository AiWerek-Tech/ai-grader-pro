-- Migration / Seed Hak Akses Menu Guru 3-Level (none | read | full) (MySQL Hosting)
-- Aman dijalankan berulang kali (idempotent & bebas warning #1062): tidak menimpa aturan yang sudah disimpan dari web.

CREATE TABLE IF NOT EXISTS `SETTINGS` (
  `key` VARCHAR(128) NOT NULL,
  `value` LONGTEXT,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `SETTINGS` (`key`, `value`) VALUES
('guru_menu_permissions_json', '{"guru":"none","siswa":"none","kartu-peserta":"none","kelas-mapel":"none","tugas-mengajar":"none","jadwal-ujian-edit":"none","daftar-hadir":"none","logs":"none","doctor":"none"}'),
('user_menu_overrides_json', '{}')
ON DUPLICATE KEY UPDATE `value` = `value`;
