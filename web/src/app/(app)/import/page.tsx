import { redirect } from 'next/navigation';
import { auth } from '@/auth';
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
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Import Long Tail</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Upload satu atau beberapa file Excel dari JMS. Setiap file diproses independen — jika satu gagal, file lain tetap lanjut.
      </p>
      <ImportClient />
    </div>
  );
}
