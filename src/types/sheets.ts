/**
 * Type definitions for Google Sheets schemas
 * Provides type safety for database operations
 */

// User types
export interface UserRow {
  id_user: string;
  username: string;
  password_hash: string;
  role: 'ADMIN' | 'GURU';
  nama: string;
  status: 'Aktif' | 'Non-Aktif';
  profile_url: string;
}

// Class types
export interface KelasRow {
  id_kelas: string;
  nama_kelas: string;
  jenjang: string;
  tahun_ajaran: string;
  semester: string;
}

// Subject types
export interface MapelRow {
  id_mapel: string;
  nama_mapel: string;
}

// Student types
export interface SiswaRow {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
  tahun_ajaran: string;
  semester: string;
}

// Answer key types
export interface KunciRow {
  id_kunci: string;
  id_guru: string;
  id_mapel: string;
  id_kelas: string;
  judul_ujian: string;
  tipe_soal: string;
  pengaturan_poin: string;
  data_json: string;
  timestamp: string;
  segmen: string;
  tahun_ajaran: string;
  semester: string;
}

// Result types
export interface HasilRow {
  id_hasil: string;
  id_kunci: string;
  id_siswa: string;
  id_guru: string;
  skor: string;
  detail_json: string;
  timestamp: string;
  is_override: string;
  override_reason: string;
  tahun_ajaran: string;
  semester: string;
}

// Log types
export interface LogRow {
  timestamp: string;
  level: string;
  action: string;
  message: string;
  userId: string;
}

// Settings types
export interface SettingsRow {
  key: string;
  value: string;
}

// Teacher assignment types
export interface TugasGuruRow {
  id_tugas: string;
  id_user: string;
  id_mapel: string;
  id_kelas: string;
  tahun_ajaran: string;
  semester: string;
}

// AI Feedback types
export interface AIFeedbackRow {
  id_feedback: string;
  id_hasil: string;
  id_guru: string;
  tipe_koreksi: string;
  detail_json: string;
  timestamp: string;
}

// File types
export interface FileRow {
  id: string;
  file_name: string;
  file_type: string;
  category: string;
  drive_file_id: string;
  url: string;
  created_at: string;
}

// Union type for all sheet rows
export type SheetRow = 
  | UserRow 
  | KelasRow 
  | MapelRow 
  | SiswaRow 
  | KunciRow 
  | HasilRow 
  | LogRow 
  | SettingsRow 
  | TugasGuruRow 
  | AIFeedbackRow 
  | FileRow;

// Sheet name to row type mapping
export interface SheetTypes {
  USERS: UserRow;
  KELAS: KelasRow;
  MAPEL: MapelRow;
  SISWA: SiswaRow;
  KUNCI_JAWABAN: KunciRow;
  HASIL: HasilRow;
  LOG: LogRow;
  SETTINGS: SettingsRow;
  TUGAS_GURU: TugasGuruRow;
  AI_FEEDBACK: AIFeedbackRow;
  FILES: FileRow;
}
