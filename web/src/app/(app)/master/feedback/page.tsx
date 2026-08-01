import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { MasterFeedbackClient } from '@/components/master/master-feedback-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export default async function Page() {
  const session = await auth();
  if (!hasFullAccess(session?.user.role)) {
    return (
      <>
        <PageHeader title="Master Feedback" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang, Manager Kota, atau Asisten Manager Kota.</div>
      </>
    );
  }

  // Defense-in-depth CHECKPOINT 4: menu_key master_feedback - lapisan
  // TAMBAHAN. requirePermission() sepadan sudah ditegakkan di
  // createMasterFeedback/updateMasterFeedback/deleteMasterFeedback -
  // listMasterFeedback SENGAJA TIDAK digating (dipakai bersama combobox
  // feedback di halaman Feedback Long Tail, favorite-feedback.ts terpisah
  // sama sekali - lihat audit checkpoint sebelumnya).
  const access = await getMyMenuAccess(session?.user.email ?? '');
  if (!access.master_feedback) {
    return (
      <>
        <PageHeader title="Master Feedback" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
      </>
    );
  }

  return <MasterFeedbackClient />;
}
