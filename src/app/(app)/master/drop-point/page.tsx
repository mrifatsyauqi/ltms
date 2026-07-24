import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { DropPointClient } from '@/components/master/drop-point-client';

export default async function Page() {
  const session = await auth();
  // Master Data khusus Admin Cabang (Bagian 5 PRD). Menu ini memang tidak muncul
  // di sidebar Admin DP, tapi tetap dijaga di sini sbg lapis kedua. Otorisasi
  // sebenarnya tetap ditegakkan di level API (Apps Script requireRole_).
  if (session?.user.role !== 'Admin Cabang') {
    return (
      <>
        <PageHeader title="Master Drop Point" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Halaman ini hanya untuk Admin Cabang.
        </div>
      </>
    );
  }

  return <DropPointClient />;
}
