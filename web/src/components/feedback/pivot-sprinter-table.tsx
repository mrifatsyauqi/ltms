import { forwardRef, Fragment, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { LongTailRow } from '@/lib/data/longtail';

export type SprinterCount = { sprinter: string; count: number };
export type DpPivotGroup = { dp: string; total: number; sprinters: SprinterCount[] };
export type SprinterPivot = { groups: DpPivotGroup[]; grandTotal: number; maxCount: number };

/**
 * Kelompokkan baris LongTail: DP Sampai -> Sprinter Delivery -> jumlah AWB.
 * Dalam tiap grup DP, baris tanpa Sprinter (kosong) SELALU ditaruh paling
 * atas tanpa label, baru diikuti sprinter bernama terurut alfabet — sesuai
 * kebiasaan Pivot Table Excel utk grup kosong.
 */
export function buildSprinterPivot(rows: LongTailRow[]): SprinterPivot {
  const byDp = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const dp = String(r['DP Sampai'] ?? '').trim() || '(Tanpa DP)';
    const sprinter = String(r['Sprinter Delivery'] ?? '').trim();
    if (!byDp.has(dp)) byDp.set(dp, new Map());
    const m = byDp.get(dp)!;
    m.set(sprinter, (m.get(sprinter) ?? 0) + 1);
  }

  const dpNames = Array.from(byDp.keys()).sort((a, b) => a.localeCompare(b, 'id'));
  let maxCount = 0;
  const groups: DpPivotGroup[] = dpNames.map((dp) => {
    const m = byDp.get(dp)!;
    const entries = Array.from(m.entries()).sort(([a], [b]) => {
      if (a === '' && b === '') return 0;
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b, 'id');
    });
    const sprinters = entries.map(([sprinter, count]) => ({ sprinter, count }));
    const total = sprinters.reduce((s, e) => s + e.count, 0);
    maxCount = Math.max(maxCount, total, ...sprinters.map((e) => e.count));
    return { dp, total, sprinters };
  });

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  return { groups, grandTotal, maxCount };
}

/** Latar bar horizontal (spt data bar Excel) proporsional thd maxCount. */
function barStyle(count: number, maxCount: number): CSSProperties {
  const pct = maxCount > 0 ? Math.max(4, Math.round((count / maxCount) * 100)) : 0;
  return {
    backgroundImage: `linear-gradient(to right, color-mix(in srgb, var(--brand) 30%, transparent) ${pct}%, transparent ${pct}%)`,
  };
}

const cellBase = 'border border-gray-300 px-2.5 py-1 text-xs';

type PivotSprinterTableProps = { pivot: SprinterPivot };

export const PivotSprinterTable = forwardRef<HTMLTableElement, PivotSprinterTableProps>(function PivotSprinterTable(
  { pivot },
  ref,
) {
  const { groups, grandTotal, maxCount } = pivot;
  return (
    <table ref={ref} className="w-full border-collapse bg-white text-xs">
      <colgroup>
        <col />
        <col style={{ width: '1%' }} />
      </colgroup>
      <thead>
        <tr>
          <th className={cn(cellBase, 'bg-gray-100 text-left font-semibold')}>Row Labels</th>
          <th className={cn(cellBase, 'bg-gray-100 text-right font-semibold whitespace-nowrap')}>
            Count of No. Waybill
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.dp}>
            <tr>
              <td className={cn(cellBase, 'bg-gray-50 font-semibold')}>{g.dp}</td>
              <td className={cn(cellBase, 'bg-gray-50 text-right font-semibold tabular-nums')} style={barStyle(g.total, maxCount)}>
                {g.total}
              </td>
            </tr>
            {g.sprinters.map((s, i) => (
              <tr key={i}>
                <td className={cn(cellBase, 'pl-6')}>{s.sprinter}</td>
                <td className={cn(cellBase, 'text-right tabular-nums')} style={barStyle(s.count, maxCount)}>
                  {s.count}
                </td>
              </tr>
            ))}
          </Fragment>
        ))}
        {groups.length === 0 && (
          <tr>
            <td className={cn(cellBase, 'text-center text-gray-500')} colSpan={2}>
              Tidak ada data untuk dipivot.
            </td>
          </tr>
        )}
        <tr>
          <td className={cn(cellBase, 'bg-gray-200 font-bold')}>Grand Total</td>
          <td className={cn(cellBase, 'bg-gray-200 text-right font-bold tabular-nums')}>{grandTotal}</td>
        </tr>
      </tbody>
    </table>
  );
});
