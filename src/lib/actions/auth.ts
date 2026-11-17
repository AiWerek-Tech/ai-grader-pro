'use server';

import bcrypt from 'bcryptjs';
import { dbGetAll, dbAppendRow, generateId, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/session-server';
import { getBootstrapMode, getBootstrapUsers } from '@/lib/bootstrap-users';

// ============================================================
// Auth Actions — Adaptasi Auth.gs (Rate Limiting + Login + Logout)
// Schema USERS: [id_user(0), username(1), password_hash(2), role(3), nama(4), status(5), profile_url(6)]
// ============================================================

// --- IN-MEMORY RATE LIMITER ---
// Key: username lowercase → { attempts: number, lockedUntil: timestamp }
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 10;       // Dilonggarkan untuk kemudahan penggunaan di sekolah
const LOCKOUT_DURATION = 60000; // 1 menit lockout (ms)

export async function unlockUserLoginAttempts(username?: string) {
  if (!username) {
    loginAttempts.clear();
    return;
  }
  const key = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  loginAttempts.delete(key);
}

function checkRateLimit(username: string): { allowed: boolean; remaining: number; message?: string } {
  const key = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (entry && entry.lockedUntil > now) {
    const secsLeft = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      message: `Akun dikunci sementara. Coba lagi dalam ${secsLeft} detik atau hubungi Admin untuk reset.`
    };
  }

  // Reset jika lockout sudah lewat
  if (entry && entry.lockedUntil <= now && entry.attempts >= MAX_ATTEMPTS) {
    loginAttempts.delete(key);
  }

  const current = loginAttempts.get(key);
  const attempts = current?.attempts || 0;
  return { allowed: true, remaining: MAX_ATTEMPTS - attempts };
}

function recordFailedAttempt(username: string): number {
  const key = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const entry = loginAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
  entry.attempts += 1;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }

  loginAttempts.set(key, entry);
  return MAX_ATTEMPTS - entry.attempts;
}

function clearAttempts(username: string) {
  const key = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  loginAttempts.delete(key);
}

