'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from '@/components/layout/section-card';
import type { LongTailRow } from '@/lib/apps-script/longtail';

async function fetchLongTail(): Promise<LongTailRow[]> {
  const res = await fetch('/api/longtail');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

/**
 * Frekuensi tiap "Alasan Paket Bermasalah" dari feedback yang SUDAH diisi,
 * khusus 1 DP (mode DP Spesifik). Client-side dari /api/longtail (Admin Cabang
 * dapat semua baris, difilter di sini) supaya tidak menyentuh backend.
 */
export function BreakdownAlasan({ dp }: { dp: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['longtail'], queryFn: fetchLongTail });

  const pick = dp.trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    if (String(r['DP Sampai']).trim().toLowerCase() !== pick) continue;
    if (String(r.Feedback ?? '').trim() === '') continue; // hanya yang sudah ada feedback
    const alasan = String(r['Alasan Paket Bermasalah'] ?? '').trim();
    if (!alasan) continue;
    counts.set(alasan, (counts.get(alasan) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([alasan, jumlah]) => ({ alasan, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);

  return (
    <SectionCard
      title="Breakdown Alasan Bermasalah"
      description={`Frekuensi alasan dari feedback terisi · DP ${dp}.`}
      bodyClassName="px-0 pb-0"
    >
      {isLoading && (
        <div className="space-y-1.5 px-3 pb-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-7 animate-pulse rounded" />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive px-3 pb-3 text-xs">
          Gagal memuat: {(error as Error).message}
        </p>
      )}

      {data && rows.length === 0 && (
        <p role="status" className="text-muted-foreground py-10 text-center text-sm">
          Belum ada alasan bermasalah dari feedback di DP ini.
        </p>
      )}

      {data && rows.length > 0 && (
        <div className="max-h-[210px] overflow-auto px-3 pb-3">
          <div style={{ height: Math.max(rows.length * 34, 110) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={rows}
                margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
                barCategoryGap={6}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="alasan"
                  tickLine={false}
                  axisLine={false}
                  width={132}
                  fontSize={11}
                  tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  formatter={(v) => [`${v} paket`, 'Jumlah']}
                />
                <Bar dataKey="jumlah" radius={[0, 4, 4, 0]} maxBarSize={22} fill="var(--accent-blue)">
                  <LabelList dataKey="jumlah" position="right" fontSize={11} className="fill-foreground" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
