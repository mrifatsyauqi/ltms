import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { DashboardScopeProvider } from '@/components/dashboard/scope-context';
import { getMyMenuAccess, isGatedRole } from '@/lib/data/permissions';

/**
 * Shell aplikasi: sidebar gelap (kiri) + area konten terang (kanan).
 * Halaman /login sengaja di luar grup ini supaya tampil tanpa sidebar.
 */
import { PageTransition } from '@/components/layout/page-transition';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Sesi valid HARUS punya role (diisi jwt callback hanya untuk login yang
  // lolos penuh). Sesi "setengah jadi" tanpa role ditolak — cegah akses via
  // cookie yang terbentuk tak sempurna.
  if (!session?.user?.role) redirect('/login');

  const { user } = session;

  // Akses efektif per menu_key (Role & Akses) dihitung utk SEMUA 5 role yang
  // "diatur" (GATED_ROLES: Admin Cabang/Manager Kota/Asisten Manager Kota/SPV
  // Drop Point/Admin DP) - BUKAN lagi cuma 2 role DP. Sejak bypass
  // hasPermission() utk grup full access dihapus, Admin Cabang dkk BENAR-BENAR
  // dicek matrix di backend, jadi sidebar-nya HARUS ikut difilter supaya menu
  // yang backend-nya sudah FORBIDDEN tak tetap kelihatan (pakai predikat
  // isGatedRole yg sama dgn otorisasi runtime -> tak bisa drift).
  // menuAccess = null (TIDAK difilter) sengaja utk 2 kasus:
  //  - Super Admin: satu-satunya bypass permanen, getEffectiveMenuAccess()
  //    toh selalu all-true utk dia -> query DB-nya dilewati (optimasi, bukan
  //    lubang otorisasi).
  //  - role di luar 6 yg dikenal (mis. legacy 'Admin Pusat'): matrix akan
  //    mengembalikan SEMUA false -> menu habis total; biarkan apa adanya spt
  //    perilaku sebelumnya, gating-nya ada di masing-masing page.
  const menuAccess = isGatedRole(user.role ?? '') ? await getMyMenuAccess(user.email ?? '') : null;
  const initialScope = ['Admin DP', 'SPV DP'].includes(user.role ?? '') ? (user.dropPoint ?? 'ALL') : 'ALL';

  return (
    <DashboardScopeProvider initialScope={initialScope}>
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
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </DashboardScopeProvider>
  );
}
