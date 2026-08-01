import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { DropPointClient } from '@/components/master/drop-point-client';
import { hasFullAccess } from '@/lib/roles';

export default async function Page() {
  const session = await auth();
  // Master Data khusus full access (Admin Cabang/Manager Kota/Asisten Manager
  // Kota/Super Admin - Langkah 3). Menu ini memang tidak muncul di sidebar
  // Admin DP/SPV Drop Point, tapi tetap dijaga di sini sbg lapis kedua.
  // Otorisasi sebenarnya tetap ditegakkan di level API (requireRole).
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="Master Drop Point" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.
        </div>
      </>
    );
  }

  return <DropPointClient />;
}
