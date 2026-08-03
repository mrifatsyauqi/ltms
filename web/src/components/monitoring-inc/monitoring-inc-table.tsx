import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type IncRow = {
  awb: string;
  tempatTujuan: string;
  namaPenerima: string;
  alamatPenerima: string;
  cod: number;
  waktuTtd: string; // 'YYYY-MM-DD HH:mm:ss' atau ''
  maksimalTtd: string; // 'HH:mm:ss' atau 'YYYY-MM-DD HH:mm:ss'
  maksimalTtdFull?: string;
  waktuUploadSistem: string; // 'YYYY-MM-DD HH:mm:ss'
  isClearTtd: boolean;
  isLate: boolean;
};

interface MonitoringIncTableProps {
  data: IncRow[];
  filterKecamatan?: string;
  kota?: string;
}

export const MonitoringIncTable = forwardRef<HTMLTableElement, MonitoringIncTableProps>(
  ({ data, filterKecamatan, kota }, ref) => {
    const totalAwb = data.length;
    const clearTtd = data.filter((r) => r.isClearTtd).length;
    const presentase = totalAwb > 0 ? Math.round((clearTtd / totalAwb) * 100) : 0;

    const cell = 'border border-gray-400 px-2 py-1 text-sm leading-tight';
    const numCell = cn(cell, 'text-center whitespace-nowrap tabular-nums');
    const headerLeft = 'border border-gray-400 px-2 py-1.5 text-center font-bold text-slate-800 bg-[#d9e2ec] text-sm whitespace-nowrap';
    const headerRight = 'border border-gray-400 px-2 py-1.5 text-center font-bold text-white bg-[#2b3d51] text-sm whitespace-nowrap';
    const footerLabel = 'border border-gray-400 px-3 py-1.5 text-left font-bold text-white bg-[#2b3d51] text-sm tracking-wide uppercase';
    const footerValue = 'border border-gray-400 px-2 py-1.5 text-center font-bold text-white bg-[#2b3d51] text-base tabular-nums';

    const formatCod = (val: number) => {
      if (!val || isNaN(val)) return '0';
      return val.toLocaleString('id-ID');
    };

    return (
      <div className="inline-block overflow-x-auto bg-white align-top">
        <table ref={ref} className="border-collapse border border-gray-400 font-sans text-sm text-black bg-white">
          <colgroup>
            <col style={{ width: '130px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ minWidth: '220px', maxWidth: '380px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '155px' }} />
            <col style={{ width: '115px' }} />
            <col style={{ width: '155px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={headerLeft}>AWB</th>
              <th className={headerLeft}>Tempat Tujuan</th>
              <th className={headerLeft}>Nama Penerima</th>
              <th className={headerLeft}>Alamat Penerima</th>
              <th className={headerLeft}>COD</th>
              <th className={headerRight}>Waktu TTD</th>
              <th className={headerRight}>MAKSIMAL TTD</th>
              <th className={headerRight}>Waktu Upload ke Sistem</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              // Highlight merah/salmon muda jika Waktu TTD telat (> Maksimal TTD)
              const ttdCellClass = row.isLate
                ? cn(numCell, 'bg-[#fca5a5] text-slate-900 font-semibold')
                : numCell;

              return (
                <tr key={`${row.awb}-${idx}`} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                  <td className={cn(cell, 'font-mono text-xs whitespace-nowrap font-medium text-slate-900')}>
                    {row.awb}
                  </td>
                  <td className={cn(cell, 'whitespace-nowrap font-medium text-slate-800')}>
                    {row.tempatTujuan}
                  </td>
                  <td className={cn(cell, 'whitespace-nowrap text-slate-800')}>
                    {row.namaPenerima}
                  </td>
                  <td className={cn(cell, 'text-xs break-words text-slate-700 max-w-[380px]')}>
                    {row.alamatPenerima}
                  </td>
                  <td className={cn(numCell, 'text-right font-mono text-xs')}>
                    {formatCod(row.cod)}
                  </td>
                  <td className={ttdCellClass}>
                    {row.waktuTtd || ''}
                  </td>
                  <td className={numCell}>
                    {row.maksimalTtd}
                  </td>
                  <td className={numCell}>
                    {row.waktuUploadSistem}
                  </td>
                </tr>
              );
            })}

            {data.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-gray-400 p-6 text-center text-muted-foreground text-sm">
                  Tidak ada data untuk ditampilkan.
                </td>
              </tr>
            )}

            {/* Row: JUMLAH AWB OUTGOING INC */}
            <tr>
              <td colSpan={4} className={footerLabel}>
                JUMLAH AWB OUTGOING INC {kota ? `(${kota.toUpperCase()})` : ''}
              </td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
              <td className={footerValue}>{totalAwb}</td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
            </tr>

            {/* Row: CLEAR TTD */}
            <tr>
              <td colSpan={4} className={footerLabel}>
                CLEAR TTD
              </td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
              <td className={footerValue}>{clearTtd}</td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
            </tr>

            {/* Row: PRESENTASE */}
            <tr>
              <td colSpan={4} className={footerLabel}>
                PRESENTASE
              </td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
              <td className={footerValue}>{presentase}%</td>
              <td className={cn(footerLabel, 'border-l-0')}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  },
);

MonitoringIncTable.displayName = 'MonitoringIncTable';
