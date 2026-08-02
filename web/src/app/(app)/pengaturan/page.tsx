import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { ResetLongTailCard } from '@/components/settings/reset-longtail-card';
import { PublicShareLinkCard } from '@/components/settings/public-share-link-card';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

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

  // Defense-in-depth CHECKPOINT 5 (terakhir dari 9 menu_key yang belum
  // ter-wire): menu_key 'pengaturan' - SATU gerbang utk KEDUA sub-fitur di
  // halaman ini (Link Berbagi Laporan di public-share.ts, Reset Data Long
  // Tail di longtail.ts) - SENGAJA tidak dipecah lebih granular per
  // sub-fitur (keputusan eksplisit user). requirePermission() sepadan sudah
  // ditegakkan di createShareLink/regenerateShareLink/revokeShareLink
  // (public-share.ts) & previewResetLongTail/resetLongTailData (longtail.ts).
  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.pengaturan) {
    return (
      <>
        <PageHeader title="Pengaturan" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
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
