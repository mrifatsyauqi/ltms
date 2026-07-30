import { findActiveShareLink } from '@/lib/data/supabase/public-share';
import { PublicShareTabs } from '@/components/public-share/public-share-tabs';
import { InvalidLinkMessage } from '@/components/public-share/invalid-link-message';

export const metadata = {
  title: 'Laporan LTMS',
  // Cegah mesin pencari mengindeks halaman publik ini (link berisi data
  // operasional cabang, meski bukan data pribadi/rahasia).
  robots: { index: false, follow: false },
};

/**
 * Layout bersama 2 halaman publik (dashboard & data-longtail) - validasi
 * token SEKALI di sini (dipakai kedua halaman anak), render tab navigasi.
 * Route ini SENGAJA di luar (app) - tanpa sidebar/NextAuth sama sekali
 * (lihat proxy.ts, matcher juga sudah mengecualikan /public).
 */
export default async function PublicShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await findActiveShareLink(token);

  if (!link) return <InvalidLinkMessage />;

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <PublicShareTabs token={token} />
      <main className="@container flex-1 overflow-y-auto p-3">{children}</main>
    </div>
  );
}
