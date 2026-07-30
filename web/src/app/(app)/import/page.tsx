import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { ImportClient } from '@/components/import/import-client';

export default async function ImportPage() {
  const session = await auth();
  if (!session) redirect('/login');
  // Hak akses Bagian 5 PRD: Import Long Tail hanya untuk Admin Cabang.
  // Ini pengecekan UI saja — otoritas sebenarnya tetap di Apps Script
  // (requireRole_ di action importLongTail), jadi tidak bisa dilewati
  // walau seseorang memaksa akses endpoint API secara langsung.
  if (session.user.role !== 'Admin Cabang') redirect('/');

  return (
    <>
      <PageHeader
        title="Import Long Tail"
        description="Upload satu atau beberapa file Excel dari JMS — dibaca per file, tapi digabung jadi satu batch sebelum masuk ke data."
      />
      <div className="flex-1 p-4">
        <ImportClient />
      </div>
    </>
  );
}
