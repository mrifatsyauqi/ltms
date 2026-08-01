import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { RiwayatImportClient } from '@/components/riwayat/riwayat-import-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export default async function Page() {
  const session = await auth();
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="Riwayat Import" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.</div>
      </>
    );
  }

  // Defense-in-depth CHECKPOINT 3: menu_key riwayat_import - PAGE-LEVEL SAJA
  // (sengaja tidak ditegakkan di listImportBatches/import.ts, fungsi itu
  // dipakai BERSAMA oleh panel riwayat di dalam halaman /import - gate di
  // situ akan ikut merusak panel itu utk akun yg riwayat_import-nya mati
  // tapi import_longtail-nya masih hidup).
  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.riwayat_import) {
    return (
      <>
        <PageHeader title="Riwayat Import" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
      </>
    );
  }

  return <RiwayatImportClient />;
}
