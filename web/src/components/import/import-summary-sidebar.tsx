'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/layout/section-card';
import { fetchImportHistory } from './import-history';

const HISTORY_ANCHOR_ID = 'riwayat-import-lengkap';

type SummaryStats = {
  fileCount: number;
  totalBaris: number;
  totalWaybillUnik: number;
  duplicate: number;
  errorCount: number;
};

function StatRow({ label, value, accent }: { label: string; value: number; accent?: 'amber' | 'destructive' }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={
          'text-sm font-semibold tabular-nums ' +
          (accent === 'amber' ? 'text-accent-amber' : accent === 'destructive' ? 'text-destructive' : '')
        }
      >
        {value.toLocaleString('id-ID')}
      </span>
    </div>
  );
}

/** Sidebar kanan halaman Import: ringkasan batch yang sedang disiapkan + riwayat import terakhir (ringkas). */
export function ImportSummarySidebar({ stats }: { stats: SummaryStats }) {
  const historyQuery = useQuery({ queryKey: ['import-history'], queryFn: fetchImportHistory });
  const recent = [...(historyQuery.data ?? [])].reverse().slice(0, 3);

  return (
    <div className="w-full shrink-0 space-y-3 lg:w-80">
      <SectionCard
        title={
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="text-primary size-4" aria-hidden /> Ringkasan Import
          </span>
        }
      >
        <div className="divide-border divide-y">
          <StatRow label="File" value={stats.fileCount} />
          <StatRow label="Total Baris" value={stats.totalBaris} />
          <StatRow label="Total Waybill Unik" value={stats.totalWaybillUnik} />
          <StatRow label="Duplicate" value={stats.duplicate} accent={stats.duplicate > 0 ? 'amber' : undefined} />
          <StatRow label="Error" value={stats.errorCount} accent={stats.errorCount > 0 ? 'destructive' : undefined} />
        </div>
        <p className="text-muted-foreground bg-muted/50 mt-2 rounded-md p-2 text-[11px] leading-relaxed">
          Data akan di-<em>merge</em> dengan data yang sudah ada — waybill yang sudah ada di LongTail akan diperbarui,
          bukan diduplikasi.
        </p>
      </SectionCard>

      <SectionCard title="Riwayat Import Terakhir">
        {historyQuery.isLoading && <p className="text-muted-foreground text-xs">Memuat…</p>}
        {!historyQuery.isLoading && recent.length === 0 && (
          <p className="text-muted-foreground text-xs">Belum ada riwayat import.</p>
        )}
        <ul className="space-y-2.5">
          {recent.map((b) => (
            <li key={b['Batch ID']} className="border-border border-b pb-2.5 last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <CheckCircle2 className="text-accent-green size-3.5 shrink-0" aria-hidden />
                {b.Tanggal} {b.Jam}
              </div>
              <p className="text-muted-foreground mt-0.5 truncate text-[11px]" title={b['Nama File']}>
                {b['Nama File']}
              </p>
              <p className="mt-0.5 text-[11px]">
                <span className="text-accent-green font-semibold">{b.Berhasil.toLocaleString('id-ID')} waybill</span>
                <span className="text-muted-foreground"> · oleh {b['Admin Cabang']}</span>
              </p>
            </li>
          ))}
        </ul>
        {recent.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => document.getElementById(HISTORY_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth' })}
          >
            Lihat Semua Riwayat
          </Button>
        )}
      </SectionCard>
    </div>
  );
}

export { HISTORY_ANCHOR_ID };
