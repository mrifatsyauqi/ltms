import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { MasterFeedbackClient } from '@/components/master/master-feedback-client';

export default async function Page() {
  const session = await auth();
  if (session?.user.role !== 'Admin Cabang') {
    return (
      <>
        <PageHeader title="Master Feedback" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">Halaman ini hanya untuk Admin Cabang.</div>
      </>
    );
  }
  return <MasterFeedbackClient />;
}
