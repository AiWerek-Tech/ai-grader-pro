import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { SessionData, assertSessionSecretConfigured, sessionOptions } from '@/lib/session';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  'metadata.google.internal',
]);

function isPrivateIpAddress(address: string) {
  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
}

async function assertAuthenticated() {
  const cookieStore = await cookies();
  assertSessionSecretConfigured();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.json({ success: false, message: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 });
  }

  return null;
}

async function assertSafeTarget(target: URL) {
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Hanya URL http/https yang diperbolehkan.');
  }

  if (target.username || target.password) {
    throw new Error('URL dengan kredensial tidak diperbolehkan.');
  }

  const hostname = target.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('Hostname tidak diperbolehkan.');
  }

  if (isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new Error('Alamat IP privat/internal tidak diperbolehkan.');
    }
    return;
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length) {
    throw new Error('Hostname tidak dapat di-resolve.');
  }

  const hasPrivateAddress = resolved.some(entry => isPrivateIpAddress(entry.address));
  if (hasPrivateAddress) {
    throw new Error('Target mengarah ke alamat internal/privat dan ditolak.');
  }
}

/**
 * Image Proxy â€” adaptasi apiProxyImage dari GAS.
 * Mengambil gambar dari URL eksternal dan mengembalikannya sebagai base64 data URI.
 * Endpoint ini kini dibatasi untuk user login dan memblokir target internal.
 */
export async function GET(request: Request) {
  try {
    const authError = await assertAuthenticated();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ success: false, message: 'URL tidak valid.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json({ success: false, message: 'Format URL tidak valid.' }, { status: 400 });
    }

    await assertSafeTarget(parsedUrl);

    const res = await fetch(parsedUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Gambar tidak dapat diakses (HTTP ${res.status}).` },
        { status: 502 }
      );
    }

    const contentLength = Number(res.headers.get('content-length') || '0');
    if (contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran gambar terlalu besar untuk diproses proxy.' },
        { status: 413 }
      );
    }

    let contentType = res.headers.get('content-type') || 'image/png';
    contentType = contentType.split(';')[0].trim();

    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ success: false, message: 'URL bukan gambar yang valid.' }, { status: 400 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran gambar melebihi batas maksimum proxy.' },
        { status: 413 }
      );
    }

    const b64 = Buffer.from(buffer).toString('base64');

    return NextResponse.json({
      success: true,
      data: `data:${contentType};base64,${b64}`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
