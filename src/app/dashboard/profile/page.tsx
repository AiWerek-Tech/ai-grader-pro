'use client';

import { getCurrentUser } from '@/lib/session-server';
import { updateMyProfileAction, getMyAccountCredentialsAction } from '@/lib/actions/auth';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { transformDriveLink } from '@/lib/utils';
import Image from 'next/image';
import { 
  UserCircle2, 
  Camera, 
  Save, 
  Link2, 
  KeyRound, 
  LayoutDashboard,
  UserCheck,
  User,
  Lightbulb,
  Sparkles,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(true);
  const [newPassword, setNewPassword] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      const u = await getCurrentUser();
      if (!u) {
        router.push('/login');
        return;
      }
      setUser(u);
      const creds = await getMyAccountCredentialsAction();
      if (creds.success && creds.data) {
        setCurrentPassword(creds.data.password_plain);
      } else {
        setCurrentPassword(u.role === 'ADMIN' ? 'admin123' : 'guru12345');
      }
      setLoading(false);
    }
    fetchUser();
  }, [router]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} berhasil disalin!`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const nama = formData.get('nama') as string;
    const username = formData.get('username') as string;
    const profile_url = formData.get('profile_url') as string;

    try {
      const res = await updateMyProfileAction({
        nama,
        username,
        profile_url,
        new_password: newPassword.trim() || undefined,
      });
      if (res.success) {
        toast.success(res.message);
        if (newPassword.trim()) {
          setCurrentPassword(newPassword.trim());
          setNewPassword('');
        }
        const updated = await getCurrentUser();
        if (updated) setUser(updated);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <div className="text-slate-500 dark:text-slate-400 font-bold animate-pulse tracking-tight">Menyiapkan Profil Anda...</div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-[1200px] mx-auto space-y-6 sm:space-y-10 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
            <span className="p-2.5 sm:p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl sm:rounded-[1.5rem] text-indigo-500 shadow-inner border border-indigo-500/10 dark:border-indigo-500/20">
              <User className="w-6 h-6 sm:w-8 sm:h-8" />
            </span>
            Pengaturan Profil
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 sm:mt-3 font-semibold text-xs sm:text-sm max-w-xl">Sesuaikan identitas digital Anda untuk tampilan di dashboard dan laporan penilaian.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* Profile Card Sidebar */}
        <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-2xl sm:rounded-[3rem] p-6 sm:p-10 shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors flex flex-col items-center text-center">
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[50px] rounded-full -mr-16 -mt-16" />
           
           <div className="relative mb-6 sm:mb-8">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl sm:rounded-[2.5rem] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-inner overflow-hidden group">
                 {user?.profile_url ? (
                   <Image src={transformDriveLink(user.profile_url)} alt={user.nama} width={128} height={128} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                 ) : (
                   <UserCircle2 className="w-16 h-16 text-slate-300 dark:text-slate-700" />
                 )}
              </div>
              <div className="absolute -bottom-2 -right-2 p-2.5 sm:p-3 bg-indigo-600 text-white rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-500/20 border-2 border-white dark:border-[#0a0e1a]">
                 <Camera className="w-4 h-4" />
              </div>
           </div>

           <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate w-full px-2 sm:px-4">{user?.nama}</h2>
           <div className="mt-2 flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{user?.role}</span>
           </div>

           <div className="w-full h-[1px] bg-slate-100 dark:bg-white/5 my-6 sm:my-8" />

           <div className="w-full space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest px-2">
                 <span>Username</span>
                 <span className="text-slate-900 dark:text-slate-300">@{user?.username}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest px-2">
                 <span>Sesi Aktif</span>
                 <span className="text-emerald-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE</span>
              </div>
           </div>
        </div>

        {/* Edit Form Main */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-2xl sm:rounded-[3rem] p-6 sm:p-12 shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -mr-32 -mt-32" />
          
          <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10 relative z-10">
            <div className="space-y-6 sm:space-y-8">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 sm:gap-4">
                <span className="w-6 sm:w-8 h-[1px] bg-slate-200 dark:bg-slate-800" />
                Informasi Dasar
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                 <div>
                   <label className="block text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 sm:mb-3 ml-1 flex items-center gap-2">
                      <UserCheck className="w-3 h-3" /> Nama Lengkap
                   </label>
                   <input required type="text" name="nama" defaultValue={user?.nama} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl sm:rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner" placeholder="Contoh: Budi Santoso, S.Pd" />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 sm:mb-3 ml-1 flex items-center gap-2">
                      <LayoutDashboard className="w-3 h-3" /> Identitas Login (Username)
                   </label>
                   <input required type="text" name="username" defaultValue={user?.username} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl sm:rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner" />
                 </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-2">
                   <Link2 className="w-3 h-3" /> URL Foto Profil
                </label>
                <textarea 
                  name="profile_url" 
                  defaultValue={user?.profile_url}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner min-h-[100px] resize-none" 
                  placeholder="Tempel link gambar dari Google Drive, Facebook, atau URL lainnya..."
                />
                <p className="text-[10px] text-slate-500 mt-3 font-bold italic">* Disarankan menggunakan URL gambar publik dengan aspek rasio 1:1 untuk hasil optimal.</p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                <span className="w-8 h-[1px] bg-slate-200 dark:bg-slate-800" />
                Kredensial & Ganti Password
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center justify-between">
                    <span>Password Aktif Saat Ini</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500"
                        title={showCurrentPass ? 'Sembunyikan' : 'Lihat Password'}
                      >
                        {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(currentPassword, 'Password')}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500"
                        title="Salin Password"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
                    {showCurrentPass ? currentPassword : '••••••••'}
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-2">
                    Klik ikon mata untuk melihat password Anda saat ini.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center justify-between">
                    <span className="flex items-center gap-2"><KeyRound className="w-3 h-3 text-indigo-500" /> Ganti Password Baru (Opsional)</span>
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="text-indigo-500 hover:underline text-[9px]"
                    >
                      {showNewPass ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  </label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    name="new_password"
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak ingin ganti password..."
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 font-semibold mt-2 ml-1">
                    Minimal 4 karakter. Jika Anda lupa password di kemudian hari, Admin sekolah juga dapat melihat atau membantu meresetnya.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-slate-100 dark:border-white/[0.05] flex justify-end">
              <button disabled={saving} type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3">
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Simpan Perubahan Profil
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Profile Tips Banner */}
      <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-8 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
         <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/10 dark:bg-slate-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 text-indigo-400 dark:text-indigo-600">
              <Lightbulb className="w-8 h-8" />
            </div>
            <div>
               <h4 className="text-[11px] font-black uppercase tracking-widest mb-1">Tahukah Anda?</h4>
               <p className="text-xs font-bold opacity-80 max-w-lg leading-relaxed">Profil yang lengkap dengan foto mempermudah rekan pengajar lain mengenali kontribusi Anda dalam laporan analitik dan audit logs.</p>
            </div>
         </div>
         <div className="flex items-center gap-3 px-6 py-3 bg-white/10 dark:bg-slate-100/50 rounded-2xl border border-white/20 dark:border-slate-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Verified Account</span>
         </div>
      </div>
    </div>
  );
}
