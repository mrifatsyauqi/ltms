'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

/** Warna per kategori Distribusi Feedback (Bagian 8 PRD), stabil lintas halaman. */
const KATEGORI_COLOR: Record<string, string> = {
  'Clear TTD': 'var(--chart-1)',
  'On Delivery': 'var(--chart-2)',
  Reschedule: 'var(--chart-3)',
  'Penerima Tidak Di Tempat': 'var(--chart-4)',
  'Alamat Tidak Ditemukan': 'var(--chart-5)',
  Lainnya: 'var(--chart-6)',
  'Belum Feedback': 'var(--chart-7)',
};

type Item = { kategori: string; jumlah: number };

export function FeedbackDonut({ data }: { data: Item[] }) {
  const total = data.reduce((s, d) => s + d.jumlah, 0);
  const shown = data.filter((d) => d.jumlah > 0);

  if (total === 0) {
    return (
      <p role="status" className="text-muted-foreground py-10 text-center text-sm">
        Belum ada data feedback.
      </p>
    );
  }

  return (
    // Panel sempit -> donut di atas, legend di bawah. Panel lebar -> sejajar.
    <div className="flex flex-col items-center gap-2 @[17rem]:flex-row @[17rem]:gap-3">
      <div className="relative h-[176px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="jumlah" nameKey="kategori" innerRadius={46} outerRadius={70} paddingAngle={2}>
              {shown.map((d) => (
                <Cell key={d.kategori} fill={KATEGORI_COLOR[d.kategori] ?? 'var(--chart-6)'} stroke="var(--card)" />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [`${Number(v)} paket (${((Number(v) / total) * 100).toFixed(1)}%)`, String(n)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-muted-foreground text-[10px]">Total</span>
          <span className="text-lg font-bold tabular-nums">{total.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Legend dgn angka + persentase: warna bukan satu-satunya penanda (a11y). */}
      <ul className="min-w-0 flex-1 space-y-0.5">
        {data.map((d) => (
          <li key={d.kategori} className="flex items-center gap-1.5 text-[11px] leading-tight">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: KATEGORI_COLOR[d.kategori] ?? 'var(--chart-6)' }}
            />
            <span className="min-w-0 flex-1 truncate">{d.kategori}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {d.jumlah.toLocaleString('id-ID')} ({total ? ((d.jumlah / total) * 100).toFixed(0) : '0'}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
