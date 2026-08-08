import React, { forwardRef } from 'react';
import { CodTable } from './cod-table';
import type { CodTableTotals, ManualNumericFields, ManualTextFields, OkIndicator, SprinterCodRow } from './types';

interface ReportImageCanvasProps {
  dpLabel: string;
  namaSpv: string;
  codRows: SprinterCodRow[];
  totals: CodTableTotals;
  manualNumeric: ManualNumericFields;
  manualText: ManualTextFields;
  totalSetoranKurir: number | null;
  ttdCodSistem: number | null;
  okIndicator: OkIndicator;
  pctDelivery: number | null;
  totalKaryawanMasuk: number | null;
}

const fmtRp = (v: number | null) => (v === null ? '-' : `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(v))}`);
const fmtPct = (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(0)}%`);

export const ReportImageCanvas = forwardRef<HTMLDivElement, ReportImageCanvasProps>(
  (
    { dpLabel, namaSpv, codRows, totals, manualNumeric, manualText, totalSetoranKurir, ttdCodSistem, okIndicator, pctDelivery, totalKaryawanMasuk },
    ref
  ) => {
    return (
      <div ref={ref} style={{ width: 'max-content', minWidth: '1200px', backgroundColor: '#FFFFFF' }} className="p-8 text-slate-900 font-sans">
        <div className="grid grid-cols-4 gap-3.5 mb-6">
          <div className="bg-slate-50/80 rounded-[8px] p-4 border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Drop Point</p>
            <p className="text-xl font-bold text-slate-900">{dpLabel}</p>
            <p className="text-[10px] text-slate-500">SPV: {namaSpv || '-'}</p>
          </div>
          <div className="bg-blue-50/60 rounded-[8px] p-4 border border-blue-200">
            <p className="text-[11px] font-semibold text-blue-800 uppercase">Total Scan</p>
            <p className="text-xl font-bold text-blue-900">{manualNumeric.totalScanSampai ?? '-'} / {manualNumeric.totalScanDelivery ?? '-'}</p>
            <p className="text-[10px] text-blue-700">Sampai / Delivery ({fmtPct(pctDelivery)})</p>
          </div>
          <div className="bg-emerald-50/60 rounded-[8px] p-4 border border-emerald-200">
            <p className="text-[11px] font-semibold text-emerald-800 uppercase">Total Setoran Kurir</p>
            <p className="text-xl font-bold text-emerald-900">{fmtRp(totalSetoranKurir)}</p>
            <p className="text-[10px] text-emerald-700">TTD COD Sistem: {fmtRp(ttdCodSistem)}</p>
          </div>
          <div className="bg-amber-50/60 rounded-[8px] p-4 border border-amber-200">
            <p className="text-[11px] font-semibold text-amber-800 uppercase">Status Setoran</p>
            <p className="text-xl font-bold text-amber-900">{okIndicator}</p>
            <p className="text-[10px] text-amber-700">Karyawan Masuk: {totalKaryawanMasuk ?? '-'}</p>
          </div>
        </div>

        <CodTable rows={codRows} totals={totals} dpLabel={dpLabel} />

        {(manualText.namaTerlambatIjin || manualText.missroute || manualText.namaIndikasiCod || manualText.namaTelatSetoranH1 || manualText.catatanKhusus) && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            {manualText.namaTerlambatIjin && <div><span className="font-bold">Terlambat/Ijin: </span>{manualText.namaTerlambatIjin}</div>}
            {manualText.missroute && <div><span className="font-bold">Missroute: </span>{manualText.missroute}</div>}
            {manualText.namaIndikasiCod && <div><span className="font-bold">Indikasi COD: </span>{manualText.namaIndikasiCod}</div>}
            {manualText.namaTelatSetoranH1 && <div><span className="font-bold">Telat Setoran H-1: </span>{manualText.namaTelatSetoranH1}</div>}
            {manualText.catatanKhusus && <div className="col-span-2"><span className="font-bold">Catatan Khusus: </span>{manualText.catatanKhusus}</div>}
          </div>
        )}
      </div>
    );
  }
);

ReportImageCanvas.displayName = 'ReportImageCanvas';
