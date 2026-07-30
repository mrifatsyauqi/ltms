import { PublicDashboardClient } from '@/components/public-share/public-dashboard-client';

// Validasi token sudah dilakukan di layout.tsx (segmen [token]) - page ini
// tinggal render, tak perlu validasi ulang.
export default async function PublicDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicDashboardClient token={token} />;
}
