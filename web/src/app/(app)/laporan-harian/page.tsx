import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { auth } from '@/auth';
import { LaporanHarianClient } from '@/components/laporan-harian/laporan-harian-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export const metadata = {
  title: 'Laporan Harian - LTMS',
};

export default async function LaporanHarianPage() {
  const session = await auth();
  const role = session?.user.role;
  const isFullAccess = hasFullAccess(role);

  if (!isFullAccess && role !== 'Admin DP' && role !== 'SPV Drop Point') {
    redirect('/dashboard');
  }

  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.laporan_harian) {
    return (
      <>
        <PageHeader title="Laporan Harian" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
      </>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Laporan Harian"
        description="Laporan harian operasional Drop Point: Rincian Nominal COD Kurir, informasi operasional, dan dokumentasi foto."
      />
      <LaporanHarianClient userRole={role} userDropPoint={session?.user.dropPoint} />
    </div>
  );
}
