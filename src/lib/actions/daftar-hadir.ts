'use server';

import { dbGetAll } from '@/lib/google-sheets';
import { checkUserMenuAccess, requireMenuAccess } from '@/lib/rbac-server';
import { getSiswaAction } from '@/lib/actions/siswa';
import {
  getAcademicSessionAction,
  getSettingsAction,
} from '@/lib/actions/settings';
import { persistSettingsUpdates } from '@/lib/settings-server';
import {
  KartuStudentItem,
  parseKartuConfigFromSettings,
  parseKartuOverridesFromSettings,
} from '@/lib/kartu-peserta-utils';
import { parseJadwalUnitFromSettings } from '@/lib/jadwal-ujian-utils';
import {
  DaftarHadirConfig,
  parseDaftarHadirConfigFromSettings,
} from '@/lib/daftar-hadir-utils';

export async function getDaftarHadirBundleAction() {
  try {
    const auth = await requireMenuAccess('daftar-hadir', 'read');
    const canSaveConfig = await checkUserMenuAccess(auth, 'daftar-hadir', 'full');

    const [siswaRes, kelasRaw, mapelRaw, usersRaw, settingsRes, sessionRes] =
      await Promise.all([
        getSiswaAction(undefined, 'DELEGATED_ALL'),
        dbGetAll('KELAS', true),
        dbGetAll('MAPEL', true),
        dbGetAll('USERS', true),
        getSettingsAction(),
        getAcademicSessionAction(),
      ]);

    if (!siswaRes.success) {
      throw new Error(siswaRes.message || 'Gagal memuat daftar siswa.');
    }
    if (!settingsRes.success || !settingsRes.data) {
      throw new Error(settingsRes.message || 'Gagal memuat pengaturan sekolah.');
    }

    const settings = settingsRes.data;
    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';

    const students: KartuStudentItem[] = (siswaRes.data || [])
      .map((s: any) => ({
        id_siswa: String(s.id_siswa || ''),
        nis: String(s.nis || ''),
        nama: String(s.nama || ''),
        id_kelas: String(s.id_kelas || ''),
        nama_kelas: String(s.nama_kelas || s.id_kelas || ''),
        jenjang: (String(s.jenjang || 'SMA').toUpperCase() === 'SMP' ? 'SMP' : 'SMA') as
          | 'SMP'
          | 'SMA',
        tahun_ajaran: s.tahun_ajaran ? String(s.tahun_ajaran) : tahunAjaran,
        semester: s.semester ? String(s.semester) : semester,
      }))
      .sort((a: KartuStudentItem, b: KartuStudentItem) => {
        const klsCmp = a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true });
        if (klsCmp !== 0) return klsCmp;
        return a.nama.localeCompare(b.nama, 'id');
      });

    const mapelList = Array.from(
      new Set(
        (mapelRaw || [])
          .map((m: any) => String(m.nama_mapel || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'id'));

    const guruList = (usersRaw || [])
      .map((u: any) => ({
        id: String(u.id_user || ''),
        nama: String(u.nama || u.username || '').trim(),
        role: String(u.role || 'GURU').toUpperCase(),
      }))
      .filter((u: any) => u.nama)
      .sort((a: any, b: any) => a.nama.localeCompare(b.nama, 'id'));

    const kartuConfig = parseKartuConfigFromSettings(settings, semester, tahunAjaran, mapelList);
    const kartuOverrides = parseKartuOverridesFromSettings(settings);
    const jadwalMaster = {
      SMP: parseJadwalUnitFromSettings('SMP', settings, tahunAjaran, semester),
      SMA: parseJadwalUnitFromSettings('SMA', settings, tahunAjaran, semester),
    };
    const config = parseDaftarHadirConfigFromSettings(settings);

    return {
      success: true,
      data: {
        students,
        kelasList: kelasRaw || [],
        mapelList,
        guruList,
        settings,
        academicSession: { tahunAjaran, semester },
        kartuConfig,
        kartuOverrides,
        jadwalMaster,
        config,
        canSaveConfig,
      },
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal memuat data Daftar Hadir.',
    };
  }
}

export async function saveDaftarHadirConfigAction(config: DaftarHadirConfig) {
  try {
    const auth = await requireMenuAccess('daftar-hadir', 'full');
    await persistSettingsUpdates(
      { daftar_hadir_config_json: JSON.stringify(config) },
      auth.id
    );
    return { success: true };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal menyimpan konfigurasi Daftar Hadir.',
    };
  }
}
