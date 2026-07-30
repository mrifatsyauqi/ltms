'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';

/**
 * Default global: 30 detik. Cukup pendek utk data yang perlu terasa live
 * (dashboard, longtail, last-update) - navigasi bolak-balik dalam rentang ini
 * tidak menembak ulang network, tapi data tak pernah basi lama. Query yang
 * jarang berubah (drop-points, master-feedback, users, favorite-feedback)
 * meng-override ke staleTime lebih panjang di masing-masing call site
 * (lihat komentar "jarang berubah" di tiap file terkait).
 */
const DEFAULT_STALE_TIME = 30 * 1000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: DEFAULT_STALE_TIME },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
