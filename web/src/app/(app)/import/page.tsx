import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { ImportClient } from '@/components/import/import-client';
import { hasFullAccess } from '@/lib/roles';

export default async function ImportPage() {
  const session = await auth();
  if (!session) redirect('/login');
  // Hak akses: Import Long Tail hanya utk full access (Admin Cabang/Manager
  // Kota/Asisten Manager Kota/Super Admin - Langkah 3). Ini pengecekan UI
  // saja — otoritas sebenarnya tetap di requireRole (createLongTail dkk),
  // jadi tidak bisa dilewati walau seseorang memaksa akses endpoint API
  // secara langsung.
  if (!hasFullAccess(session.user.role)) redirect('/');

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
