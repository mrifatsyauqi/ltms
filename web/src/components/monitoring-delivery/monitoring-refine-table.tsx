import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type RefineRow = {
  /** Kode DP hasil lookup normalized ke master_drop_point; '' kalau tak ketemu. */
  kodeDp: string;
  dpDelivery: string;
  totalDelivery: number;
  ttdNormalTotal: number;
  ttdNormalAdaFoto: number;
  ttdNormalTidakAdaFoto: number;
  scanRetorTotal: number;
  scanRetorAdaFoto: number;
  scanRetorTidakAdaFoto: number;
  belumJumlahAwb: number;
  belumJumlahInventory: number;
  belumTinggalGudang: number;
  belumPaketBermasalah: number;
  belumInputAwb: number;
};

interface MonitoringRefineTableProps {
  data: RefineRow[];
  generatedAt: Date;
  /** Nama kota (mis. "BATANG") - dihitung di MonitoringRefineClient dari Nama
   *  Kota milik DP yang cocok, BUKAN diketik manual. Kosong kalau tak ada
   *  satu pun DP yang cocok ke Master Drop Point. */
  namaKota?: string;
}

const MONTHS_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// "d MMMM yyyy, HH.mm" di zona Jakarta (UTC+7 tetap, tanpa DST) - format
// TETAP dipakai (bukan Intl.toLocaleString) supaya hasilnya presisi sama
// persis lintas browser, mis. "30 Juli 2026, 12.00".
function formatGeneratedAt(d: Date) {
  const j = new Date(d.getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${j.getUTCDate()} ${MONTHS_FULL[j.getUTCMonth()]} ${j.getUTCFullYear()}, ${p(j.getUTCHours())}.${p(j.getUTCMinutes())}`;
}

// Ambang beda dari tabel Rekap Standar: hijau >=95%, kuning 85-94,99%, merah <85%.
function getRasioColor(percentage: number) {
  if (percentage >= 95) return 'bg-[#b6d7a8] text-black';
  if (percentage >= 85) return 'bg-[#ffe599] text-black';
  return 'bg-[#ea9999] text-black';
}

function formatPercent(val: number) {
  if (isNaN(val) || !isFinite(val)) return '0.0%';
  return val.toFixed(1) + '%';
}

// Rasio TTD dihitung ulang dari (TTD Normal + Scan TTD Retur) / Total Delivery
// di semua level (baris & TOTAL) — bukan dibaca mentah dari file — supaya
// tetap benar setelah baris dgn DP sama (mis. beda tanggal) dijumlahkan.
function rasioTtd(row: { ttdNormalTotal: number; scanRetorTotal: number; totalDelivery: number }) {
  return row.totalDelivery > 0 ? ((row.ttdNormalTotal + row.scanRetorTotal) / row.totalDelivery) * 100 : 0;
}

export const MonitoringRefineTable = forwardRef<HTMLTableElement, MonitoringRefineTableProps>(({ data, generatedAt, namaKota }, ref) => {
  const totals = data.reduce(
    (acc, row) => ({
      totalDelivery: acc.totalDelivery + row.totalDelivery,
      ttdNormalTotal: acc.ttdNormalTotal + row.ttdNormalTotal,
      ttdNormalAdaFoto: acc.ttdNormalAdaFoto + row.ttdNormalAdaFoto,
      ttdNormalTidakAdaFoto: acc.ttdNormalTidakAdaFoto + row.ttdNormalTidakAdaFoto,
      scanRetorTotal: acc.scanRetorTotal + row.scanRetorTotal,
      scanRetorAdaFoto: acc.scanRetorAdaFoto + row.scanRetorAdaFoto,
      scanRetorTidakAdaFoto: acc.scanRetorTidakAdaFoto + row.scanRetorTidakAdaFoto,
      belumJumlahAwb: acc.belumJumlahAwb + row.belumJumlahAwb,
      belumJumlahInventory: acc.belumJumlahInventory + row.belumJumlahInventory,
      belumTinggalGudang: acc.belumTinggalGudang + row.belumTinggalGudang,
      belumPaketBermasalah: acc.belumPaketBermasalah + row.belumPaketBermasalah,
      belumInputAwb: acc.belumInputAwb + row.belumInputAwb,
    }),
    {
      totalDelivery: 0,
      ttdNormalTotal: 0,
      ttdNormalAdaFoto: 0,
      ttdNormalTidakAdaFoto: 0,
      scanRetorTotal: 0,
      scanRetorAdaFoto: 0,
      scanRetorTidakAdaFoto: 0,
      belumJumlahAwb: 0,
      belumJumlahInventory: 0,
      belumTinggalGudang: 0,
      belumPaketBermasalah: 0,
      belumInputAwb: 0,
    },
  );
  const totalRasio = rasioTtd(totals);

  const cell = 'border border-gray-400 px-2.5 py-0.5 text-base leading-none';
  const numCell = cn(cell, 'text-center whitespace-nowrap tabular-nums text-lg');

  return (
    <div className="inline-block overflow-x-auto bg-white align-top">
      <table ref={ref} className="border-collapse border border-gray-400 font-sans text-base text-black">
        <thead>
          <tr className="bg-[#4f6272] text-white">
            <th colSpan={16} className="border border-gray-400 px-3 py-2.5 text-center align-middle text-lg font-bold tracking-wide uppercase whitespace-nowrap">
              MONITORING DELIVERY {namaKota ? `(${namaKota}) ` : ''}| {formatGeneratedAt(generatedAt)}
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th rowSpan={2} className={`${cell} text-center align-middle font-semibold`}>NO</th>
            <th rowSpan={2} className={`${cell} text-left align-middle font-semibold`}>Kode DP</th>
            <th rowSpan={2} className={`${cell} text-left align-middle font-semibold`}>DP Delivery</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-semibold`}>Total<br />Delivery</th>
            <th colSpan={3} className={`${cell} text-center font-semibold`}>TTD Normal</th>
            <th colSpan={3} className={`${cell} text-center font-semibold`}>Scan TTD Retur</th>
            <th colSpan={5} className={`${cell} text-center font-semibold`}>Belum Diterima</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-semibold`}>Rasio<br />TTD</th>
          </tr>
          <tr className="bg-gray-100">
            <th className={`${cell} text-center font-semibold`}>Total</th>
            <th className={`${cell} text-center font-semibold`}>Ada Foto<br />TTD</th>
            <th className={`${cell} text-center font-semibold`}>Tidak Ada<br />Foto TTD</th>
            <th className={`${cell} text-center font-semibold`}>Total</th>
            <th className={`${cell} text-center font-semibold`}>Ada Foto<br />TTD</th>
            <th className={`${cell} text-center font-semibold`}>Tidak Ada<br />Foto TTD</th>
            <th className={`${cell} text-center font-semibold`}>Jumlah</th>
            <th className={`${cell} text-center font-semibold`}>Jumlah<br />Inventory</th>
            <th className={`${cell} text-center font-semibold`}>Tinggal<br />Gudang</th>
            <th className={`${cell} text-center font-semibold`}>Paket<br />Bermasalah</th>
            <th className={`${cell} text-center font-semibold`}>Belum Input<br />AWB</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={`${row.dpDelivery}-${idx}`}>
              <td className={numCell}>{idx + 1}</td>
              <td className={`${cell} whitespace-nowrap`}>{row.kodeDp || '-'}</td>
              <td className={`${cell} whitespace-nowrap`}>{row.dpDelivery}</td>
              <td className={numCell}>{row.totalDelivery}</td>
              <td className={numCell}>{row.ttdNormalTotal}</td>
              <td className={numCell}>{row.ttdNormalAdaFoto}</td>
              <td className={numCell}>{row.ttdNormalTidakAdaFoto}</td>
              <td className={numCell}>{row.scanRetorTotal}</td>
              <td className={numCell}>{row.scanRetorAdaFoto}</td>
              <td className={numCell}>{row.scanRetorTidakAdaFoto}</td>
              <td className={numCell}>{row.belumJumlahAwb}</td>
              <td className={numCell}>{row.belumJumlahInventory}</td>
              <td className={numCell}>{row.belumTinggalGudang}</td>
              <td className={numCell}>{row.belumPaketBermasalah}</td>
              <td className={numCell}>{row.belumInputAwb}</td>
              <td className={`${numCell} font-semibold ${getRasioColor(rasioTtd(row))}`}>{formatPercent(rasioTtd(row))}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td colSpan={3} className={`${cell} whitespace-nowrap uppercase`}>TOTAL</td>
            <td className={numCell}>{totals.totalDelivery}</td>
            <td className={numCell}>{totals.ttdNormalTotal}</td>
            <td className={numCell}>{totals.ttdNormalAdaFoto}</td>
            <td className={numCell}>{totals.ttdNormalTidakAdaFoto}</td>
            <td className={numCell}>{totals.scanRetorTotal}</td>
            <td className={numCell}>{totals.scanRetorAdaFoto}</td>
            <td className={numCell}>{totals.scanRetorTidakAdaFoto}</td>
            <td className={numCell}>{totals.belumJumlahAwb}</td>
            <td className={numCell}>{totals.belumJumlahInventory}</td>
            <td className={numCell}>{totals.belumTinggalGudang}</td>
            <td className={numCell}>{totals.belumPaketBermasalah}</td>
            <td className={numCell}>{totals.belumInputAwb}</td>
            <td className={`${numCell} ${getRasioColor(totalRasio)}`}>{formatPercent(totalRasio)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

MonitoringRefineTable.displayName = 'MonitoringRefineTable';
