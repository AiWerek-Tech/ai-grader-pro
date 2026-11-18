import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbGetAll, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';
import { withBasePath } from '@/lib/base-path';

export async function POST(req: NextRequest) {
  let isFormPost = false;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '192.168.1.62:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const baseOrigin = `${proto}://${host}`;

  try {
    let username = '';
    let password = '';

    const contentType = req.headers.get('content-type') || '';
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      isFormPost = true;
      const formData = await req.formData();
      username = String(formData.get('username') || '').trim();
      password = String(formData.get('password') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      username = String(body.username || '').trim();
      password = String(body.password || '');
    }

    if (!username || !password) {
      if (isFormPost) {
        return NextResponse.redirect(
          new URL(withBasePath('/login?error=' + encodeURIComponent('Username dan password wajib diisi.')), baseOrigin)
        );
      }
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const usernameClean = sanitizeInput(username).toLowerCase().replace(/^@/, '').trim();

    // 1. Ambil data users dari Google Sheets (dengan caching cerdas)
    const users = await dbGetAll('USERS', true);
    let target = users.find(u => String(u.username || '').toLowerCase().trim() === usernameClean);

    if (!target) {
      const prefixMatches = users.filter(u => {
        const uName = String(u.username || '').toLowerCase().trim();
        const fullNama = String(u.nama || '').toLowerCase().trim();
        const firstPart = uName.split('.')[0];
        return (
          firstPart === usernameClean ||
          fullNama === usernameClean ||
          fullNama.startsWith(usernameClean + ',') ||
          fullNama.startsWith(usernameClean + ' ')
        );
      });
      if (prefixMatches.length === 1) {
        target = prefixMatches[0];
      }
    }

    if (!target) {
      await logger.error('LOGIN_FAILED', `Username tidak ditemukan (API): ${usernameClean}`, 'GUEST');
      if (isFormPost) {
        return NextResponse.redirect(
          new URL(withBasePath('/login?error=' + encodeURIComponent(`Username "${username}" tidak ditemukan.`)), baseOrigin)
        );
      }
      return NextResponse.json(
        { success: false, message: `Username "${username}" tidak ditemukan.` },
        { status: 401 }
      );
    }

    // 2. Cek status akun
    if (String(target.status) === 'Non-Aktif') {
      await logger.error('LOGIN_BLOCKED', `Akun dinonaktifkan (API): ${usernameClean}`, target.id_user);
      if (isFormPost) {
        return NextResponse.redirect(
          new URL(withBasePath('/login?error=' + encodeURIComponent('Akses Anda sedang dinonaktifkan oleh Administrator.')), baseOrigin)
        );
      }
      return NextResponse.json(
        { success: false, message: 'Akses Anda sedang dinonaktifkan oleh Administrator.' },
        { status: 403 }
      );
    }

    // 3. Verifikasi password (bcrypt hash atau password_plain)
    const plainMatch = Boolean(target.password_plain && String(target.password_plain) === password);
    const hashMatch = Boolean(target.password_hash && bcrypt.compareSync(password, target.password_hash));
    const passwordMatch = plainMatch || hashMatch;

    if (!passwordMatch) {
      await logger.error('LOGIN_FAILED', `Password salah (API) untuk: ${usernameClean}`, 'GUEST');
      if (isFormPost) {
        return NextResponse.redirect(
          new URL(withBasePath('/login?error=' + encodeURIComponent(`Password salah untuk akun @${target.username}.`)), baseOrigin)
        );
      }
      return NextResponse.json(
        { success: false, message: `Password salah untuk akun @${target.username}.` },
        { status: 401 }
      );
    }

    // 4. Buat response object (Redirect jika form post biasa, JSON jika AJAX fetch)
    const response = isFormPost
      ? NextResponse.redirect(new URL(withBasePath('/dashboard'), baseOrigin))
      : NextResponse.json({
          success: true,
          user: {
            id: target.id_user,
            username: target.username,
            role: target.role,
            nama: target.nama,
            profile_url: target.profile_url || '',
          },
        });

    const rawProfileUrl = String(target.profile_url || '');
    const cookieSafeProfileUrl = rawProfileUrl.length <= 512 ? rawProfileUrl : '';

    // 5. Simpan session dengan iron-session via cookieStore dan response headers
    try {
      const cookieStore = await cookies();
      const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
      session.id = target.id_user;
      session.username = target.username;
      session.role = target.role;
      session.nama = target.nama;
      session.profile_url = cookieSafeProfileUrl;
      session.isLoggedIn = true;
      await session.save();
    } catch (sessionErr) {
      console.warn('Gagal set via cookieStore, mencoba via response headers:', sessionErr);
    }

    const resSession = await getIronSession<SessionData>(req, response, sessionOptions);
    resSession.id = target.id_user;
    resSession.username = target.username;
    resSession.role = target.role;
    resSession.nama = target.nama;
    resSession.profile_url = cookieSafeProfileUrl;
    resSession.isLoggedIn = true;
    await resSession.save();

    await logger.info('AUTH_LOGIN', `Login sukses: ${target.nama} [${target.role}]`, target.id_user);

    return response;
  } catch (err: any) {
    console.error('API Login Error:', err);
    await logger.error('LOGIN_ERROR', `Error API login: ${err.message}`, 'SYSTEM');
    if (isFormPost) {
      return NextResponse.redirect(
        new URL(withBasePath('/login?error=' + encodeURIComponent('Kesalahan sistem: ' + err.message)), baseOrigin)
      );
    }
    return NextResponse.json(
      { success: false, message: 'Kesalahan sistem: ' + err.message },
      { status: 500 }
    );
  }
}
