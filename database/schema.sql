-- WMVAA AI Grader Pro - MySQL Schema
-- Generated at: 2026-11-18T07:27:20.897Z
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Table: USERS
CREATE TABLE IF NOT EXISTS `USERS` (
  `id_user` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'GURU',
  `nama` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Aktif',
  `profile_url` TEXT,
  PRIMARY KEY (`id_user`),
  INDEX `idx_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: KELAS
CREATE TABLE IF NOT EXISTS `KELAS` (
  `id_kelas` VARCHAR(64) NOT NULL,
  `nama_kelas` VARCHAR(128) NOT NULL,
  `jenjang` VARCHAR(64) DEFAULT '',
  `tahun_ajaran` VARCHAR(32) DEFAULT '',
  `semester` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (`id_kelas`),
  INDEX `idx_kelas_tahun_sem` (`tahun_ajaran`, `semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: MAPEL
CREATE TABLE IF NOT EXISTS `MAPEL` (
  `id_mapel` VARCHAR(64) NOT NULL,
  `nama_mapel` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id_mapel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: SISWA
CREATE TABLE IF NOT EXISTS `SISWA` (
  `id_siswa` VARCHAR(64) NOT NULL,
  `nis` VARCHAR(64) NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `id_kelas` VARCHAR(64) NOT NULL,
  `tahun_ajaran` VARCHAR(32) DEFAULT '',
  `semester` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (`id_siswa`),
  INDEX `idx_siswa_nis` (`nis`),
  INDEX `idx_siswa_kelas` (`id_kelas`),
  INDEX `idx_siswa_tahun_sem` (`tahun_ajaran`, `semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: KUNCI_JAWABAN
CREATE TABLE IF NOT EXISTS `KUNCI_JAWABAN` (
  `id_kunci` VARCHAR(64) NOT NULL,
  `id_guru` VARCHAR(64) NOT NULL,
  `id_mapel` VARCHAR(64) DEFAULT '',
  `id_kelas` VARCHAR(64) DEFAULT '',
  `judul_ujian` VARCHAR(255) NOT NULL,
  `tipe_soal` VARCHAR(64) DEFAULT '',
  `pengaturan_poin` MEDIUMTEXT,
  `data_json` LONGTEXT,
  `timestamp` VARCHAR(64) DEFAULT '',
  `segmen` VARCHAR(128) DEFAULT '',
  `tahun_ajaran` VARCHAR(32) DEFAULT '',
  `semester` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (`id_kunci`),
  INDEX `idx_kunci_guru` (`id_guru`),
  INDEX `idx_kunci_kelas` (`id_kelas`),
  INDEX `idx_kunci_tahun_sem` (`tahun_ajaran`, `semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: HASIL
CREATE TABLE IF NOT EXISTS `HASIL` (
  `id_hasil` VARCHAR(64) NOT NULL,
  `id_kunci` VARCHAR(64) NOT NULL,
  `id_siswa` VARCHAR(64) NOT NULL,
  `id_guru` VARCHAR(64) DEFAULT '',
  `skor` VARCHAR(32) DEFAULT '0',
  `detail_json` LONGTEXT,
  `timestamp` VARCHAR(64) DEFAULT '',
  `is_override` VARCHAR(32) DEFAULT '',
  `override_reason` TEXT,
  `tahun_ajaran` VARCHAR(32) DEFAULT '',
  `semester` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (`id_hasil`),
  INDEX `idx_hasil_kunci` (`id_kunci`),
  INDEX `idx_hasil_siswa` (`id_siswa`),
  INDEX `idx_hasil_kunci_siswa` (`id_kunci`, `id_siswa`),
  INDEX `idx_hasil_guru` (`id_guru`),
  INDEX `idx_hasil_tahun_sem` (`tahun_ajaran`, `semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: LOG
CREATE TABLE IF NOT EXISTS `LOG` (
  `log_seq` BIGINT NOT NULL AUTO_INCREMENT,
  `timestamp` VARCHAR(64) DEFAULT '',
  `level` VARCHAR(32) DEFAULT 'INFO',
  `action` VARCHAR(128) DEFAULT '',
  `message` TEXT,
  `userId` VARCHAR(64) DEFAULT 'SYSTEM',
  PRIMARY KEY (`log_seq`),
  INDEX `idx_log_ts` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: SETTINGS
CREATE TABLE IF NOT EXISTS `SETTINGS` (
  `key` VARCHAR(128) NOT NULL,
  `value` LONGTEXT,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: TUGAS_GURU
CREATE TABLE IF NOT EXISTS `TUGAS_GURU` (
  `id_tugas` VARCHAR(64) NOT NULL,
  `id_user` VARCHAR(64) NOT NULL,
  `id_mapel` VARCHAR(64) NOT NULL,
  `id_kelas` VARCHAR(64) NOT NULL,
  `tahun_ajaran` VARCHAR(32) DEFAULT '',
  `semester` VARCHAR(32) DEFAULT '',
  PRIMARY KEY (`id_tugas`),
  INDEX `idx_tugas_user` (`id_user`),
  INDEX `idx_tugas_kelas` (`id_kelas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: AI_FEEDBACK
CREATE TABLE IF NOT EXISTS `AI_FEEDBACK` (
  `id_feedback` VARCHAR(64) NOT NULL,
  `id_hasil` VARCHAR(64) NOT NULL,
  `id_guru` VARCHAR(64) DEFAULT '',
  `tipe_koreksi` VARCHAR(64) DEFAULT '',
  `detail_json` LONGTEXT,
  `timestamp` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (`id_feedback`),
  INDEX `idx_feedback_hasil` (`id_hasil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: FILES
CREATE TABLE IF NOT EXISTS `FILES` (
  `id` VARCHAR(64) NOT NULL,
  `file_name` VARCHAR(255) DEFAULT '',
  `file_type` VARCHAR(128) DEFAULT '',
  `category` VARCHAR(128) DEFAULT '',
  `drive_file_id` VARCHAR(255) DEFAULT '',
  `url` TEXT,
  `created_at` VARCHAR(64) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
