export type FlexibleMenuKey =
  | 'guru'
  | 'siswa'
  | 'kartu-peserta'
  | 'kelas-mapel'
  | 'tugas-mengajar'
  | 'jadwal-ujian-edit'
  | 'daftar-hadir'
  | 'logs'
  | 'doctor';

export interface FlexibleMenuDefinition {
  key: FlexibleMenuKey;
  label: string;
  href: string;
  category: 'MANAJEMEN DATA' | 'UJIAN & LJK' | 'SISTEM';
  description: string;
}

export const FLEXIBLE_MENU_DEFINITIONS: FlexibleMenuDefinition[] = [
  {
    key: 'guru',
    label: 'Manajemen Guru',
    href: '/dashboard/guru',
    category: 'MANAJEMEN DATA',
    description: 'Melihat, menambah, mengedit, dan mengimpor akun guru.',
  },
  {
    key: 'siswa',
    label: 'Direktori Siswa',
    href: '/dashboard/siswa',
    category: 'MANAJEMEN DATA',
    description: 'Mengelola data peserta didik, NIS, dan rombongan belajar.',
  },
  {
    key: 'kartu-peserta',
    label: 'Kartu Peserta',
    href: '/dashboard/kartu-peserta',
    category: 'MANAJEMEN DATA',
    description: 'Mengatur, mencetak, dan mengelola QR Kartu Peserta Ujian.',
  },
  {
    key: 'kelas-mapel',
    label: 'Kelas & Mapel',
    href: '/dashboard/kelas-mapel',
    category: 'MANAJEMEN DATA',
    description: 'Mengelola master daftar kelas dan mata pelajaran.',
  },
  {
    key: 'tugas-mengajar',
    label: 'Tugas Mengajar',
    href: '/dashboard/tugas-mengajar',
    category: 'MANAJEMEN DATA',
    description: 'Mengatur penugasan guru pengampu per kelas & mapel.',
  },
  {
    key: 'jadwal-ujian-edit',
    label: 'Edit Jadwal Ujian',
    href: '/dashboard/jadwal-ujian',
    category: 'UJIAN & LJK',
    description: 'Mengubah & menyimpan master Jadwal Ujian (lihat/cetak tetap aktif untuk semua guru).',
  },
  {
    key: 'daftar-hadir',
    label: 'Daftar Hadir & Berita Acara',
    href: '/dashboard/daftar-hadir',
    category: 'UJIAN & LJK',
    description: 'Mengatur dan mencetak Daftar Hadir Peserta serta Berita Acara Pelaksanaan Ujian.',
  },
  {
    key: 'logs',
    label: 'Audit Logs',
    href: '/dashboard/logs',
    category: 'SISTEM',
    description: 'Memantau riwayat aktivitas login, penilaian, dan perubahan sistem.',
  },
  {
    key: 'doctor',
    label: 'System Doctor',
    href: '/dashboard/doctor',
    category: 'SISTEM',
    description: 'Memeriksa diagnostik koneksi database, AI, dan sinkronisasi.',
  },
];

export const ROUTE_TO_MENU_KEY: Record<string, FlexibleMenuKey> = {
  '/dashboard/guru': 'guru',
  '/dashboard/siswa': 'siswa',
  '/dashboard/kartu-peserta': 'kartu-peserta',
  '/dashboard/kelas-mapel': 'kelas-mapel',
  '/dashboard/tugas-mengajar': 'tugas-mengajar',
  '/dashboard/daftar-hadir': 'daftar-hadir',
  '/dashboard/logs': 'logs',
  '/dashboard/doctor': 'doctor',
};

export type GuruMenuPermissions = Record<FlexibleMenuKey, boolean>;
export type UserMenuOverrides = Record<string, Partial<Record<FlexibleMenuKey, boolean>>>;

export interface RbacConfig {
  globalGuru: GuruMenuPermissions;
  userOverrides: UserMenuOverrides;
}

export function getDefaultGuruPermissions(): GuruMenuPermissions {
  return {
    guru: false,
    siswa: false,
    'kartu-peserta': false,
    'kelas-mapel': false,
    'tugas-mengajar': false,
    'jadwal-ujian-edit': false,
    'daftar-hadir': false,
    logs: false,
    doctor: false,
  };
}

export function parseRbacFromSettings(settings: Record<string, string> = {}): RbacConfig {
  const globalGuru = getDefaultGuruPermissions();
  if (settings['guru_menu_permissions_json']) {
    try {
      const parsed = JSON.parse(settings['guru_menu_permissions_json']);
      if (parsed && typeof parsed === 'object') {
        for (const def of FLEXIBLE_MENU_DEFINITIONS) {
          if (typeof parsed[def.key] === 'boolean') {
            globalGuru[def.key] = parsed[def.key];
          }
        }
      }
    } catch {
      // keep defaults
    }
  }

  const userOverrides: UserMenuOverrides = {};
  if (settings['user_menu_overrides_json']) {
    try {
      const parsed = JSON.parse(settings['user_menu_overrides_json']);
      if (parsed && typeof parsed === 'object') {
        for (const [uid, perms] of Object.entries(parsed)) {
          if (!uid || !perms || typeof perms !== 'object') continue;
          const cleanPerms: Partial<Record<FlexibleMenuKey, boolean>> = {};
          for (const def of FLEXIBLE_MENU_DEFINITIONS) {
            if (typeof (perms as any)[def.key] === 'boolean') {
              cleanPerms[def.key] = (perms as any)[def.key];
            }
          }
          if (Object.keys(cleanPerms).length > 0) {
            userOverrides[uid] = cleanPerms;
          }
        }
      }
    } catch {
      // keep empty
    }
  }

  return { globalGuru, userOverrides };
}

export function hasMenuAccess(
  role: string | undefined,
  userId: string | undefined,
  menuKey: FlexibleMenuKey,
  rbac: RbacConfig
): boolean {
  if (String(role || '').toUpperCase() === 'ADMIN') return true;
  if (userId && rbac.userOverrides[userId] && typeof rbac.userOverrides[userId][menuKey] === 'boolean') {
    return Boolean(rbac.userOverrides[userId][menuKey]);
  }
  return Boolean(rbac.globalGuru[menuKey]);
}
