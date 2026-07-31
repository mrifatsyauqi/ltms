import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { auth } from '@/auth';
import { MonitoringClient } from '@/components/monitoring-delivery/monitoring-client';
import { MonitoringRefineClient } from '@/components/monitoring-delivery/monitoring-refine-client';

export const metadata = {
  title: 'Monitoring Delivery - LTMS',
};

export default async function MonitoringDeliveryPage() {
  const session = await auth();

  // Fitur ini ditujukan untuk Admin Cabang dan Admin DP
  if (session?.user.role !== 'Admin Cabang' && session?.user.role !== 'Admin DP' && session?.user.role !== 'Admin Pusat') {
    redirect('/dashboard');
  }

  const isCabang = session?.user.role === 'Admin Cabang';
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