// ============================================================
// LOGIN ACTION
// Adaptasi apiLogin() dari Auth.gs baris 10-74
// ============================================================
export async function loginAction(username: string, password: string) {
  try {
    if (!username || !password) {
      return { success: false, message: 'Username dan password wajib diisi.' };
    }

    const usernameClean = sanitizeInput(username).toLowerCase().replace(/^@/, '').trim();

    // --- Rate Limit Check ---
    const rateCheck = checkRateLimit(usernameClean);
    if (!rateCheck.allowed) {
      await logger.error('LOGIN_BLOCKED', `Login diblokir: ${usernameClean}`, 'SYSTEM');
      return { success: false, message: rateCheck.message!, locked: true };
    }

    // --- Auto-Seed jika USERS kosong ---
    await seedDefaultUsers();

    // --- Cari user di database (Mendukung username persis, nama depan, atau nama lengkap) ---
    const users = await dbGetAll('USERS');
    let target = users.find(u => String(u.username || '').toLowerCase().trim() === usernameClean);

    if (!target) {
      // Coba cari berdasarkan nama lengkap atau awalan username (misal "frengky" -> "frengky.lokobal")
      const prefixMatches = users.filter(u => {
        const uName = String(u.username || '').toLowerCase().trim();
        const fullNama = String(u.nama || '').toLowerCase().trim();
        const firstPart = uName.split('.')[0];
        return firstPart === usernameClean || fullNama === usernameClean || fullNama.startsWith(usernameClean + ',') || fullNama.startsWith(usernameClean + ' ');
      });
      if (prefixMatches.length === 1) {
        target = prefixMatches[0];
      }
    }

    if (!target) {
      const remaining = recordFailedAttempt(usernameClean);
      await logger.error('LOGIN_FAILED', `Username tidak ditemukan: ${usernameClean}`, 'GUEST');
      return {
        success: false,
        message: remaining > 0
          ? `Username "${username}" tidak ditemukan. (${remaining} percobaan tersisa)`
          : `Akun dikunci sementara. Hubungi Admin untuk bantuan.`,
        remaining,
        locked: remaining <= 0,
      };
    }

    // --- Cek Status Akun ---
    if (String(target.status) === 'Non-Aktif') {
      await logger.error('LOGIN_BLOCKED', `Akun dibekukan: ${usernameClean}`, target.id_user);
      return {
        success: false,
        message: 'Akses Anda sedang dinonaktifkan oleh Administrator.',
        locked: true,
      };
    }

    // --- Verifikasi Password (mendukung bcrypt hash MAUPUN password_plain jika diedit dari Spreadsheet) ---
    const plainMatch = Boolean(target.password_plain && String(target.password_plain) === password);
    const hashMatch = Boolean(target.password_hash && bcrypt.compareSync(password, target.password_hash));
    const passwordMatch = plainMatch || hashMatch;

    if (!passwordMatch) {
      const remaining = recordFailedAttempt(usernameClean);
      await logger.error('LOGIN_FAILED', `Password salah untuk: ${usernameClean}`, 'GUEST');
      return {
        success: false,
        message: remaining > 0
          ? `Password salah untuk akun @${target.username}. (${remaining} percobaan tersisa)`
          : `Terlalu banyak percobaan gagal. Silakan tunggu 1 menit atau minta Admin reset password.`,
        remaining,
        locked: remaining <= 0,
      };
    }

    // Jika password_plain belum tersimpan di sheet (atau hash diedit manual), sinkronkan otomatis
    if (!target.password_plain || !hashMatch) {
      try {
        const { dbUpdateRow } = await import('@/lib/google-sheets');
        const syncedHash = hashMatch ? target.password_hash : bcrypt.hashSync(password, 10);
        await dbUpdateRow('USERS', target.id_user, [
          target.id_user,
          target.username,
          syncedHash,
          target.role,
          target.nama,
          target.status || 'Aktif',
          target.profile_url || '',
          password,
        ]);
      } catch {
        // Non-fatal
      }
    }

    // --- LOGIN BERHASIL ---
    clearAttempts(usernameClean);
    clearAttempts(String(target.username || ''));

    const session = await getSession();
    session.id = target.id_user;
    session.username = target.username;
    session.role = target.role;
    session.nama = target.nama;
    session.profile_url = target.profile_url || '';
    session.isLoggedIn = true;
    await session.save();

    await logger.info('AUTH_LOGIN', `Login berhasil: ${target.nama} [${target.role}]`, target.id_user);

    return {
      success: true,
      user: {
        id: target.id_user,
        username: target.username,
        role: target.role,
        nama: target.nama,
        profile_url: target.profile_url || '',
      }
    };
  } catch (e: any) {
    await logger.error('LOGIN_ERROR', e.message, 'SYSTEM');
    return { success: false, message: 'Kesalahan sistem: ' + e.message };
  }
}

/**
 * Daftar akun publik (nama & username saja) untuk memudahkan guru memilih akun saat login di sekolah
 */
export async function getPublicLoginUsersAction() {
  try {
    const users = await dbGetAll('USERS', true);
    return {
      success: true,
      data: users
        .filter(u => u.status !== 'Non-Aktif')
        .map(u => ({
          username: String(u.username || ''),
          nama: String(u.nama || ''),
          role: String(u.role || 'GURU'),
        })),
    };
  } catch (e: any) {
    return { success: false, data: [], message: e.message };
  }
}

// ============================================================
// LOGOUT ACTION
// ============================================================
export async function logoutAction() {
  try {
    const session = await getSession();
    const userId = session.id || 'UNKNOWN';
    session.destroy();
    await logger.info('AUTH_LOGOUT', `User logout`, userId);
    return { success: true };
  } catch {
    return { success: true };
  }
}

/**
 * Mengambil informasi akun & password_plain milik user yang sedang login
 */
