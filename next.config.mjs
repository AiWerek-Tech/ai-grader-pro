import os from "os";

function getDynamicLanOrigins(port = 3000) {
  const devOrigins = new Set([
    'localhost',
    `localhost:${port}`,
    '127.0.0.1',
    `127.0.0.1:${port}`,
    '192.168.1.62',
    `192.168.1.62:${port}`,
  ]);
  const actionOrigins = new Set([
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `192.168.1.62:${port}`,
    '192.168.*.*:3000',
    '10.*.*.*:3000',
    '172.*.*.*:3000',
  ]);

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal && net.address) {
          devOrigins.add(net.address);
          devOrigins.add(`${net.address}:${port}`);
          actionOrigins.add(`${net.address}:${port}`);
        }
      }
    }
  } catch {
    // Fallback safe
  }

  // Support production domain & custom origins for cPanel / Cloud Hosting
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((origin) => {
      const clean = origin.trim();
      if (clean) {
        actionOrigins.add(clean);
        devOrigins.add(clean);
      }
    });
  }
  // Auto-allow school domains & subdomains
  actionOrigins.add('wmvaa.sch.id');
  actionOrigins.add('*.wmvaa.sch.id');
  actionOrigins.add('wmvaa.id');
  actionOrigins.add('*.wmvaa.id');
  actionOrigins.add('app.wmvaa.id');

  return {
    devOrigins: Array.from(devOrigins),
    actionOrigins: Array.from(actionOrigins),
  };
}

const parsedPort = Number(process.env.PORT);
const { devOrigins, actionOrigins } = getDynamicLanOrigins(Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000);

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/ai-grader';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: configuredBasePath || undefined,
  serverExternalPackages: ['sharp'],
  allowedDevOrigins: devOrigins,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // CSRF protection for server actions with dynamic LAN IP support
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
      allowedOrigins: actionOrigins,
    },
  },
  async headers() {
    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // Next.js requires 'unsafe-inline' for style injection; adjust if using strict CSP with nonces
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          // globals.css meng-import Plus Jakarta Sans dari Google Fonts
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          // Allow images from self, data URIs (base64), and Google Drive
          "img-src 'self' data: blob: https:",
          // Allow fetching from same origin + websockets on LAN
          "connect-src 'self' ws: wss:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ];

    if (process.env.SESSION_COOKIE_SECURE === 'true') {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      });
    }

    return [
      {
        source: '/:path*',
        headers: [
          ...baseHeaders,
          { key: 'X-LiteSpeed-Cache-Control', value: 'no-cache' },
        ],
      },
      {
        source: '/((?!_next/static|brand|logo|icon\\.png).*)',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
