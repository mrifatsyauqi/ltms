import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { CabangClient } from '@/components/master/cabang-client';

export default async function Page() {
  const session = await auth();
  // Master Data khusus Admin Cabang (konsisten dgn /master/drop-point,
  // /master/users). Otorisasi sebenarnya tetap ditegakkan di level API.
  if (session?.user.role !== 'Admin Cabang') {
    return (
      <>
        <PageHeader title="Cabang" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang.</div>
      </>
    );
  }

  return <CabangClient />;
}
