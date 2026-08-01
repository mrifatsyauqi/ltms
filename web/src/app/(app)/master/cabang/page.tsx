import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { CabangClient } from '@/components/master/cabang-client';
import { hasFullAccess } from '@/lib/roles';

export default async function Page() {
  const session = await auth();
  // Master Data khusus full access (konsisten dgn /master/drop-point,
  // /master/users - Langkah 3). Otorisasi sebenarnya tetap ditegakkan di level API.
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="Cabang" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.</div>
      </>
    );
  }

  return <CabangClient />;
}
