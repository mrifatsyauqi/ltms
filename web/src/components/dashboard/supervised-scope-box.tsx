'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, LayoutGrid } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_SCOPE, useDashboardScope } from '@/components/dashboard/scope-context';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import type { SupervisedDropPointRow } from '@/lib/data/drop-points';

async function fetchSupervisedDropPoints(): Promise<SupervisedDropPointRow[]> {
  const res = await fetch('/api/supervised-drop-points');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/**
 * Kotak "DP Aktif"/"Cakupan" khusus SPV Drop Point - beda dari Admin DP
 * (selalu 1 DP tunggal via users.drop_point) & full access (ScopeFilter ke
 * SEMUA DP di sistem). Render label+isi sendiri (bukan cuma value) krn
 * bentuknya tergantung HASIL fetch (0/1 DP vs >1 DP), diketahui belakangan:
 *
 * - 0/1 DP disupervisi -> label statis "DP Aktif", SAMA PERSIS pola Admin DP
 *   (tanpa dropdown - tak ada gunanya selektor kalau cuma 1 pilihan/kosong).
 * - >1 DP -> dropdown "Cakupan", TAPI opsinya CUMA DP yang disupervisi
 *   (bukan seluruh Drop Point sistem) + "Semua DP Disupervisi" di atas
 *   (agregat SEMUA DP-nya, bukan "Semua DP" versi Admin Cabang yg saklar
 *   ke seluruh sistem). Menulis ke DashboardScopeProvider yang SAMA dgn
 *   ScopeFilter (Admin Cabang) - aman krn user hanya salah satu dari
 *   keduanya, tak pernah dua-duanya sekaligus.
 */
export function SupervisedScopeBox() {
  const { scope, setScope } = useDashboardScope();
  const { data, isLoading } = useQuery({
    queryKey: ['supervised-drop-points'],
    queryFn: fetchSupervisedDropPoints,
    staleTime: SLOW_STALE_TIME, // jarang berubah (assignment DP-SPV, data master)
  });
  const dps = data ?? [];

  if (isLoading) {
    return <div className="bg-sidebar-accent/60 h-9 animate-pulse rounded-md" aria-hidden />;
  }

  if (dps.length <= 1) {
    return (
      <>
        <div className="text-[10px] tracking-wide uppercase opacity-60">DP Aktif</div>
        <div className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">
          {dps[0]?.['Kode DP'] || '-'}
        </div>
      </>
    );
  }

  // WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
  // trigger menampilkan label yang benar, bukan value mentah.
  const items: Record<string, string> = { [ALL_SCOPE]: 'Semua DP Disupervisi' };
  dps.forEach((d) => { items[d['Kode DP']] = d['Kode DP']; });

  return (
    <>
      <div className="text-[10px] tracking-wide uppercase opacity-60">Cakupan</div>
      <Select items={items} value={scope} onValueChange={(v) => setScope(v ?? ALL_SCOPE)}>
        <SelectTrigger
          aria-label="Filter cakupan Drop Point yang disupervisi"
          className="bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border/60 focus-visible:ring-sidebar-ring mt-0.5 h-auto w-full justify-between rounded-md border px-1.5 py-1 text-[13px] font-semibold data-[size=default]:h-auto"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value={ALL_SCOPE}>
            <LayoutGrid className="text-muted-foreground size-3.5" aria-hidden />
            Semua DP Disupervisi
          </SelectItem>
          {dps.map((d) => (
            <SelectItem key={d['Kode DP']} value={d['Kode DP']}>
              <Building2 className="text-muted-foreground size-3.5" aria-hidden />
              {d['Kode DP']}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
