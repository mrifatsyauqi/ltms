import { Metadata } from 'next';
import { PageTransition } from '@/components/layout/page-transition';
import { PushMasKurirClient } from '@/components/communication/push-mas-kurir/push-mas-kurir-client';

export const metadata: Metadata = {
  title: 'Push Mas Kurir | LTMS',
  description: 'Broadcast WhatsApp ke Sprinter terkait performa TTD',
};

export default function PushMasKurirPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Push Mas Kurir</h1>
          <p className="text-muted-foreground mt-2">
            Kirim WhatsApp broadcast ke Sprinter yang belum mencapai target TTD.
          </p>
        </div>
        <PushMasKurirClient />
      </div>
    </PageTransition>
  );
}
