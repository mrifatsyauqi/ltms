import { auth } from '@/auth';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { hasFullAccess } from '@/lib/roles';

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user.role;
  // Manager Kota/Asisten Manager Kota IDENTIK Admin Cabang (Langkah 3); SPV
  // Drop Point ikut framing "multi-DP" (bisa >1 DP disupervisi) meski bukan
  // full access - scoping data sebenarnya tetap ditegakkan server-side di
  // getDashboard(), flag ini cuma menentukan judul/copy halaman.
  const isSpv = role === 'SPV Drop Point';
  const isCabang = hasFullAccess(role) || isSpv;

  return (
    <DashboardClient
      // Judul Admin Cabang cukup "Dashboard" (tanpa nama DP); Admin DP menyertakan DP-nya.
      title={isCabang ? 'Dashboard' : 'Dashboard DP'}
      description={
        isSpv
          ? 'Ringkasan Drop Point yang Anda supervisi.'
          : isCabang
            ? 'Ringkasan seluruh Drop Point.'
            : `Ringkasan paket Long Tail di DP ${session?.user.dropPoint ?? '-'}.`
      }
    />
  );
}
