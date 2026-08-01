import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { DashboardScopeProvider } from '@/components/dashboard/scope-context';
import { getMyMenuAccess } from '@/lib/data/permissions';

/**
 * Shell aplikasi: sidebar gelap (kiri) + area konten terang (kanan).
 * Halaman /login sengaja di luar grup ini supaya tampil tanpa sidebar.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Sesi valid HARUS punya role (diisi jwt callback hanya untuk login yang
  // lolos penuh). Sesi "setengah jadi" tanpa role ditolak — cegah akses via
  // cookie yang terbentuk tak sempurna.
  if (!session?.user?.role) redirect('/login');

  const { user } = session;

  // Akses efektif per menu_key (Role & Akses) HANYA dihitung utk 2 role yang
  // "diatur" (SPV Drop Point/Admin DP) - full access tak pernah masuk matrix
  // ini (lihat lib/data/supabase/permissions.ts), jadi query DB tambahan ini
  // dilewati sama sekali utk mayoritas user (Admin Cabang dkk).
  const isGatedRole = user.role === 'SPV Drop Point' || user.role === 'Admin DP';
  const menuAccess = isGatedRole ? await getMyMenuAccess(user.email ?? '') : null;

  return (
    <DashboardScopeProvider>
      <div className="flex h-dvh overflow-hidden">
        {/* Sidebar pakai useSearchParams -> perlu Suspense boundary. */}
        <Suspense fallback={<div className="bg-sidebar w-[200px] shrink-0" />}>
          <Sidebar
            role={user.role}
            nama={user.nama ?? user.name ?? undefined}
            dropPoint={user.dropPoint}
            menuAccess={menuAccess}
          />
        </Suspense>
        {/*
          @container: semua halaman mengukur lebar AREA KONTEN (viewport - sidebar),
          bukan viewport. Tanpa ini, breakpoint viewport (lg: = 1024px) menyala saat
          konten sebenarnya baru selebar 768px -> layout terlalu padat/rusak, dan
          ikut salah saat sidebar di-collapse.
        */}
        <main className="bg-background @container flex min-w-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </DashboardScopeProvider>
  );
}
