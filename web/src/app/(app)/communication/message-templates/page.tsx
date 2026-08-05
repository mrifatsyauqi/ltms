'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MessageTemplatesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/communication/card-templates');
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-slate-500">
      Mengarahkan ke Card Templates...
    </div>
  );
}
