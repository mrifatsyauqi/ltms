'use client';

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Warna batang mengikuti aturan aging PRD Bagian 9.1 (1 hijau, 2 kuning, >=3 merah). */
function barColor(hari: string) {
  if (hari === '1') return 'var(--aging-1-fg)';
  if (hari === '2') return 'var(--aging-2-fg)';
  return 'var(--aging-3-fg)';
}

export function AgingBarChart({ data }: { data: { hari: string; jumlah: number }[] }) {
  const kosong = data.every((d) => d.jumlah === 0);

  if (kosong) {
    return (
      <p role="status" className="text-muted-foreground py-10 text-center text-sm">
        Belum ada paket belum Clear TTD berumur ≥ 1 hari.
      </p>
    );
  }

  return (
    <div className="h-[176px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="hari"
            width={56}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v === '7+' ? '7+ Hari' : `${v} Hari`)}
            fontSize={11}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            formatter={(v) => [`${v} paket`, 'Jumlah']}
            labelFormatter={(l) => (l === '7+' ? '7+ Hari' : `${l} Hari`)}
          />
          <Bar dataKey="jumlah" radius={[0, 4, 4, 0]} barSize={14}>
            {data.map((d) => (
              <Cell key={d.hari} fill={barColor(d.hari)} />
            ))}
            <LabelList dataKey="jumlah" position="right" fontSize={11} className="fill-foreground" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
