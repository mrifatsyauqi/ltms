import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { auth } from '@/auth';
import { MonitoringClient } from '@/components/monitoring-delivery/monitoring-client';
import { MonitoringRefineClient } from '@/components/monitoring-delivery/monitoring-refine-client';
import { hasFullAccess } from '@/lib/roles';

export const metadata = {
  title: 'Monitoring Delivery - LTMS',
};

export default async function MonitoringDeliveryPage() {
  const session = await auth();
  const role = session?.user.role;
  const isFullAccess = hasFullAccess(role);

  // Fitur ini ditujukan untuk full access (Admin Cabang/Manager Kota/Asisten
  // Manager Kota/Super Admin - Langkah 3), Admin DP, dan SPV Drop Point.
  // 'Admin Pusat' TETAP TIDAK DISENTUH (sisa kode lama, di luar scope - lihat
  // catatan audit Langkah Jabatan sebelumnya).
  if (!isFullAccess && role !== 'Admin DP' && role !== 'SPV Drop Point' && (role as string) !== 'Admin Pusat') {
    redirect('/dashboard');
  }

  const isCabang = isFullAccess || role === 'SPV Drop Point';
  const dpName = session?.user.dropPoint || 'SEMUA DP';

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Monitoring Delivery"
        description={
          isCabang
            ? 'Generate dan copy tabel Monitoring Delivery per Drop Point (Refine Total) dari file Excel JMS.'
            : 'Generate dan copy tabel Monitoring Delivery per Sprinter dari file Excel JMS.'
        }
      />

      {isCabang ? <MonitoringRefineClient /> : <MonitoringClient dpName={dpName} isCabang={false} />}
    </div>
  );
}
