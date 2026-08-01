import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PageHeader } from '@/components/layout/page-header';
import { ImportClient } from '@/components/import/import-client';
import { hasFullAccess } from '@/lib/roles';
import { getMyMenuAccess } from '@/lib/data/permissions';

export default async function ImportPage() {
  const session = await auth();
  if (!session) redirect('/login');
  // Hak akses: Import Long Tail hanya utk full access (Admin Cabang/Manager
  // Kota/Asisten Manager Kota/Super Admin - Langkah 3). Ini pengecekan UI
  // saja — otoritas sebenarnya tetap di requireRole (createLongTail dkk),
  // jadi tidak bisa dilewati walau seseorang memaksa akses endpoint API
  // secara langsung.
  if (!hasFullAccess(session.user.role)) redirect('/');

  // Defense-in-depth CHECKPOINT 3: menu_key import_longtail - lapisan
  // TAMBAHAN di atas hasFullAccess di atas (bukan pengganti), memungkinkan
  // Super Admin mencabut akses Import khusus dari 1 akun/role full access
  // tanpa menurunkan status full-access-nya. requirePermission() yang
  // sepadan sudah ditegakkan di importLongTail() (import.ts).
  const access = await getMyMenuAccess(session.user.email ?? '');
  if (!access.import_longtail) {
    return (
      <>
        <PageHeader title="Import Long Tail" description="Akses ditolak." />
        <div className="text-muted-foreground p-6 text-sm">
          Menu ini dinonaktifkan untuk akun Anda. Hubungi Admin Cabang atau Super Admin.
        </div>
      </>
    );
  }

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
