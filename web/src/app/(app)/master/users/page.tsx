import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { UserManagementClient } from '@/components/master/user-management-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export default async function Page() {
  const session = await auth();
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="User Management" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.</div>
      </>
    );
  }

  // Defense-in-depth CHECKPOINT 4: menu_key user_management - lapisan
  // TAMBAHAN. requirePermission() sepadan sudah ditegakkan di
  // createUser/updateUser/deleteUser/setUserPassword/syncSupervisedDropPoints
  // - listUsers SENGAJA TIDAK digating (dipakai bersama dropdown Manager/SPV
  // di halaman Cabang & Drop Point).
  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.user_management) {
    return (
      <>
        <PageHeader title="User Management" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
      </>
    );
  }

  return <UserManagementClient selfEmail={session?.user.email ?? ''} />;
}
