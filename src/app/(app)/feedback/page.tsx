import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { FeedbackTable } from '@/components/feedback/feedback-table';

/**
 * Satu halaman, dua entri menu (keputusan user):
 * - /feedback            -> "Feedback Long Tail" (mode isi feedback)
 * - /feedback?view=data  -> "Data Long Tail" (mode lihat, read-only)
 * Scope data & otorisasi tulis tetap ditegakkan server-side di Apps Script.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  const { view } = await searchParams;
  const readOnly = view === 'data';
  const isCabang = session?.user.role === 'Admin Cabang';

  const scope = isCabang ? 'Semua Drop Point' : `DP ${session?.user.dropPoint ?? '-'}`;

  return (
    <>
      <PageHeader
        title={readOnly ? 'Data Long Tail' : 'Feedback Long Tail'}
        description={
          readOnly
            ? `${scope}. Mode lihat data, urut umur tertua di atas.`
            : `${scope}. Urut umur tertua di atas.`
        }
      />
      <div className="p-3">
        <FeedbackTable readOnly={readOnly} />
      </div>
    </>
  );
}
