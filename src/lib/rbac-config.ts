export type FlexibleMenuKey =
  | 'guru'
  | 'siswa'
  | 'tagihan'
  | 'tagihan-kasir'
  | 'kartu-peserta'
  | 'kelas-mapel'
  | 'tugas-mengajar'
  | 'jadwal-ujian-edit'
  | 'daftar-hadir'
  | 'logs'
  | 'doctor';

export type MenuAccessLevel = 'none' | 'read' | 'full';

export interface FlexibleMenuDefinition {
  key: FlexibleMenuKey;
  label: string;
  href: string;
  category: 'MANAJEMEN DATA' | 'UJIAN & LJK' | 'SISTEM';
  description: string;
  /** Hanya mendukung read-only (mis. Audit Logs) */
  readOnlyOnly?: boolean;
  /** Hanya mendukung full karena read sudah bawaan semua guru (mis. Edit Jadwal Ujian) */
  fullOnly?: boolean;
}

export const FLEXIBLE_MENU_DEFINITIONS: FlexibleMenuDefinition[] = [
  {
    key: 'guru',
    label: 'Manajemen Guru',
    href: '/dashboard/guru',
    category: 'MANAJEMEN DATA',
    description: 'Lihat daftar guru (Read-Only) atau kelola & impor akun guru (Full).',
  },
  {
    key: 'siswa',
    label: 'Direktori Siswa',
    href: '/dashboard/siswa',
    category: 'MANAJEMEN DATA',
    description: 'Lihat & cari data siswa (Read-Only) atau tambah/edit/hapus/impor (Full).',
  },
  {
    key: 'tagihan',
    label: 'Bendahara (Tagihan & SPP)',
    href: '/dashboard/tagihan',
    category: 'MANAJEMEN DATA',
    description: 'Pantau status biaya/kelayakan (Lihat) atau otoritas penuh Bendahara: tarif, generate tagihan, potongan, dispensasi & void (Full).',
  },
  {
    key: 'tagihan-kasir',
    label: 'Kasir Loket SPP',
    href: '/dashboard/tagihan',
    category: 'MANAJEMEN DATA',
    description: 'Wewenang Kasir Loket: terima pembayaran siswa & cetak kwitansi (tanpa ubah tarif, generate tagihan, dispensasi, atau void).',
    fullOnly: true,
  },
  {
    key: 'kartu-peserta',
    label: 'Kartu Peserta',
    href: '/dashboard/kartu-peserta',
    category: 'MANAJEMEN DATA',
    description: 'Lihat & cetak PDF kartu (Read-Only) atau edit nomor/desain & putar QR (Full).',
  },
  {
    key: 'kelas-mapel',
    label: 'Kelas & Mapel',
    href: '/dashboard/kelas-mapel',
    category: 'MANAJEMEN DATA',
    description: 'Lihat master kelas & mapel (Read-Only) atau tambah/edit/hapus (Full).',
  },
  {
    key: 'tugas-mengajar',
    label: 'Tugas Mengajar',
    href: '/dashboard/tugas-mengajar',
    category: 'MANAJEMEN DATA',
    description: 'Lihat penugasan guru (Read-Only) atau atur/hapus penugasan (Full).',
  },
  {
    key: 'jadwal-ujian-edit',
    label: 'Edit Jadwal Ujian',
    href: '/dashboard/jadwal-ujian',
    category: 'UJIAN & LJK',
    description: 'Mengubah & menyimpan master Jadwal Ujian (lihat/cetak sudah aktif untuk semua guru).',
    fullOnly: true,
  },
  {
    key: 'daftar-hadir',
    label: 'Daftar Hadir & Berita Acara',
    href: '/dashboard/daftar-hadir',
    category: 'UJIAN & LJK',
    description: 'Cetak Daftar Hadir & Berita Acara (Read-Only) atau simpan preferensi server (Full).',
  },
  {
    key: 'logs',
    label: 'Audit Logs',
    href: '/dashboard/logs',
    category: 'SISTEM',
    description: 'Memantau riwayat aktivitas login, penilaian, dan perubahan sistem (Read-Only).',
    readOnlyOnly: true,
  },
  {
    key: 'doctor',
    label: 'System Doctor',
    href: '/dashboard/doctor',
    category: 'SISTEM',
    description: 'Cek diagnostik sistem (Read-Only) atau jalankan perbaikan Auto-Heal (Full).',
  },
];

