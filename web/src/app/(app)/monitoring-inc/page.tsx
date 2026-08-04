import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { auth } from '@/auth';
import { MonitoringIncClient } from '@/components/monitoring-inc/monitoring-inc-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export const metadata = {
  title: 'Monitoring INC - LTMS',
};

export default async function MonitoringIncPage() {
  const session = await auth();
  const role = session?.user.role;
  const isFullAccess = hasFullAccess(role);
  const isLegacyAdminPusat = (role as string) === 'Admin Pusat';

  // Fitur Monitoring INC dapat diakses oleh Full Access (Admin Cabang, Manager Kota, Asisten Manager Kota, Super Admin)
  // serta Admin DP dan SPV Drop Point.
  if (!isFullAccess && role !== 'Admin DP' && role !== 'SPV Drop Point' && !isLegacyAdminPusat) {
    redirect('/dashboard');
  }

  // Defense-in-depth: Cek gating izin menu_key 'monitoring_inc'
  if (!isLegacyAdminPusat) {
    const access = await getMyMenuAccess(session?.user.email ?? '');
    if (!access.monitoring_inc) {
      return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          <PageHeader title="Monitoring INC" description="Akses ditolak." />
          <div className="text-muted-foreground p-6 text-sm">
            Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <MonitoringIncClient
        userRole={role}
        userDropPoint={session?.user.dropPoint}
      />
    </div>
  );
}
