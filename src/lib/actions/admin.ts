'use server';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { dbGetAll, dbAppendRow, dbFindAndDeleteRow, dbUpdateRow, generateId, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/session-server';
import { checkUserMenuAccess, requireMenuAccess } from '@/lib/rbac-server';
import { calculateIRTAnalysis } from '@/lib/ai/grader-engine';
import { getAcademicSessionAction } from '@/lib/actions/settings';

// Schema USERS: [id_user(0), username(1), password_hash(2), role(3), nama(4), status(5), profile_url(6), password_plain(7)]

function generateTemporaryPassword() {
  return 'guru12345';
}

function resolvePasswordOrGenerate(rawPassword?: string) {
  const password = rawPassword?.trim();
  if (password) {
    if (password.length < 4) {
      throw new Error('Password minimal 4 karakter.');
    }
    return { password, generated: false };
  }

  return { password: 'guru12345', generated: true };
}

export async function getGuruList() {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = session?.tahunAjaran;
    const semester = session?.semester;

    const users = await dbGetAll('USERS');
    const allKunci = await dbGetAll('KUNCI_JAWABAN');
    const allHasil = await dbGetAll('HASIL');

    const stats: Record<string, { kunci: number, scan: number }> = {};
    users.forEach(u => stats[u.id_user] = { kunci: 0, scan: 0 });
    
    const cleanTahun = String(tahunAjaran || '').trim();
    const cleanSem = String(semester || '').trim().toUpperCase();

    allKunci.forEach(k => {
      const gId = k.id_guru;
      const kTahun = String(k.tahun_ajaran || '').trim();
      const kSem = String(k.semester || '').trim().toUpperCase();
      if (cleanTahun && kTahun && kTahun.toLowerCase() !== cleanTahun.toLowerCase()) return;
      if (cleanSem && kSem && kSem !== cleanSem) return;
      if (stats[gId]) stats[gId].kunci++;
    });

    allHasil.forEach(h => {
      const gId = h.id_guru;
      const hTahun = String(h.tahun_ajaran || '').trim();
      const hSem = String(h.semester || '').trim().toUpperCase();
      if (cleanTahun && hTahun && hTahun.toLowerCase() !== cleanTahun.toLowerCase()) return;
      if (cleanSem && kMatchesSem(hSem, cleanSem)) {
        if (stats[gId]) stats[gId].scan++;
      } else if (!cleanSem && stats[gId]) {
        stats[gId].scan++;
      }
    });

    function kMatchesSem(itemSem: string, activeSem: string) {
      return !itemSem || itemSem === activeSem;
    }

    const allLogs = await dbGetAll('LOG');

    const canViewAllGuru =
      authSession.role === 'ADMIN' ||
      (await checkUserMenuAccess(authSession, 'guru', 'read')) ||
      (await checkUserMenuAccess(authSession, 'tugas-mengajar', 'read'));
    const canEditGuru =
      authSession.role === 'ADMIN' || (await checkUserMenuAccess(authSession, 'guru', 'full'));

    const visibleUsers = canViewAllGuru
      ? users.filter(u => u.role === 'GURU' || u.role === 'ADMIN')
      : users.filter(u => String(u.id_user) === String(authSession.id));

    return {
      success: true,
      canEdit: canEditGuru,
      data: visibleUsers.map(u => {
        const k = stats[u.id_user]?.kunci || 0;
        const s = stats[u.id_user]?.scan || 0;
        const userLogs = allLogs.filter(l => (l.userId || l.user_id) === u.id_user);
        const score = (k * 10) + s;
        const fallbackPlain = u.role === 'ADMIN' ? 'admin123' : 'guru12345';
        
        return {
          id: u.id_user,
          username: u.username,
          nama: u.nama,
          role: u.role,
          status: u.status || 'Aktif',
          total_kunci: k,
          total_scan: s,
          score: score,
          profile_url: u.profile_url || '',
          password_plain: canEditGuru ? (u.password_plain || fallbackPlain) : '••••••••',
          activity: userLogs.map(l => ({ t: l.timestamp, a: l.action }))
        };
      })
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function addGuruAction(reqData: any, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    if (!reqData.username || !reqData.nama) throw new Error('Nama dan Username guru wajib diisi.');
    const resolvedPass = resolvePasswordOrGenerate(reqData.password);
    
    const username = sanitizeInput(reqData.username).toLowerCase().replace(/\s/g,'');
    const nama = sanitizeInput(reqData.nama);
    const profileUrl = reqData.profile_url ? sanitizeInput(reqData.profile_url).trim() : '';
    
    const existing = await dbGetAll('USERS');
    if (existing.find(u => String(u.username).toLowerCase() === username)) {
      throw new Error(`Username "${username}" sudah digunakan.`);
    }

    const newId = generateId('USR');
    const hash = bcrypt.hashSync(resolvedPass.password, 10);
    const newRole = reqData.role === 'ADMIN' ? 'ADMIN' : 'GURU';

    await dbAppendRow('USERS', [newId, username, hash, newRole, nama, 'Aktif', profileUrl, resolvedPass.password]);
    
    await logger.info('ADD_GURU', `Menambahkan user (${newRole}): ${nama}`, adminId);
    return { success: true, message: `Guru berhasil ditambahkan (Password: ${resolvedPass.password}).` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function bulkAddGuruAction(rows: { username: string, nama: string, password?: string, role?: string, profile_url?: string }[], adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    const existing = await dbGetAll('USERS');
    const existingUsernames = new Set(existing.map(u => String(u.username).toLowerCase()));
    
    let count = 0;
    const credentials: Array<{ username: string; nama: string; role: string; password: string; generated: boolean }> = [];
    for (const row of rows) {
      const username = sanitizeInput(row.username).toLowerCase().replace(/\s/g,'');
      if (!username || existingUsernames.has(username)) continue;
      
      const newId = generateId('USR');
      const resolvedPassword = resolvePasswordOrGenerate(row.password);
      const hash = bcrypt.hashSync(resolvedPassword.password, 10);
      const newRole = row.role === 'ADMIN' ? 'ADMIN' : 'GURU';
      const profileUrl = row.profile_url ? sanitizeInput(row.profile_url).trim() : '';
      const sanitizedNama = sanitizeInput(row.nama);
      
      await dbAppendRow('USERS', [newId, username, hash, newRole, sanitizedNama, 'Aktif', profileUrl, resolvedPassword.password]);
      existingUsernames.add(username);
      credentials.push({
        username,
        nama: sanitizedNama,
        role: newRole,
        password: resolvedPassword.password,
        generated: resolvedPassword.generated,
      });
      count++;
    }

    await logger.info('BULK_GURU', `Import ${count} pengajar baru`, adminId);
    return { success: true, message: `${count} pengajar berhasil diimport.`, data: credentials };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteGuruBatchAction(ids: string[], adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id; // Override adminId with session ID

    let deletedCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      const res = await deleteGuruAction(id, adminId);
      if (res.success) deletedCount++;
      else errorCount++;
    }
    
    return { success: true, message: `Berhasil menghapus ${deletedCount} user. ${errorCount > 0 ? `${errorCount} gagal.` : ''}` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function resetPasswordBatchAction(ids: string[], customPassword?: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    let successCount = 0;
    const targetPass = customPassword?.trim() || 'guru12345';
    const credentials: Array<{ userId: string; username: string; nama: string; password: string }> = [];
    for (const id of ids) {
      const res = await resetPasswordAction(id, targetPass, adminId);
      if (res.success) {
        successCount++;
        if (res.data) credentials.push(res.data);
      }
    }
    return {
      success: true,
      message: `Password ${successCount} akun berhasil diatur ke "${targetPass}".`,
      data: credentials
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deleteGuruAction(userId: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    if (String(adminId) === String(userId)) {
      throw new Error("PENGHAPUSAN DITOLAK: Anda tidak dapat menghapus akun Anda sendiri (Self-Lockout Prevention).");
    }

    const allKunci = await dbGetAll('KUNCI_JAWABAN');
    const allHasil = await dbGetAll('HASIL');
    
    const adaKunci = allKunci.some(k => String(k.id_guru) === String(userId));
    const adaHasil = allHasil.some(h => String(h.id_guru) === String(userId));

    if (adaKunci || adaHasil) {
      throw new Error("PENGHAPUSAN DITOLAK: Guru ini memiliki Master Kunci Jawaban atau Riwayat Scan Nilai di Database. Untuk menghindari kerusakan data (Orphan Error), gunakan fitur Non-Aktifkan status atau Reset Password.");
    }

    const deleted = await dbFindAndDeleteRow('USERS', userId);
    if (!deleted) throw new Error('Guru tidak ditemukan.');

    await logger.warn('DEL_GURU', `Mencabut akses Guru permanen ID: ${userId}`, adminId);
    return { success: true, message: 'Akses guru berhasil ditarik permanen.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function toggleStatusGuruAction(userId: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    if (String(adminId) === String(userId)) {
        throw new Error("TINDAKAN DITOLAK: Anda tidak dapat membekukan akun Anda sendiri.");
    }
    const users = await dbGetAll('USERS');
    const target = users.find(u => u.id_user === userId);
    if (!target) throw new Error('User tidak ditemukan.');
    
    const newStatus = target.status === 'Aktif' ? 'Non-Aktif' : 'Aktif';
    const fallbackPlain = target.role === 'ADMIN' ? 'admin123' : 'guru12345';
    
    const updatedRow = [
      target.id_user,
      target.username,
      target.password_hash,
      target.role,
      target.nama,
      newStatus,
      target.profile_url || '',
      target.password_plain || fallbackPlain
    ];

    const updated = await dbUpdateRow('USERS', userId, updatedRow);
    if(!updated) throw new Error("Gagal update status database");

    await logger.info('TOGGLE_STATUS', `Mengubah status ${target.nama} menjadi: ${newStatus}`, adminId);
    return { success: true, message: `Status berhasil diubah menjadi: ${newStatus}` };
  } catch(e: any) {
    return { success: false, message: e.message };
  }
}

export async function resetPasswordAction(userId: string, newPassword?: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    const users = await dbGetAll('USERS');
    const target = users.find(u => u.id_user === userId);
    if (!target) throw new Error('User tidak ditemukan.');
    const resolvedPassword = resolvePasswordOrGenerate(newPassword);

    const newHash = bcrypt.hashSync(resolvedPassword.password, 10);
    const updatedRow = [
      target.id_user,
      target.username,
      newHash,
      target.role,
      target.nama,
      target.status || 'Aktif',
      target.profile_url || '',
      resolvedPassword.password
    ];

    const updated = await dbUpdateRow('USERS', userId, updatedRow);
    if(!updated) throw new Error("Gagal reset password di database");

    try {
      const { unlockUserLoginAttempts } = await import('@/lib/actions/auth');
      await unlockUserLoginAttempts(target.username);
    } catch {
      // Non-fatal
    }

    await logger.info('RESET_PASSWORD', `Mengatur password untuk ${target.nama} → ${resolvedPassword.password}`, adminId);
    return {
      success: true,
      message: `Password ${target.nama} berhasil diatur menjadi: "${resolvedPassword.password}"`,
      data: {
        userId: target.id_user,
        username: target.username,
        nama: target.nama,
        password: resolvedPassword.password,
      }
    };
  } catch(e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * editNamaAction — Admin dapat mengganti nama, username, dan/atau password user sekaligus.
 */
export async function editNamaAction(
  userId: string,
  namaBaru: string,
  adminId: string = 'SYSTEM',
  extra?: { username?: string; password?: string; role?: string }
) {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    if (!userId || !namaBaru || namaBaru.trim().length < 2) throw new Error('Nama baru minimal 2 karakter.');
    const users = await dbGetAll('USERS');
    const target = users.find(u => u.id_user === userId);
    if (!target) throw new Error('User tidak ditemukan.');

    let updatedUsername = target.username;
    if (extra?.username && extra.username.trim()) {
      const cleanU = sanitizeInput(extra.username).toLowerCase().replace(/\s+/g, '');
      if (cleanU.length < 3) throw new Error('Username minimal 3 karakter.');
      const isDup = users.some(u => u.id_user !== userId && String(u.username).toLowerCase() === cleanU);
      if (isDup) throw new Error(`Username "${cleanU}" sudah digunakan akun lain.`);
      updatedUsername = cleanU;
    }

    const fallbackPlain = target.role === 'ADMIN' ? 'admin123' : 'guru12345';
    let updatedHash = target.password_hash;
    let updatedPlain = target.password_plain || fallbackPlain;

    if (extra?.password && extra.password.trim()) {
      const cleanPass = extra.password.trim();
      if (cleanPass.length < 4) throw new Error('Password minimal 4 karakter.');
      updatedHash = bcrypt.hashSync(cleanPass, 10);
      updatedPlain = cleanPass;
    }

    const updatedRole = extra?.role && ['ADMIN', 'GURU'].includes(extra.role) ? extra.role : target.role;

    const updatedRow = [
      target.id_user,
      updatedUsername,
      updatedHash,
      updatedRole,
      sanitizeInput(namaBaru.trim()),
      target.status || 'Aktif',
      target.profile_url || '',
      updatedPlain
    ];

    const updated = await dbUpdateRow('USERS', userId, updatedRow);
    if (!updated) throw new Error('Gagal memperbarui akun di database.');

    await logger.info('EDIT_GURU', `Edit akun user ${userId} → ${namaBaru.trim()} (@${updatedUsername})`, adminId);
    return { success: true, message: 'Data akun berhasil diperbarui.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function updateProfileUrlAction(userId: string, profileUrl: string, adminId: string = 'SYSTEM') {
  try {
    const session = await requireMenuAccess('guru', 'full');
    adminId = session.id;

    const users = await dbGetAll('USERS');
    const target = users.find(u => u.id_user === userId);
    if (!target) throw new Error('User tidak ditemukan.');
    const fallbackPlain = target.role === 'ADMIN' ? 'admin123' : 'guru12345';

    const updatedRow = [
      target.id_user,
      target.username,
      target.password_hash,
      target.role,
      target.nama,
      target.status || 'Aktif',
      profileUrl.trim(),
      target.password_plain || fallbackPlain
    ];

    const updated = await dbUpdateRow('USERS', userId, updatedRow);
    if (!updated) throw new Error('Gagal memperbarui foto profil di database.');

    await logger.info('UPDATE_PROFILE', `Update foto profil user ${userId}`, adminId);
    return { success: true, message: 'Foto profil berhasil diperbarui.' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * forceResetAdminAction (Adaptasi ResetAdmin.gs)
 * Emergency tool: Mereset password admin default jika terkunci.
 * Memerlukan MASTER_SECRET dari environment variable untuk keamanan.
 */
export async function forceResetAdminAction(masterSecret: string) {
  try {
    const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
    if (!ADMIN_SECRET_KEY) throw new Error('ADMIN_SECRET_KEY environment variable is required. Set it in .env.local');
    
    if (masterSecret !== ADMIN_SECRET_KEY) {
      throw new Error('MASTER_SECRET tidak valid. Akses ditolak.');
    }

    const users = await dbGetAll('USERS');
    const adminUser = users.find(u => u.role === 'ADMIN');

    if (!adminUser) {
      throw new Error('Tidak ditemukan akun ADMIN di database.');
    }

    const emergencyPassword = process.env.EMERGENCY_ADMIN_RESET_PASSWORD?.trim() || 'admin123';
    const defaultPass = emergencyPassword;
    const newHash = bcrypt.hashSync(emergencyPassword, 10);

    const updatedRow = [
      adminUser.id_user,
      adminUser.username,
      newHash,
      'ADMIN',
      adminUser.nama,
      'Aktif',
      adminUser.profile_url || '',
      defaultPass
    ];

    await dbUpdateRow('USERS', adminUser.id_user, updatedRow);
    await logger.warn('FORCE_RESET_ADMIN', `Emergency reset password admin dilakukan.`, 'SYSTEM');

    return { 
      success: true, 
      message: `✅ Berhasil mereset sandi untuk Admin: ${adminUser.username}. Password baru: ${defaultPass}` 
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * getIRTStatsAction (Modernisasi UI_AdminTugas.html)
 * Mengambil analisis tingkat kesulitan soal (IRT) untuk suatu kunci ujian.
 */
export async function getIRTStatsAction(idKunci: string) {
  try {
    const allHasil = await dbGetAll('HASIL');
    const filteredHasil = allHasil.filter(h => String(h.id_kunci) === String(idKunci));
    
    if (filteredHasil.length === 0) {
      throw new Error("Belum ada data hasil scan untuk kunci ujian ini.");
    }

    const irtAnalysis = calculateIRTAnalysis(filteredHasil);
    return { success: true, data: irtAnalysis };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * getAdminDashboardStatsAction (Modernisasi UI_Admin.html)
 * Mengambil statistik agregat untuk dashboard admin.
 */
export async function getAdminDashboardStatsAction() {
  try {
    const authSession = await requireAuth();
    const { data: session } = await getAcademicSessionAction();
    const tahunAjaran = session?.tahunAjaran;
    const semester = session?.semester;

    const [users, kelas, mapel, siswa, hasil, tugas] = await Promise.all([
      dbGetAll('USERS', true),
      dbGetAll('KELAS', true),
      dbGetAll('MAPEL', true),
      dbGetAll('SISWA', true),
      dbGetAll('HASIL'),
      dbGetAll('TUGAS_GURU', true)
    ]);

    const cleanTahun = String(tahunAjaran || '').trim();
    const cleanSem = String(semester || '').trim().toUpperCase();

    // Apply global filter (case-insensitive, fallback if empty)
    let filteredKelas = kelas.filter(k => {
      const kTahun = String(k.tahun_ajaran || '').trim();
      return !cleanTahun || !kTahun || kTahun.toLowerCase() === cleanTahun.toLowerCase();
    });
    let filteredSiswa = siswa.filter(s => {
      const sTahun = String(s.tahun_ajaran || '').trim();
      return !cleanTahun || !sTahun || sTahun.toLowerCase() === cleanTahun.toLowerCase();
    });
    let filteredHasil = hasil.filter(h => {
      const hTahun = String(h.tahun_ajaran || '').trim();
      const hSem = String(h.semester || '').trim().toUpperCase();
      const matchTahun = !cleanTahun || !hTahun || hTahun.toLowerCase() === cleanTahun.toLowerCase();
      const matchSem = !cleanSem || !hSem || hSem === cleanSem;
      return matchTahun && matchSem;
    });
    let filteredMapel = [...mapel];

    // Guru Specific Filter
    if (authSession.role === 'GURU') {
      const myTugas = tugas.filter(t => {
        const matchUser = String(t.id_user) === String(authSession.id);
        const tTahun = String(t.tahun_ajaran || '').trim();
        const matchTahun = !cleanTahun || !tTahun || tTahun.toLowerCase() === cleanTahun.toLowerCase();
        return matchUser && matchTahun;
      });
      const myKelasIds = new Set(myTugas.map(t => t.id_kelas));
      const myMapelIds = new Set(myTugas.map(t => t.id_mapel));

      filteredKelas = filteredKelas.filter(k => myKelasIds.has(k.id_kelas));
      filteredSiswa = filteredSiswa.filter(s => myKelasIds.has(s.id_kelas));
      filteredHasil = filteredHasil.filter(h => String(h.id_guru) === String(authSession.id));
      filteredMapel = filteredMapel.filter(m => myMapelIds.has(m.id_mapel));
    }

    const totalGuru = users.filter(u => u.role === 'GURU').length;
    const totalSiswa = filteredSiswa.length;
    const totalKelas = filteredKelas.length;
    const totalMapel = filteredMapel.length;
    const totalScan = filteredHasil.length;

    // Statistik per jenjang
    const smpKelas = filteredKelas.filter(k => String(k.jenjang).toUpperCase() === 'SMP').length;
    const smaKelas = filteredKelas.filter(k => String(k.jenjang).toUpperCase() === 'SMA').length;
    
    const smpSiswa = filteredSiswa.filter(s => {
      const k = filteredKelas.find(kl => kl.id_kelas === s.id_kelas);
      return k && String(k.jenjang).toUpperCase() === 'SMP';
    }).length;

    const smaSiswa = filteredSiswa.filter(s => {
      const kl = filteredKelas.find(k => k.id_kelas === s.id_kelas);
      return kl && String(kl.jenjang).toUpperCase() === 'SMA';
    }).length;

    return {
      success: true,
      data: {
        counters: { totalGuru, totalSiswa, totalKelas, totalMapel, totalScan },
        jenjang: {
          smp: { kelas: smpKelas, siswa: smpSiswa },
          sma: { kelas: smaKelas, siswa: smaSiswa }
        }
      }
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * runSystemDoctorAction & healSystemAction
 * Delegasi ke src/lib/actions/doctor.ts (versi 11 tabel lengkap)
 */
export async function runSystemDoctorAction() {
  const { runSystemDoctorAction: runDoctor } = await import('@/lib/actions/doctor');
  return runDoctor();
}

export async function healSystemAction(adminId: string = 'SYSTEM') {
  const { healSystemAction: healDoctor } = await import('@/lib/actions/doctor');
  return healDoctor(adminId);
}

/**
 * getSystemLogsAction (Modernisasi view-admin-logs)
 * Membaca log aktivitas sistem terbaru.
 */
export async function getSystemLogsAction(limit: number = 100) {
  try {
    const session = await requireAuth();
    const allLogs = await dbGetAll('LOG');
    const normalizedLogs = allLogs.map(log => ({
      ...log,
      userId: log.userId || log.user_id || 'SYSTEM'
    }));

    const canViewAllLogs =
      session.role === 'ADMIN' || (await checkUserMenuAccess(session, 'logs', 'read'));

    const visibleLogs = canViewAllLogs
      ? normalizedLogs
      : normalizedLogs.filter(log => String(log.userId) === String(session.id));

    return { 
      success: true, 
      data: visibleLogs.reverse().slice(0, limit) 
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
