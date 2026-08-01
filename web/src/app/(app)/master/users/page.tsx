import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { UserManagementClient } from '@/components/master/user-management-client';
import { hasFullAccess } from '@/lib/roles';

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
  return <UserManagementClient selfEmail={session?.user.email ?? ''} />;
}