export const ROUTE_TO_MENU_KEY: Record<string, FlexibleMenuKey> = {
  '/dashboard/guru': 'guru',
  '/dashboard/siswa': 'siswa',
  '/dashboard/tagihan': 'tagihan',
  '/dashboard/kartu-peserta': 'kartu-peserta',
  '/dashboard/kelas-mapel': 'kelas-mapel',
  '/dashboard/tugas-mengajar': 'tugas-mengajar',
  '/dashboard/daftar-hadir': 'daftar-hadir',
  '/dashboard/logs': 'logs',
  '/dashboard/doctor': 'doctor',
};

export type GuruMenuPermissions = Record<FlexibleMenuKey, MenuAccessLevel>;
export type UserMenuOverrides = Record<string, Partial<Record<FlexibleMenuKey, MenuAccessLevel>>>;

export interface RbacConfig {
  globalGuru: GuruMenuPermissions;
  userOverrides: UserMenuOverrides;
}

export interface RbacRolePreset {
  id: string;
  label: string;
  description: string;
  permissions: Partial<Record<FlexibleMenuKey, MenuAccessLevel>>;
}

export const RBAC_GURU_PRESETS: RbacRolePreset[] = [
  {
    id: 'bendahara',
    label: 'Bendahara Sekolah',
    description: 'Otoritas Penuh Keuangan (Tarif, Generate, Kasir, Potongan, Dispensasi, Void & Laporan) + Lihat Siswa & Kartu',
    permissions: {
      tagihan: 'full',
      'tagihan-kasir': 'full',
      siswa: 'read',
      'kartu-peserta': 'read',
    },
  },
  {
    id: 'kasir',
    label: 'Kasir Loket SPP',
    description: 'Terima Pembayaran & Cetak Kwitansi/Surat Tagihan/Rekap Kas (tanpa ubah tarif, dispensasi, atau void)',
    permissions: {
      tagihan: 'read',
      'tagihan-kasir': 'full',
      siswa: 'read',
    },
  },
  {
    id: 'panitia',
    label: 'Panitia Ujian',
    description: 'Full Kartu, Jadwal & Daftar Hadir + Read-Only Siswa & Status Biaya',
    permissions: {
      siswa: 'read',
      tagihan: 'read',
      'kartu-peserta': 'full',
      'jadwal-ujian-edit': 'full',
      'daftar-hadir': 'full',
    },
  },
  {
    id: 'walikelas',
    label: 'Wali Kelas / Pengawas',
    description: 'Read-Only Siswa, Status Biaya, Kartu Peserta & Daftar Hadir (Siap Cetak)',
    permissions: {
      siswa: 'read',
      tagihan: 'read',
      'kartu-peserta': 'read',
      'daftar-hadir': 'read',
    },
  },
  {
    id: 'wakakur',
    label: 'Wakakur / Operator',
    description: 'Full Akademik & Ujian + Read-Only Manajemen Guru',
    permissions: {
      guru: 'read',
      siswa: 'full',
      'kelas-mapel': 'full',
      'tugas-mengajar': 'full',
      'kartu-peserta': 'full',
      'jadwal-ujian-edit': 'full',
      'daftar-hadir': 'full',
    },
  },
];

export function normalizeAccessLevel(raw: unknown): MenuAccessLevel {
  if (raw === true || raw === 'full' || raw === 'FULL') return 'full';
  if (raw === 'read' || raw === 'READ') return 'read';
  return 'none';
}

