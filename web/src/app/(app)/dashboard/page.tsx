import { auth } from '@/auth';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export default async function DashboardPage() {
  const session = await auth();
  const isCabang = session?.user.role === 'Admin Cabang';

  return (
    <DashboardClient
      // Judul Admin Cabang cukup "Dashboard" (tanpa nama DP); Admin DP menyertakan DP-nya.
      title={isCabang ? 'Dashboard' : 'Dashboard DP'}
      description={
        isCabang
          ? 'Ringkasan seluruh Drop Point.'
          : `Ringkasan paket Long Tail di DP ${session?.user.dropPoint ?? '-'}.`
      }
    />
  );
}
