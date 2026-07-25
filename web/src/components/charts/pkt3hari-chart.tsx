'use client';

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonitoringDpRow } from '@/lib/apps-script/dashboard';

export type Pkt3HariDatum = { dp: string; pct: number; lebih3: number; total: number };

/**
 * Warna bar bergradasi 3 tingkat RELATIF terhadap nilai maksimum antar DP
 * (bukan ambang absolut): merah >=60% dari max, oranye 25-59%, hijau <25%.
 * DP dengan % tertinggi selalu merah.
 */
function tierColor(pct: number, max: number) {
  const ratio = max > 0 ? pct / max : 0;
  if (ratio >= 0.6) return 'var(--aging-3-fg)'; // merah
  if (ratio >= 0.25) return 'var(--aging-2-fg)'; // oranye
  return 'var(--aging-1-fg)'; // hijau
}

export function Pkt3HariChart({
  data,
  onSelectDp,
}: {
  data: MonitoringDpRow[];
  onSelectDp?: (dp: string) => void;
}) {
  // Rumus per DP: (Paket > 3 Hari) / (Total Paket) x 100%. Urut tertinggi dulu.
  const rows: Pkt3HariDatum[] = data
    .map((d) => ({
      dp: d.dp,
      lebih3: d.lebih3,
      total: d.total,
      pct: d.total > 0 ? Math.round((d.lebih3 / d.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const max = rows.reduce((m, r) => Math.max(m, r.pct), 0);

  if (rows.length === 0 || max === 0) {
    return (
      <p role="status" className="text-muted-foreground py-10 text-center text-sm">
        Tidak ada paket &gt; 3 hari di DP mana pun.
      </p>
    );
  }

  return (
    <div className="max-h-[210px] overflow-auto px-3 pb-3">
      <div style={{ height: Math.max(rows.length * 34, 110) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={rows}
            margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
            barCategoryGap={6}
          >
            <XAxis type="number" domain={[0, Math.max(max, 1)]} hide />
            <YAxis
              type="category"
              dataKey="dp"
              tickLine={false}
              axisLine={false}
              width={72}
              fontSize={11}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              formatter={(_v, _n, item) => {
                const d = item.payload as Pkt3HariDatum;
                return [`${d.pct}% (${d.lebih3} dari ${d.total} paket)`, '% Paket > 3 Hari'];
              }}
              labelFormatter={(l) => `DP ${l}`}
            />
            <Bar
              dataKey="pct"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              cursor={onSelectDp ? 'pointer' : undefined}
              onClick={(entry: unknown) => {
                const d = entry as Pkt3HariDatum;
                if (onSelectDp && d?.dp) onSelectDp(d.dp);
              }}
            >
              {rows.map((r) => (
                <Cell key={r.dp} fill={tierColor(r.pct, max)} />
              ))}
              <LabelList
                dataKey="pct"
                position="right"
                fontSize={11}
                className="fill-foreground"
                formatter={(v) => `${v ?? 0}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
