import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { CodTableTotals, SprinterCodRow } from './types';

interface CodTableProps {
  rows: SprinterCodRow[];
  totals: CodTableTotals;
  dpLabel: string;
}

const formatCurrency = (val: number) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(val))}`;
const formatPercent = (val: number | null) => (val === null ? '-' : `${(val * 100).toFixed(0)}%`);

/** Threshold & warna PERSIS sama dgn MonitoringTable (Monitoring Delivery) -
 *  REUSE, bukan definisi warna baru (sesuai instruksi). */
function percentColor(val: number | null): string {
  if (val === null) return '';
  if (val >= 0.95) return 'bg-[#b6d7a8] text-black';
  if (val > 0.9) return 'bg-[#ffe599] text-black';
  return 'bg-[#ea9999] text-black';
}

/** "% Selisih" bisa negatif - warnanya berdasar BESARAN absolut (indikator
 *  anomali), bukan threshold 95% seperti kolom % lainnya. */
function selisihColor(val: number | null): string {
  if (val === null) return '';
  const abs = Math.abs(val);
  if (abs <= 0.05) return 'bg-[#b6d7a8] text-black';
  if (abs <= 0.1) return 'bg-[#ffe599] text-black';
  return 'bg-[#ea9999] text-black';
}

export const CodTable = forwardRef<HTMLTableElement, CodTableProps>(({ rows, totals, dpLabel }, ref) => {
  const cell = 'border border-gray-400 px-2 py-1 text-sm leading-tight whitespace-nowrap';
  const numCell = cn(cell, 'text-center tabular-nums');

  return (
    <div className="inline-block overflow-x-auto bg-white align-top">
      <table ref={ref} className="border-collapse border border-gray-400 font-sans text-sm text-black">
        <thead>
          <tr className="bg-[#4f6272] text-white">
            <th colSpan={12} className="border border-gray-400 px-3 py-2 text-center align-middle text-base font-bold tracking-wide uppercase whitespace-nowrap">
              RINCIAN NOMINAL COD KURIR - {dpLabel}
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>No</th>
            <th rowSpan={2} className={`${cell} text-left align-middle font-bold`}>ID Sprinter</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>Semua<br />Deliv</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>Semua Nominal<br />COD</th>
            <th colSpan={2} className={`${cell} text-center font-bold`}>Resi Sisa</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>Nominal<br />Sisa COD</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>% Clear<br />Jumlah Paket</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>% Clear<br />Nominal COD</th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-bold`}>%<br />Selisih</th>
            <th colSpan={2} className={`${cell} text-center font-bold`}>Target 95%</th>
          </tr>
          <tr className="bg-gray-100">
            <th className={`${cell} text-center font-bold`}>Non COD</th>
            <th className={`${cell} text-center font-bold`}>COD</th>
            <th className={`${cell} text-center font-bold`}>Sukses TTD</th>
            <th className={`${cell} text-center font-bold`}>% TTD</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12} className={`${cell} text-center text-slate-400 py-6`}>
                Belum ada sprinter dengan paket COD - upload file tarikan JMS Detail untuk melihat rincian.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={r.idSprinter}>
                <td className={numCell}>{idx + 1}</td>
                <td className={cell}>{r.idSprinter}</td>
                <td className={numCell}>{r.semuaDeliv}</td>
                <td className={numCell}>{formatCurrency(r.semuaNominalCod)}</td>
                <td className={numCell}>{r.resiSisaNonCod}</td>
                <td className={numCell}>{r.resiSisaCod}</td>
                <td className={numCell}>{formatCurrency(r.nominalSisaCod)}</td>
                <td className={cn(numCell, percentColor(r.pctClearPaket))}>{formatPercent(r.pctClearPaket)}</td>
                <td className={cn(numCell, percentColor(r.pctClearNominalCod))}>{formatPercent(r.pctClearNominalCod)}</td>
                <td className={cn(numCell, selisihColor(r.pctSelisih))}>{formatPercent(r.pctSelisih)}</td>
                <td className={numCell}>{r.suksesTtd}</td>
                <td className={cn(numCell, percentColor(r.pctTtd))}>{formatPercent(r.pctTtd)}</td>
              </tr>
            ))
          )}
          {rows.length > 0 && (
            <tr className="bg-gray-50 font-bold">
              <td colSpan={2} className={`${cell} uppercase`}>Total</td>
              <td className={numCell}>{totals.semuaDeliv}</td>
              <td className={numCell}>{formatCurrency(totals.semuaNominalCod)}</td>
              <td className={numCell}>{totals.resiSisaNonCod}</td>
              <td className={numCell}>{totals.resiSisaCod}</td>
              <td className={numCell}>{formatCurrency(totals.nominalSisaCod)}</td>
              <td className={numCell}>{formatPercent(totals.pctClearPaket)}</td>
              <td className={numCell}>{formatPercent(totals.pctClearNominalCod)}</td>
              <td className={numCell}>{formatPercent(totals.pctSelisih)}</td>
              <td className={numCell}>{totals.suksesTtd}</td>
              <td className={numCell}>{formatPercent(totals.pctTtd)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

CodTable.displayName = 'CodTable';
