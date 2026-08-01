import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';

export default async function Page() {
  const session = await auth();
  // Master Data khusus Admin Cabang (konsisten dgn /master/drop-point,
  // /master/users). Otorisasi sebenarnya tetap ditegakkan di level API.
  if (session?.user.role !== 'Admin Cabang') {
    return (
      <>
        <PageHeader title="Cabang" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang.</div>
      </>
    );
  }

  // Placeholder — menunggu migrasi skema `cabang` dijalankan di Supabase
  // sebelum CRUD Kota (Nama/Kode Kota, Manager Kota, Asisten Manager)
  // diimplementasikan di sini.
  return (
    <>
      <PageHeader title="Cabang" description="Kelola struktur organisasi Kota & Drop Point." />
      <div className="text-muted-foreground p-6 text-sm">Halaman Pengaturan Cabang segera hadir.</div>
    </>
  );
}
