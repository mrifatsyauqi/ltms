import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { auth } from '@/auth';
import { MonitoringClient } from '@/components/monitoring-delivery/monitoring-client';
import { MonitoringRefineClient } from '@/components/monitoring-delivery/monitoring-refine-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export const metadata = {
  title: 'Monitoring Delivery - LTMS',
};

export default async function MonitoringDeliveryPage() {
  const session = await auth();
  const role = session?.user.role;
  const isFullAccess = hasFullAccess(role);
  const isLegacyAdminPusat = (role as string) === 'Admin Pusat';

  // Fitur ini ditujukan untuk full access (Admin Cabang/Manager Kota/Asisten
  // Manager Kota/Super Admin - Langkah 3), Admin DP, dan SPV Drop Point.
  // 'Admin Pusat' TETAP TIDAK DISENTUH (sisa kode lama, di luar scope - lihat
  // catatan audit Langkah Jabatan sebelumnya).
  if (!isFullAccess && role !== 'Admin DP' && role !== 'SPV Drop Point' && !isLegacyAdminPusat) {
    redirect('/dashboard');
  }

  // isCabang HANYA full access - SPV Drop Point PINDAH ke mode per-Sprinter
  // (gabung Admin DP), BUKAN lagi mode Refine Total cabang. Sebelumnya salah
  // (isCabang juga true utk SPV Drop Point): mode cabang fetch
  // /api/drop-points yg cuma boleh FULL_ACCESS_ROLES, jadi SPV Drop Point
  // sebenarnya selalu gagal (FORBIDDEN) di mode itu - bukan cuma soal
  // menu_key, tapi kesalahan penempatan mode dari awal.
  const isCabang = isFullAccess;
  const menuKey = isLegacyAdminPusat ? null : isCabang ? ('monitoring_delivery_cabang' as const) : ('monitoring_delivery_dp' as const);

  // Defense-in-depth: blokir akses langsung via URL kalau menu ini
  // dinonaktifkan utk actor (Role & Akses) - sidebar sudah menyembunyikan
  // link-nya (lib/nav.ts), ini jaga-jaga kalau diakses langsung. 'Admin
  // Pusat' (legacy) TETAP TIDAK PERNAH digating, sama seperti sebelumnya -
  // role itu di luar 6 role yang dikenal matrix, getMyMenuAccess akan
  // mengembalikan SEMUA false utk role tak dikenal (aman by default), jadi
  // HARUS dilewati eksplisit di sini, bukan ikut dicek.
  if (menuKey) {
    const access = await getMyMenuAccess(session?.user.email ?? '');
    if (!access[menuKey]) {
      return (
        <>
          <PageHeader title="Monitoring Delivery" description="Akses ditolak." />
          <div className="text-muted-foreground p-6 text-sm">
            Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
          </div>
        </>
      );
    }
  }

  const dpName = session?.user.dropPoint || 'SEMUA DP';

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Monitoring Delivery"
        description={
          isCabang
            ? 'Generate dan copy tabel Monitoring Delivery per Drop Point (Refine Total) dari file Excel JMS.'
            : 'Generate dan copy tabel Monitoring Delivery per Sprinter dari file Excel JMS.'
        }
      />

      {isCabang ? <MonitoringRefineClient /> : <MonitoringClient dpName={dpName} isCabang={false} />}
    </div>
  );
}
