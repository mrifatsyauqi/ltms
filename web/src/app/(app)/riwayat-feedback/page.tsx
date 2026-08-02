import { auth } from '@/auth';
import { RiwayatFeedbackClient } from '@/components/riwayat/riwayat-feedback-client';
import { hasFullAccess } from '@/lib/roles';

export default async function RiwayatFeedbackPage() {
  const session = await auth();
  // Manager Kota/Asisten Manager Kota IDENTIK Admin Cabang (Langkah 3); SPV
  // Drop Point ikut tampilan multi-DP - scoping data tetap server-side.
  const isCabang = hasFullAccess(session?.user.role) || session?.user.role === 'SPV Drop Point';

  return (
    <RiwayatFeedbackClient
      isCabang={isCabang}
    />
  );
}
