import { auth } from '@/auth';
import { RiwayatFeedbackClient } from '@/components/riwayat/riwayat-feedback-client';

export default async function RiwayatFeedbackPage() {
  const session = await auth();
  const isCabang = session?.user.role === 'Admin Cabang';

  return (
    <RiwayatFeedbackClient
      isCabang={isCabang}
      scope={isCabang ? 'Semua Drop Point' : `DP ${session?.user.dropPoint ?? '-'}`}
    />
  );
}
