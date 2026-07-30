/**
 * Skeleton generik dipakai loading.tsx tiap route (Next.js App Router) -
 * feedback navigasi instan sebelum konten asli (Server Component + fetch
 * client) selesai. Bentuknya mendekati <PageHeader> + isi halaman supaya
 * tak ada lompatan layout besar saat konten asli menggantikannya.
 */
export function PageHeaderSkeleton() {
  return (
    <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
      <div className="min-w-0 space-y-1.5">
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        <div className="bg-muted h-3 w-64 animate-pulse rounded" />
      </div>
    </header>
  );
}

/** Beberapa baris pulsing - dipakai utk halaman berbentuk tabel/list. */
export function RowsSkeleton({ rows = 8, className = 'p-3' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`} aria-busy="true" aria-label="Memuat...">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-muted h-8 animate-pulse rounded" />
      ))}
    </div>
  );
}

/** Kombinasi paling umum dipakai loading.tsx: header + baris. */
export function RouteSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <>
      <PageHeaderSkeleton />
      <RowsSkeleton rows={rows} className={className} />
    </>
  );
}