export function cycleAccessLevel(
  current: MenuAccessLevel,
  def?: Pick<FlexibleMenuDefinition, 'readOnlyOnly' | 'fullOnly'>
): MenuAccessLevel {
  if (def?.readOnlyOnly) {
    return current === 'none' ? 'read' : 'none';
  }
  if (def?.fullOnly) {
    return current === 'none' ? 'full' : 'none';
  }
  if (current === 'none') return 'read';
  if (current === 'read') return 'full';
  return 'none';
}

export function getDefaultGuruPermissions(): GuruMenuPermissions {
  return {
    guru: 'none',
    siswa: 'none',
    tagihan: 'none',
    'tagihan-kasir': 'none',
    'kartu-peserta': 'none',
    'kelas-mapel': 'none',
    'tugas-mengajar': 'none',
    'jadwal-ujian-edit': 'none',
    'daftar-hadir': 'none',
    logs: 'none',
    doctor: 'none',
  };
}

export function parseRbacFromSettings(settings: Record<string, string> = {}): RbacConfig {
  const globalGuru = getDefaultGuruPermissions();
  if (settings['guru_menu_permissions_json']) {
    try {
      const parsed = JSON.parse(settings['guru_menu_permissions_json']);
      if (parsed && typeof parsed === 'object') {
        for (const def of FLEXIBLE_MENU_DEFINITIONS) {
          if (parsed[def.key] !== undefined) {
            globalGuru[def.key] = normalizeAccessLevel(parsed[def.key]);
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
          const cleanPerms: Partial<Record<FlexibleMenuKey, MenuAccessLevel>> = {};
          for (const def of FLEXIBLE_MENU_DEFINITIONS) {
            const rawVal = (perms as any)[def.key];
            if (rawVal !== undefined) {
              const lvl = normalizeAccessLevel(rawVal);
              if (lvl !== 'none') {
                cleanPerms[def.key] = lvl;
              }
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

export function getMenuAccessLevel(
  role: string | undefined,
  userId: string | undefined,
  menuKey: FlexibleMenuKey,
  rbac: RbacConfig
): MenuAccessLevel {
  if (String(role || '').toUpperCase() === 'ADMIN') return 'full';
  const overrideLvl = userId ? rbac.userOverrides[userId]?.[menuKey] : undefined;
  const globalLvl = rbac.globalGuru[menuKey] || 'none';
  // Ambil tingkat tertinggi antara override individu dan izin global
  const rank: Record<MenuAccessLevel, number> = { none: 0, read: 1, full: 2 };
  if (overrideLvl && rank[overrideLvl] >= rank[globalLvl]) {
    return overrideLvl;
  }
  return globalLvl;
}

export function hasMenuAccess(
  role: string | undefined,
  userId: string | undefined,
  menuKey: FlexibleMenuKey,
  rbac: RbacConfig,
  required: 'read' | 'full' = 'read'
): boolean {
  const level = getMenuAccessLevel(role, userId, menuKey, rbac);
  if (required === 'full') return level === 'full';
  return level === 'read' || level === 'full';
}

/**
 * Mengecek izin akses rute dashboard termasuk pemisahan jabatan Bendahara (`tagihan`) & Kasir (`tagihan-kasir`).
 */
export function hasDashboardRouteAccess(
  role: string | undefined,
  userId: string | undefined,
  href: string,
  rbac: RbacConfig
): boolean {
  if (String(role || '').toUpperCase() === 'ADMIN') return true;
  if (href.startsWith('/dashboard/tagihan')) {
    return (
      hasMenuAccess(role, userId, 'tagihan', rbac, 'read') ||
      hasMenuAccess(role, userId, 'tagihan-kasir', rbac, 'full')
    );
  }
  const menuKey = ROUTE_TO_MENU_KEY[href];
  if (!menuKey) return true;
  return hasMenuAccess(role, userId, menuKey, rbac, 'read');
}
