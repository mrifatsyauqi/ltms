'use client';

import { useQuery } from '@tanstack/react-query';
import { ALL_SCOPE, useDashboardScope } from '@/components/dashboard/scope-context';
import type { DropPointRow } from '@/lib/data/drop-points';

async function fetchDropPoints(): Promise<DropPointRow[]> {
  const res = await fetch('/api/drop-points');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/**
 * Dropdown filter CAKUPAN di sidebar (Admin Cabang saja). Menulis pilihan ke
 * DashboardScopeProvider; Dashboard membaca nilai ini untuk memfilter semua
 * widget. Daftar DP dari Master Drop Point.
 */
export function ScopeFilter() {
  const { scope, setScope } = useDashboardScope();
  const { data } = useQuery({ queryKey: ['drop-points'], queryFn: fetchDropPoints });

  const dps = [...(data ?? [])].sort((a, b) =>
    String(a['Kode DP']).localeCompare(String(b['Kode DP'])),
  );

  return (
    <select
      aria-label="Filter cakupan Drop Point"
      value={scope}
      onChange={(e) => setScope(e.target.value)}
      className="bg-sidebar-accent/60 text-sidebar-accent-foreground focus-visible:ring-sidebar-ring mt-0.5 w-full rounded-md px-1.5 py-1 text-[13px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
    >
      <option value={ALL_SCOPE}>Semua DP</option>
      {dps.map((d) => (
        <option key={d['Kode DP']} value={d['Kode DP']}>
          {d['Kode DP']}
        </option>
      ))}
    </select>
  );
}
