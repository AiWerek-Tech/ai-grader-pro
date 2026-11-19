'use server';

import { dbGetAll } from '@/lib/google-sheets';
import { requireAuth } from '@/lib/session-server';
import { checkUserMenuAccess, requireMenuAccess } from '@/lib/rbac-server';
import { getAcademicSessionAction, getSettingsAction } from '@/lib/actions/settings';
import { persistSettingsUpdates } from '@/lib/settings-server';
import {
  JadwalUnit,
  JadwalUjianUnitConfig,
  parseJadwalUnitFromSettings,
} from '@/lib/jadwal-ujian-utils';

export interface JadwalKelasItem {
  id_kelas: string;
  nama_kelas: string;
  jenjang: 'SMP' | 'SMA';
}

export async function getJadwalUjianBundleAction() {
  try {
    const auth = await requireAuth();
    const [settingsRes, sessionRes, mapelRaw, kelasRaw, tugasRaw] = await Promise.all([
      getSettingsAction(),
      getAcademicSessionAction(),
      dbGetAll('MAPEL', true),
      dbGetAll('KELAS', true),
      dbGetAll('TUGAS_GURU', true),
    ]);

    if (!settingsRes.success || !settingsRes.data) {
      throw new Error(settingsRes.message || 'Gagal memuat pengaturan sekolah.');
    }

    const settings = settingsRes.data;
    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';

    const smp = parseJadwalUnitFromSettings('SMP', settings, tahunAjaran, semester);
    const sma = parseJadwalUnitFromSettings('SMA', settings, tahunAjaran, semester);

    // Filter kelas aktif sesuai tahun ajaran & semester (fallback ke semua kelas jika belum di-tag)
    const activeKelasFiltered = (kelasRaw || []).filter((k: any) => {
      const kTa = String(k.tahun_ajaran || '').trim();
      const kSm = String(k.semester || '').trim().toUpperCase();
      if (!kTa && !kSm) return true;
      return kTa === tahunAjaran && (!kSm || kSm === semester.toUpperCase());
    });
    const sourceKelas = activeKelasFiltered.length > 0 ? activeKelasFiltered : (kelasRaw || []);
    const kelasList: JadwalKelasItem[] = sourceKelas
      .map((k: any) => ({
        id_kelas: String(k.id_kelas || ''),
        nama_kelas: String(k.nama_kelas || k.id_kelas || '').trim(),
        jenjang: (String(k.jenjang || '').toUpperCase() === 'SMP' ||
        /\b(VII|VIII|IX|7|8|9)\b/i.test(String(k.nama_kelas || ''))
          ? 'SMP'
          : 'SMA') as 'SMP' | 'SMA',
      }))
      .filter((k: JadwalKelasItem) => k.nama_kelas)
      .sort((a: JadwalKelasItem, b: JadwalKelasItem) =>
        a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true })
      );

    // Gabungkan Master MAPEL + mapel yang ada di TUGAS_GURU
    const mapelById = new Map<string, string>();
    for (const m of mapelRaw || []) {
      const id = String(m.id_mapel || '').trim();
      const nama = String(m.nama_mapel || '').trim();
      if (id && nama) mapelById.set(id, nama);
    }
    const tugasMapelNames = (tugasRaw || [])
      .map((t: any) => mapelById.get(String(t.id_mapel || '').trim()) || String(t.nama_mapel || '').trim())
      .filter(Boolean);

    const mapelList = Array.from(
      new Set([
        ...(mapelRaw || []).map((m: any) => String(m.nama_mapel || '').trim()).filter(Boolean),
        ...tugasMapelNames,
      ])
    ).sort((a, b) => a.localeCompare(b, 'id'));

    const canEdit = await checkUserMenuAccess(auth, 'jadwal-ujian-edit', 'full');

    return {
      success: true,
      data: {
        smp,
        sma,
        settings,
        academicSession: { tahunAjaran, semester },
        mapelList,
        kelasList,
        canEdit,
      },
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal memuat Jadwal Ujian.',
    };
  }
}

export async function saveJadwalUjianAction(
  unit: JadwalUnit,
  config: JadwalUjianUnitConfig
) {
  try {
    const auth = await requireMenuAccess('jadwal-ujian-edit', 'full');
    const key = unit === 'SMP' ? 'jadwal_ujian_smp_json' : 'jadwal_ujian_sma_json';
    await persistSettingsUpdates({ [key]: JSON.stringify(config) }, auth.id);
    return { success: true };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal menyimpan jadwal ujian.',
    };
  }
}
