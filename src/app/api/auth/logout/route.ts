import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    const userId = session.id || 'GUEST';
    session.destroy();

    const response = NextResponse.json({ success: true, message: 'Berhasil keluar.' });
    const resSession = await getIronSession<SessionData>(req, response, sessionOptions);
    resSession.destroy();

    await logger.info('AUTH_LOGOUT', 'User logout (API)', userId);
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
