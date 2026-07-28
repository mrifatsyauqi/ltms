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

export const MonitoringTable = forwardRef<HTMLDivElement, MonitoringTableProps>(({ data, totalSampai, dpName }, ref) => {
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

  return (
    <div ref={ref} className="bg-white p-4 inline-block w-full overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-sm font-sans" style={{ minWidth: '800px' }}>
        <thead>
          <tr className="bg-[#4f6272] text-white">
            <th colSpan={6} className="border border-gray-400 px-3 py-3 text-center align-middle font-bold text-lg uppercase tracking-wider">
              MONITORING DELIVERY {dpName}
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th rowSpan={2} className="border border-gray-400 px-3 py-2 text-center align-middle font-semibold">
              Sprinter
            </th>
            <th rowSpan={2} className="border border-gray-400 px-3 py-2 text-center align-middle font-semibold">
              Jumlah Waybill Delivery
            </th>
            <th rowSpan={2} className="border border-gray-400 px-3 py-2 text-center align-middle font-semibold">
              Jumlah Tanda Terima
            </th>
            <th colSpan={2} className="border border-gray-400 px-3 py-2 text-center font-semibold">
              Belum Tanda Terima
            </th>
            <th rowSpan={2} className="border border-gray-400 px-3 py-2 text-center align-middle font-semibold">
              Presentase TTD
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Belum diterima</th>
            <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Paket Bermasalah</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              <td className="border border-gray-400 px-3 py-1.5">{row.sprinter}</td>
              <td className="border border-gray-400 px-3 py-1.5 text-center">{row.waybillDelivery}</td>
              <td className="border border-gray-400 px-3 py-1.5 text-center">{row.tandaTerima}</td>
              <td className="border border-gray-400 px-3 py-1.5 text-center">{row.belumDiterima}</td>
              <td className="border border-gray-400 px-3 py-1.5 text-center">{row.paketBermasalah}</td>
              <td
                className={`border border-gray-400 px-3 py-1.5 text-center font-medium ${getPercentageColor(
                  row.presentaseTtd,
                )}`}
              >
                {formatPercent(row.presentaseTtd)}
              </td>
            </tr>
          ))}
          {/* Row: TOTAL DELIVERY */}
          <tr className="bg-gray-50 font-bold">
            <td className="border border-gray-400 px-3 py-1.5 uppercase">TOTAL DELIVERY</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">{totalDelivery}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">{totalTandaTerima}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">{totalBelumDiterima}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">{totalPaketBermasalah}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center bg-gray-200"></td>
          </tr>
          {/* Row: PRESENTASE */}
          <tr className="bg-gray-50 font-bold">
            <td colSpan={2} className="border border-gray-400 px-3 py-1.5 uppercase">
              PRESENTASE
            </td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">
              {formatPercent((totalTandaTerima / totalDelivery) * 100)}
            </td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">
              {formatPercent((totalBelumDiterima / totalDelivery) * 100)}
            </td>
            <td className="border border-gray-400 px-3 py-1.5 bg-gray-200"></td>
            <td className="border border-gray-400 px-3 py-1.5 bg-gray-200"></td>
          </tr>
          {/* Row: TOTAL SAMPAI */}
          <tr className="bg-gray-50 font-bold">
            <td className="border border-gray-400 px-3 py-1.5 uppercase">TOTAL SAMPAI</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">{totalSampai}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">
              {totalSampai > 0 ? formatPercent((totalTandaTerima / totalSampai) * 100) : '0.0%'}
            </td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">
              {totalSampai > 0 ? formatPercent((totalBelumDiterima / totalSampai) * 100) : '0.0%'}
            </td>
            <td className="border border-gray-400 px-3 py-1.5 bg-gray-200"></td>
            <td className="border border-gray-400 px-3 py-1.5 bg-gray-200"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

MonitoringTable.displayName = 'MonitoringTable';
