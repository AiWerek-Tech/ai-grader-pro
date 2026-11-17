import { NextResponse } from 'next/server';
import { dbGetAll } from '@/lib/google-sheets';

export async function GET() {
  try {
    const users = await dbGetAll('USERS', true);
    const data = users
      .filter(u => u.status !== 'Non-Aktif')
      .map(u => ({
        username: String(u.username || ''),
        nama: String(u.nama || ''),
        role: String(u.role || 'GURU'),
      }));
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, data: [], message: err.message }, { status: 500 });
  }
}
