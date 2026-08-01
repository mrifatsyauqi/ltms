import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { RoleAksesClient } from '@/components/master/role-akses-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export default async function Page() {
  const session = await auth();
  // Lapis KASAR (sudah ada sejak awal, JANGAN DIHAPUS): inilah satu-satunya
  // yang memblokir SPV Drop Point/Admin DP - mereka tak punya baris
  // role_akses sama sekali & fallback matrix-nya `?? true`, jadi pengecekan
  // granular di bawah TIDAK bisa menggantikan ini.
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="Role & Akses" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.</div>
      </>
    );
  }

  // Lapis GRANULAR (defense-in-depth, sejalan dgn requireManagerActor() di
  // lib/data/supabase/role-akses.ts): Super Admin bisa mencabut menu ini utk
  // SATU akun Admin Cabang/Manager Kota/Asisten Manager Kota tanpa menurunkan
  // status full access-nya. Sidebar sudah menyembunyikan link-nya (lib/nav.ts),
  // ini jaga-jaga kalau URL-nya dibuka langsung. Super Admin sendiri selalu
  // true (bypass permanen, tak pernah query DB).
  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.role_akses) {
    return (
      <>
        <PageHeader title="Role & Akses" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Super Admin.
        </div>
      </>
    );
  }

  return <RoleAksesClient />;
}
