import type { Metadata } from 'next';
import { resolvePublicKartuPortal } from '@/lib/kartu-portal-data';
import {
  KartuPortalClient,
  KartuPortalErrorState,
} from '@/components/kartu/KartuPortalClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verifikasi Kartu Peserta Asesmen — WMVAA',
  description: 'Portal resmi status peserta asesmen & integrasi LJK melalui QR Code.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function KartuQrPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await resolvePublicKartuPortal(token);

  if (!result.valid) {
    return (
      <KartuPortalErrorState
        reason={result.reason}
        schoolName={result.schoolName}
      />
    );
  }

  return <KartuPortalClient data={result} />;
}
