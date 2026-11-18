'use server';

import os from 'os';
import { headers } from 'next/headers';
import { dbGetAll } from '@/lib/google-sheets';
import { requireMenuAccess } from '@/lib/rbac-server';
import { BASE_PATH } from '@/lib/base-path';
import { getSiswaAction } from '@/lib/actions/siswa';
import {
  getAcademicSessionAction,
  getSettingsAction,
} from '@/lib/actions/settings';
import { persistSettingsUpdates } from '@/lib/settings-server';
import {
  KartuPesertaConfig,
  KartuStudentItem,
  KartuStudentOverride,
  parseKartuConfigFromSettings,
  parseKartuOverridesFromSettings,
  serializeKartuConfigToSettings,
} from '@/lib/kartu-peserta-utils';
import { signKartuQrToken } from '@/lib/kartu-qr-token';
import { parseJadwalUnitFromSettings } from '@/lib/jadwal-ujian-utils';

async function detectSuggestedPortalBaseUrls(): Promise<{
  recommendedUrl: string;
  lanUrl: string;
  cloudUrl: string;
}> {
  const basePathSuffix = BASE_PATH || '';
  const cloudUrl = `https://app.wmvaa.id${basePathSuffix}`;
  const port = process.env.PORT || '3000';

  let activeRequestUrl = '';
  try {
    const hdrs = await headers();
    const hostHeader = hdrs.get('x-forwarded-host') || hdrs.get('host') || '';
    const protoHeader =
      hdrs.get('x-forwarded-proto') ||
      (hostHeader && !hostHeader.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+/.test(hostHeader)
        ? 'https'
        : 'http');
    if (hostHeader && !hostHeader.startsWith('localhost') && !hostHeader.startsWith('127.')) {
      activeRequestUrl = `${protoHeader}://${hostHeader}${basePathSuffix}`;
    }
  } catch {
    // Ignore headers lookup errors outside request scope
  }

  let lanUrl = '';
  try {
    const interfaces = os.networkInterfaces();
    const lanCandidates: Array<{ url: string; priority: number }> = [];
    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets || []) {
        if (net.family === 'IPv4' && !net.internal && net.address) {
          const isPrivateLan =
            net.address.startsWith('192.168.') ||
            net.address.startsWith('10.') ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(net.address);
          if (!isPrivateLan) continue;
          const lower = name.toLowerCase();
          const isVirtual =
            lower.includes('vethernet') ||
            lower.includes('virtual') ||
            lower.includes('vmware') ||
            lower.includes('vbox') ||
            lower.includes('wsl') ||
            net.address.startsWith('172.');
          const isWifi =
            lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('wireless');
          lanCandidates.push({
            url: `http://${net.address}:${port}${basePathSuffix}`,
            priority: isVirtual ? 3 : isWifi ? 1 : 2,
          });
        }
      }
    }
    lanCandidates.sort((a, b) => a.priority - b.priority);
    lanUrl = lanCandidates[0]?.url || `http://localhost:${port}${basePathSuffix}`;
  } catch {
    lanUrl = `http://localhost:${port}${basePathSuffix}`;
  }

  return {
    recommendedUrl: activeRequestUrl || lanUrl || cloudUrl,
    lanUrl,
    cloudUrl,
  };
}

function buildQrTokenMap(
  students: Array<{ id_siswa: string }>,
  tahunAjaran: string,
  semester: string,
  epoch: number
): Record<string, string> {
  const tokenMap: Record<string, string> = {};
  for (const s of students) {
    if (!s.id_siswa) continue;
    tokenMap[s.id_siswa] = signKartuQrToken({
      s: s.id_siswa,
      ta: tahunAjaran,
      sm: semester,
      e: epoch,
    });
  }
  return tokenMap;
}

export async function getKartuPesertaBundleAction() {
  try {
    await requireMenuAccess('kartu-peserta');

    const [siswaRes, kelasRaw, mapelRaw, settingsRes, sessionRes, suggestedUrls] =
      await Promise.all([
        getSiswaAction(),
        dbGetAll('KELAS'),
        dbGetAll('MAPEL'),
        getSettingsAction(),
        getAcademicSessionAction(),
        detectSuggestedPortalBaseUrls(),
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

    const kelasList = (kelasRaw || [])
      .filter((k: any) => {
        const kTahun = String(k.tahun_ajaran || '').trim();
        return !kTahun || kTahun.toLowerCase() === tahunAjaran.toLowerCase();
      })
      .map((k: any) => ({
        id_kelas: String(k.id_kelas || ''),
        nama_kelas: String(k.nama_kelas || ''),
        jenjang: String(k.jenjang || 'SMA').toUpperCase() === 'SMP' ? 'SMP' : 'SMA',
      }))
      .sort((a: any, b: any) => a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true }));

    const mapelList = Array.from(
      new Set(
        (mapelRaw || [])
          .map((m: any) => String(m.nama_mapel || '').trim())
          .filter(Boolean)
      )
    );

    const config = parseKartuConfigFromSettings(settings, semester, tahunAjaran, mapelList);
    const overrides = parseKartuOverridesFromSettings(settings);
    const jadwalMaster = {
      SMP: parseJadwalUnitFromSettings('SMP', settings, tahunAjaran, semester),
      SMA: parseJadwalUnitFromSettings('SMA', settings, tahunAjaran, semester),
    };
    const qrTokensByStudentId = buildQrTokenMap(
      students,
      tahunAjaran,
      semester,
      config.qrTokenEpoch
    );

    return {
      success: true,
      data: {
        students,
        kelasList,
        mapelList,
        settings,
        academicSession: {
          tahunAjaran,
          semester,
        },
        config,
        overrides,
        jadwalMaster,
        qrTokensByStudentId,
        suggestedUrls,
      },
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal memuat data Kartu Peserta.',
    };
  }
}

export async function saveKartuPesertaSettingsAction(
  config: KartuPesertaConfig,
  overrides: Record<string, KartuStudentOverride> = {}
) {
  try {
    const auth = await requireMenuAccess('kartu-peserta');
    const updates = serializeKartuConfigToSettings(config, overrides);
    await persistSettingsUpdates(updates, auth.id);
    return { success: true };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal menyimpan pengaturan kartu peserta.',
    };
  }
}

export async function rotateKartuQrEpochAction() {
  try {
    const auth = await requireMenuAccess('kartu-peserta');
    const [siswaRes, settingsRes, sessionRes] = await Promise.all([
      getSiswaAction(),
      getSettingsAction(),
      getAcademicSessionAction(),
    ]);

    const settings = settingsRes.data || {};
    const nextEpoch = Math.max(1, Number(settings['kartu_qr_token_epoch']) || 1) + 1;
    await persistSettingsUpdates(
      { kartu_qr_token_epoch: String(nextEpoch) },
      auth.id
    );

    const tahunAjaran = sessionRes.data?.tahunAjaran || settings['tahun_ajaran'] || '2026/2027';
    const semester = sessionRes.data?.semester || settings['semester'] || 'GANJIL';
    const qrTokensByStudentId = buildQrTokenMap(
      siswaRes.data || [],
      tahunAjaran,
      semester,
      nextEpoch
    );

    return {
      success: true,
      data: {
        qrTokenEpoch: nextEpoch,
        qrTokensByStudentId,
      },
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Gagal mencabut token QR lama.',
    };
  }
}
