import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { ResetLongTailCard } from '@/components/settings/reset-longtail-card';
import { PublicShareLinkCard } from '@/components/settings/public-share-link-card';
import { hasFullAccess } from '@/lib/roles';

export default async function Page() {
  const session = await auth();
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="Pengaturan" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pengaturan" description="Pemeliharaan data & preferensi sistem." />
      <div className="max-w-2xl space-y-3 p-3">
        <PublicShareLinkCard />
        <ResetLongTailCard />
      </div>
    </>
  );
}