export async function getMyAccountCredentialsAction() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.id) {
      return { success: false, message: 'Sesi tidak valid.' };
    }
    const users = await dbGetAll('USERS');
    const target = users.find(u => String(u.id_user) === String(session.id));
    if (!target) return { success: false, message: 'User tidak ditemukan.' };

    return {
      success: true,
      data: {
        id: target.id_user,
        username: target.username,
        nama: target.nama,
        role: target.role,
        profile_url: target.profile_url || '',
        password_plain: target.password_plain || (target.role === 'ADMIN' ? 'admin123' : 'guru12345'),
      },
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/**
 * updateMyProfileAction
 * Memungkinkan user (Guru/Admin) memperbarui profil (nama, username, foto, dan/atau password) mereka sendiri.
 */
export async function updateMyProfileAction(data: {
  nama?: string;
  username?: string;
  profile_url?: string;
  new_password?: string;
}) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.id) {
      throw new Error('Sesi tidak valid. Silakan login kembali.');
    }

    const userId = session.id;
    const users = await dbGetAll('USERS');
    const targetIndex = users.findIndex(u => u.id_user === userId);
    
    if (targetIndex === -1) throw new Error('User tidak ditemukan.');
    const target = users[targetIndex];

    const updatedNama = data.nama ? sanitizeInput(data.nama).trim() : target.nama;
    const updatedProfileUrl = data.profile_url !== undefined ? sanitizeInput(data.profile_url).trim() : target.profile_url;

    let updatedUsername = target.username;
    if (data.username && data.username.trim()) {
      const cleanU = sanitizeInput(data.username).toLowerCase().replace(/\s+/g, '');
      if (cleanU.length < 3) throw new Error('Username minimal 3 karakter.');
      const isDup = users.some(u => u.id_user !== userId && String(u.username).toLowerCase() === cleanU);
      if (isDup) throw new Error(`Username "${cleanU}" sudah dipakai akun lain.`);
      updatedUsername = cleanU;
    }

    let updatedHash = target.password_hash;
    let updatedPlain = target.password_plain || (target.role === 'ADMIN' ? 'admin123' : 'guru12345');

    if (data.new_password && data.new_password.trim()) {
      const cleanPass = data.new_password.trim();
      if (cleanPass.length < 4) {
        throw new Error('Password baru minimal 4 karakter.');
      }
      updatedHash = bcrypt.hashSync(cleanPass, 10);
      updatedPlain = cleanPass;
    }

    const updatedRow = [
      target.id_user,
      updatedUsername,
      updatedHash,
      target.role,
      updatedNama,
      target.status || 'Aktif',
      updatedProfileUrl || '',
      updatedPlain,
    ];

    const { dbUpdateRow } = await import('@/lib/google-sheets');
    const updated = await dbUpdateRow('USERS', userId, updatedRow);
    
    if (!updated) throw new Error('Gagal memperbarui profil di database.');

    // Update session
    session.nama = updatedNama;
    session.username = updatedUsername;
    session.profile_url = updatedProfileUrl;
    await session.save();

    await logger.info('UPDATE_MY_PROFILE', `User memperbarui profil/sandi mandiri: ${updatedNama}`, userId);
    
    return {
      success: true,
      message: data.new_password?.trim()
        ? 'Profil dan Password baru berhasil disimpan!'
        : 'Profil berhasil diperbarui!',
      password_plain: updatedPlain,
      username: updatedUsername,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// ============================================================
// AUTO-SEED DEFAULT USERS
// Adaptasi ResetAdmin.gs — Buat user awal jika sheet USERS kosong
// ============================================================
export async function seedDefaultUsers() {
  try {
    const existing = await dbGetAll('USERS');
    if (existing.length > 0) return; // Sudah ada data, skip

    const defaultUsers = getBootstrapUsers();

    for (const u of defaultUsers) {
      const id = generateId('USR');
      const hash = bcrypt.hashSync(u.password, 10);
      await dbAppendRow('USERS', [id, u.username, hash, u.role, u.nama, 'Aktif', '']);
    }

    await logger.info('SEED_USERS', `Auto-seed bootstrap (${getBootstrapMode()}): ${defaultUsers.length} akun berhasil dibuat.`, 'SYSTEM');
  } catch (e: any) {
    console.error('[SEED_USERS] Gagal seed:', e.message);
    // Non-fatal — lanjutkan tanpa throw
  }
}
