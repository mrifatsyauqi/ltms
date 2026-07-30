'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, LayoutGrid } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_SCOPE, useDashboardScope } from '@/components/dashboard/scope-context';
import type { DropPointRow } from '@/lib/data/drop-points';

async function fetchDropPoints(): Promise<DropPointRow[]> {
  const res = await fetch('/api/drop-points');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/**
 * Dropdown filter CAKUPAN di sidebar (Admin Cabang saja). UI custom (bukan
 * <select> bawaan browser) supaya tampilan konsisten lintas OS/browser —
 * dibangun dari primitif Select (@base-ui/react/select) yang sudah dipakai
 * di halaman Import. Menulis pilihan ke DashboardScopeProvider; Dashboard
 * membaca nilai ini untuk memfilter semua widget. Daftar DP dari Master
 * Drop Point.
 */
export function ScopeFilter() {
  const { scope, setScope } = useDashboardScope();
  const { data } = useQuery({ queryKey: ['drop-points'], queryFn: fetchDropPoints });

  const dps = [...(data ?? [])].sort((a, b) =>
    String(a['Kode DP']).localeCompare(String(b['Kode DP'])),
  );

  // WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
  // trigger (SelectValue) menampilkan label yang benar, bukan value mentah
  // (bug: trigger sempat menampilkan "ALL" alih-alih "Semua DP").
  const items: Record<string, string> = { [ALL_SCOPE]: 'Semua DP' };
  dps.forEach((d) => { items[d['Kode DP']] = d['Kode DP']; });

  return (
    <Select items={items} value={scope} onValueChange={(v) => setScope(v ?? ALL_SCOPE)}>
      <SelectTrigger
        aria-label="Filter cakupan Drop Point"
        className="bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border/60 focus-visible:ring-sidebar-ring mt-0.5 h-auto w-full justify-between rounded-md border px-1.5 py-1 text-[13px] font-semibold data-[size=default]:h-auto"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value={ALL_SCOPE}>
          <LayoutGrid className="text-muted-foreground size-3.5" aria-hidden />
          Semua DP
        </SelectItem>
        {dps.map((d) => (
          <SelectItem key={d['Kode DP']} value={d['Kode DP']}>
            <Building2 className="text-muted-foreground size-3.5" aria-hidden />
            {d['Kode DP']}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
