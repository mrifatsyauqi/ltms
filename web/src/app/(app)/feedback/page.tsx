import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { DataFreshness } from '@/components/layout/data-freshness';
import { ImportStaleBanner } from '@/components/layout/import-stale-banner';
import { FeedbackTable } from '@/components/feedback/feedback-table';
import { hasFullAccess } from '@/lib/roles';

/**
 * Satu halaman, dua entri menu (keputusan user):
 * - /feedback            -> "Feedback Long Tail" (mode isi feedback)
 * - /feedback?view=data  -> "Data Long Tail" (mode lihat, read-only)
 * Scope data & otorisasi tulis tetap ditegakkan server-side di Apps Script.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; umur?: string; dp?: string }>;
}) {
  const session = await auth();
  const { view, umur, dp } = await searchParams;
  const readOnly = view === 'data';
  const role = session?.user.role;
  // Manager Kota/Asisten Manager Kota IDENTIK Admin Cabang (Langkah 3); SPV
  // Drop Point ikut tampilan multi-DP (kolom DP, dst) krn bisa disupervisi
  // >1 DP - scoping data sebenarnya ditegakkan server-side (listLongTail).
  const isCabang = hasFullAccess(role) || role === 'SPV Drop Point';

  const scope =
    role === 'SPV Drop Point'
      ? 'Drop Point yang Anda supervisi'
      : isCabang
        ? 'Semua Drop Point'
        : `DP ${session?.user.dropPoint ?? '-'}`;

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
      <DataFreshness />
      <ImportStaleBanner isCabang={isCabang} />
      {/* flex-col + min-h-0: area tabel mengisi sisa tinggi, pagination
          menempel di bawah tanpa perlu scroll halaman (poin 2c). */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <FeedbackTable
          readOnly={readOnly}
          isCabang={isCabang}
          initialUmurFilter={umur === '3' ? '3' : ''}
          initialDpFilter={dp ?? ''}
        />
      </div>
    </>
  );
}
