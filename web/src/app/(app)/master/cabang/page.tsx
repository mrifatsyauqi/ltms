import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { CabangDropPointTabs } from '@/components/master/cabang-drop-point-tabs';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

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

  // Defense-in-depth CHECKPOINT 4: menu_key master_cabang - lapisan TAMBAHAN
  // di atas hasFullAccess di atas. requirePermission() yang sepadan sudah
  // ditegakkan di createCabang/updateCabang (cabang.ts) - listCabang SENGAJA
  // TIDAK digating krn dipakai bersama dropdown Kota di halaman Drop Point.
  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.master_cabang) {
    return (
      <>
        <PageHeader title="Cabang" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
      </>
    );
  }

  // Kelola Drop Point dari halaman Cabang juga (restrukturisasi nav: Super
  // Admin cuma punya 1 item "Cabang", Drop Point dikelola dari tab di sini).
  // Dihitung dari access aktor SENDIRI (bukan diasumsikan true) - lihat
  // catatan di CabangDropPointTabs.
  return <CabangDropPointTabs canManageDropPoint={access.master_drop_point === true} />;
}
