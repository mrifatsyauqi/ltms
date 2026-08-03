import { PageHeader } from '@/components/layout/page-header';

export default function Loading() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Monitoring INC" description="Memuat modul Monitoring INC..." />
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
        Memuat data...
      </div>
    </div>
  );
}
