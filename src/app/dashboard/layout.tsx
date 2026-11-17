import { getCurrentUser } from "@/lib/session-server";
import { getAcademicSessionAction } from "@/lib/actions/settings";
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
      { href: "/dashboard/kelas-mapel", icon: "📚", label: "Kelas & Mapel" },
      { href: "/dashboard/tugas-mengajar", icon: "📋", label: "Tugas Mengajar" },
    ]
  },
  {
    label: "UJIAN & LJK",
    items: [
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
  const isAdmin = user?.role === 'ADMIN';

  const visibleSections = adminSections.filter(s => !s.adminOnly || isAdmin);

  if (!user) {
    redirect('/login');
  }

  const sessionRes = await getAcademicSessionAction();
  const academicLabel = sessionRes?.data
    ? `Akademik ${sessionRes.data.tahunAjaran} • ${sessionRes.data.semester}`
    : 'Akademik 2026/2027 • GANJIL';

  return (
    <ResponsiveDashboardWrapper user={user} adminSections={visibleSections} academicLabel={academicLabel}>
      {children}
    </ResponsiveDashboardWrapper>
  );
}
