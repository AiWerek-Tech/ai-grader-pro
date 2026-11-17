import type { MetadataRoute } from 'next';
import { withBasePath } from '@/lib/base-path';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WMVAA AI Grader Pro',
    short_name: 'WMVAA Grader',
    description: 'Sistem Koreksi LJK Otomatis Berbasis AI Vision & Hybrid OMR',
    start_url: withBasePath(''),
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09051f',
    theme_color: '#09051f',
    icons: [
      {
        src: withBasePath('/brand/wmvaa_app_icon.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: withBasePath('/brand/wmvaa_app_icon.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
