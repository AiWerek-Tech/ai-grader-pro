import { headers } from 'next/headers';
import { getCurrentUser } from "@/lib/session-server";
import { getAcademicSessionAction } from "@/lib/actions/settings";
import { getRbacConfigServer } from "@/lib/rbac-server";
import { hasMenuAccess, ROUTE_TO_MENU_KEY } from "@/lib/rbac-config";
import { redirect } from 'next/navigation';
import ResponsiveDashboardWrapper from '@/components/dashboard/ResponsiveDashboardWrapper';

const adminSections = [
  {
    label: "UTAMA",
    items: [
      { href: "/dashboard", icon: "📊", label: "Overview" },
    ]
  },
  {
    label: "MANAJEMEN DATA",
    adminOnly: true,
    items: [
      { href: "/dashboard/guru", icon: "👤", label: "Manajemen Guru" },
      { href: "/dashboard/siswa", icon: "🎓", label: "Direktori Siswa" },
      { href: "/dashboard/kartu-peserta", icon: "🪪", label: "Kartu Peserta" },
      { href: "/dashboard/kelas-mapel", icon: "📚", label: "Kelas & Mapel" },
      { href: "/dashboard/tugas-mengajar", icon: "📋", label: "Tugas Mengajar" },
    ]
  },
  {
    label: "UJIAN & LJK",
    items: [
      { href: "/dashboard/jadwal-ujian", icon: "📅", label: "Jadwal Ujian" },
      { href: "/dashboard/daftar-hadir", icon: "📋", label: "Daftar Hadir" },
      { href: "/dashboard/kunci", icon: "🔑", label: "Kunci Jawaban" },
      { href: "/dashboard/ljk", icon: "🖨️", label: "Cetak LJK" },
      { href: "/dashboard/analisis", icon: "🔬", label: "Analisis LJK" },
      { href: "/dashboard/hasil", icon: "🏆", label: "Hasil & Skor" },
    ]
  },
  {
    label: "SISTEM",
    adminOnly: true,
    items: [
      { href: "/dashboard/logs", icon: "📜", label: "Audit Logs" },
      { href: "/dashboard/settings", icon: "⚙️", label: "Pengaturan Sekolah" },
      { href: "/dashboard/doctor", icon: "🩺", label: "System Doctor" },
    ]
  },
  {
    label: "PENGATURAN AKUN",
    items: [
      { href: "/dashboard/profile", icon: "👤", label: "Profil Saya" },
    ]
  }
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const isAdmin = user.role === 'ADMIN';
  const [sessionRes, rbac, reqHeaders] = await Promise.all([
    getAcademicSessionAction(),
    getRbacConfigServer(),
    headers(),
  ]);

  const currentPath = reqHeaders.get('x-pathname') || '';
  if (!isAdmin && currentPath) {
    const matchedRoute = Object.keys(ROUTE_TO_MENU_KEY).find((route) =>
      currentPath.startsWith(route)
    );
    if (matchedRoute) {
      const menuKey = ROUTE_TO_MENU_KEY[matchedRoute];
      if (!hasMenuAccess(user.role, user.id, menuKey, rbac)) {
        redirect('/dashboard');
      }
    }
  }

  const visibleSections = adminSections
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        if (isAdmin) return true;
        if (item.href === '/dashboard/settings') return false;
        const menuKey = ROUTE_TO_MENU_KEY[item.href];
        if (menuKey) {
          return hasMenuAccess(user.role, user.id, menuKey, rbac);
        }
        return !section.adminOnly;
      });
      return { label: section.label, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  const academicLabel = sessionRes?.data
    ? `Akademik ${sessionRes.data.tahunAjaran} • ${sessionRes.data.semester}`
    : 'Akademik 2026/2027 • GANJIL';

  return (
    <ResponsiveDashboardWrapper user={user} adminSections={visibleSections} academicLabel={academicLabel}>
      {children}
    </ResponsiveDashboardWrapper>
  );
}
