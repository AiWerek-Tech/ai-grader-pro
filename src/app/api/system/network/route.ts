import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { BASE_PATH } from '@/lib/base-path';

export async function GET(req: NextRequest) {
  try {
    const port = process.env.PORT || '3000';
    const basePathSuffix = BASE_PATH || '';
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const protoHeader = req.headers.get('x-forwarded-proto') || (hostHeader && !hostHeader.includes('localhost') && !hostHeader.match(/^\d+\.\d+\.\d+\.\d+/) ? 'https' : 'http');

    const interfaces = os.networkInterfaces();
    const addresses: Array<{ name: string; ip: string; url: string; priority: number }> = [];

    // Jika diakses lewat domain publik (misal app.wmvaa.id), jadikan prioritas 0 (utama)
    if (hostHeader && !hostHeader.startsWith('localhost') && !hostHeader.match(/^(127\.|192\.168\.|10\.|172\.)/)) {
      addresses.push({
        name: 'Domain Hosting (HTTPS)',
        ip: hostHeader,
        url: `${protoHeader}://${hostHeader}${basePathSuffix}`,
        priority: 0,
      });
    }

    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets || []) {
        if (net.family === 'IPv4' && !net.internal && net.address) {
          // Hanya tampilkan IP jaringan lokal (RFC1918) agar interface internal hosting cPanel tidak membingungkan user
          const isPrivateLan =
            net.address.startsWith('192.168.') ||
            net.address.startsWith('10.') ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(net.address);
          if (!isPrivateLan) continue;

          // Prioritaskan Wi-Fi / Ethernet LAN fisik dibanding adapter virtual (WSL/Docker/VirtualBox)
          const lowerName = name.toLowerCase();
          const isVirtual =
            lowerName.includes('vethernet') ||
            lowerName.includes('virtual') ||
            lowerName.includes('vmware') ||
            lowerName.includes('vbox') ||
            lowerName.includes('wsl') ||
            net.address.startsWith('172.');
          const isWifi = lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('wireless');

          const priority = isVirtual ? 3 : isWifi ? 1 : 2;
          addresses.push({
            name,
            ip: net.address,
            url: `http://${net.address}:${port}${basePathSuffix}`,
            priority,
          });
        }
      }
    }

    addresses.sort((a, b) => a.priority - b.priority);

    return NextResponse.json({
      status: 'success',
      data: {
        hostname: os.hostname(),
        port,
        primaryUrl: addresses[0]?.url || `http://localhost:${port}${basePathSuffix}`,
        primaryIp: addresses[0]?.ip || 'localhost',
        interfaces: addresses,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Gagal mendeteksi IP jaringan lokal' },
      { status: 500 }
    );
  }
}
