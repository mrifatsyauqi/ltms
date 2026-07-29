import React, { forwardRef } from 'react';

export type MonitoringRow = {
  sprinter: string;
  waybillDelivery: number;
  tandaTerima: number;
  belumDiterima: number;
  paketBermasalah: number;
  presentaseTtd: number;
};

interface MonitoringTableProps {
  data: MonitoringRow[];
  totalSampai: number;
  dpName: string;
}

export const MonitoringTable = forwardRef<HTMLTableElement, MonitoringTableProps>(({ data, totalSampai, dpName }, ref) => {
  // Hitung Agregat
  const totalDelivery = data.reduce((sum, row) => sum + row.waybillDelivery, 0);
  const totalTandaTerima = data.reduce((sum, row) => sum + row.tandaTerima, 0);
  const totalBelumDiterima = data.reduce((sum, row) => sum + row.belumDiterima, 0);
  const totalPaketBermasalah = data.reduce((sum, row) => sum + row.paketBermasalah, 0);

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-[#b6d7a8] text-black'; // Hijau
    if (percentage > 90) return 'bg-[#ffe599] text-black'; // Kuning muda
    return 'bg-[#ea9999] text-black'; // Merah
  };

  const formatPercent = (val: number) => {
    if (isNaN(val) || !isFinite(val)) return '0.0%';
    return val.toFixed(1) + '%';
  };

  // Kelas dasar sel: font lebih besar (text-base) + padding ringkas. Angka
  // whitespace-nowrap + tabular-nums supaya kolom numerik ramping & rata.
  const cell = 'border border-gray-400 px-2.5 py-2 text-base';
  const numCell = `${cell} text-center whitespace-nowrap tabular-nums`;

  // ref di elemen <table> (bukan wrapper) supaya gambar hasil copy pas ukuran
  // tabel, tanpa margin/padding samping. Wrapper hanya utk scroll di layar.
  return (
    <div className="inline-block overflow-x-auto bg-white align-top">
      <table ref={ref} className="border-collapse border border-gray-400 font-sans text-base text-black">
        <colgroup>
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
        </colgroup>
        <thead>
          <tr className="bg-[#4f6272] text-white">
            <th colSpan={6} className="border border-gray-400 px-3 py-2.5 text-center align-middle text-lg font-bold tracking-wide uppercase whitespace-nowrap">
              MONITORING DELIVERY {dpName}
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th rowSpan={2} className={`${cell} text-left align-middle font-semibold`}>
              Sprinter
            </th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-semibold`}>
              Jumlah Waybill<br />Delivery
            </th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-semibold`}>
              Jumlah Tanda<br />Terima
            </th>
            <th colSpan={2} className={`${cell} text-center font-semibold`}>
              Belum Tanda Terima
            </th>
            <th rowSpan={2} className={`${cell} text-center align-middle font-semibold`}>
              Presentase<br />TTD
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th className={`${cell} text-center font-semibold`}>Belum diterima</th>
            <th className={`${cell} text-center font-semibold`}>Paket Bermasalah</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              <td className={`${cell} whitespace-nowrap`}>{row.sprinter}</td>
              <td className={numCell}>{row.waybillDelivery}</td>
              <td className={numCell}>{row.tandaTerima}</td>
              <td className={numCell}>{row.belumDiterima}</td>
              <td className={numCell}>{row.paketBermasalah}</td>
              <td className={`${numCell} font-semibold ${getPercentageColor(row.presentaseTtd)}`}>
                {formatPercent(row.presentaseTtd)}
              </td>
            </tr>
          ))}
          {/* Row: TOTAL DELIVERY */}
          <tr className="bg-gray-50 font-bold">
            <td className={`${cell} whitespace-nowrap uppercase`}>TOTAL DELIVERY</td>
            <td className={numCell}>{totalDelivery}</td>
            <td className={numCell}>{totalTandaTerima}</td>
            <td className={numCell}>{totalBelumDiterima}</td>
            <td className={numCell}>{totalPaketBermasalah}</td>
            <td className={`${cell} bg-gray-200`}></td>
          </tr>
          {/* Row: PRESENTASE */}
          <tr className="bg-gray-50 font-bold">
            <td colSpan={2} className={`${cell} whitespace-nowrap uppercase`}>
              PRESENTASE
            </td>
            <td className={numCell}>{formatPercent((totalTandaTerima / totalDelivery) * 100)}</td>
            <td className={numCell}>{formatPercent((totalBelumDiterima / totalDelivery) * 100)}</td>
            <td className={`${cell} bg-gray-200`}></td>
            <td className={`${cell} bg-gray-200`}></td>
          </tr>
          {/* Row: TOTAL SAMPAI */}
          <tr className="bg-gray-50 font-bold">
            <td className={`${cell} whitespace-nowrap uppercase`}>TOTAL SAMPAI</td>
            <td className={numCell}>{totalSampai}</td>
            <td className={numCell}>
              {totalSampai > 0 ? formatPercent((totalTandaTerima / totalSampai) * 100) : '0.0%'}
            </td>
            <td className={numCell}>
              {totalSampai > 0 ? formatPercent((totalBelumDiterima / totalSampai) * 100) : '0.0%'}
            </td>
            <td className={`${cell} bg-gray-200`}></td>
            <td className={`${cell} bg-gray-200`}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

MonitoringTable.displayName = 'MonitoringTable';
