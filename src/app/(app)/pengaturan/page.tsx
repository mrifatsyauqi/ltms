import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { ArchiveCard } from '@/components/settings/archive-card';

export default async function Page() {
  const session = await auth();
  if (session?.user.role !== 'Admin Cabang') {
    return (
      <>
        <PageHeader title="Pengaturan" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pengaturan" description="Pemeliharaan data & preferensi sistem." />
      <div className="max-w-2xl space-y-3 p-3">
        <ArchiveCard />
      </div>
    </>
  );
}
