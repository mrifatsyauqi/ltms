import { PublicLongtailClient } from '@/components/public-share/public-longtail-client';

// Validasi token sudah dilakukan di layout.tsx (segmen [token]) - page ini
// tinggal render, tak perlu validasi ulang.
export default async function PublicDataLongtailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicLongtailClient token={token} />;
}
