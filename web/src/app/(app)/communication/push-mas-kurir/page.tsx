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
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12 space-y-6 md:space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center text-sm text-muted-foreground">
          <span>Communication Center</span>
          <span className="mx-2">›</span>
          <span className="font-medium text-foreground">Push Mas Kurir</span>
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Push Mas Kurir
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-3xl">
            Kirim WhatsApp ke Sprinter yang belum mencapai target TTD.
          </p>
        </div>

        {/* Content Tabs */}
        <PushMasKurirClient />
      </div>
    </PageTransition>
  );
}
