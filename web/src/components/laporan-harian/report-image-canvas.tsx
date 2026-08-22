import React, { forwardRef } from 'react';
import { CodTable } from './cod-table';
import type { CodTableTotals, ManualNumericFields, ManualTextFields, OkIndicator, PhotoSlot, SprinterCodRow } from './types';

interface ReportImageCanvasProps {
  dpLabel: string;
  namaSpv: string;
  codRows: SprinterCodRow[];
  totals: CodTableTotals;
  manualNumeric: ManualNumericFields;
  manualText: ManualTextFields;
  sisaSetoranH1: string;
  photos: PhotoSlot[];
  totalSetoranKurir: number | null;
  ttdCodSistem: number | null;
  okIndicator: OkIndicator;
  pctDelivery: number | null;
  totalKaryawanMasuk: number | null;
}

const fmtRp = (v: number | null) => (v === null ? '-' : `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(v))}`);
const fmtPct = (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(0)}%`);
const fmtNum = (v: number | null) => (v === null ? '-' : v);

/** Baris label:value ala sheet Excel "INFORMASI" (kolom label kiri, colon,
 *  value kanan) - dipakai kolom Informasi di bawah. */
function InfoLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5 py-0.5 text-[12px]">
      <span className="text-slate-700 shrink-0">{label}</span>
      <span className="text-slate-400">:</span>
      <span className="font-semibold text-slate-900 text-right flex-1 truncate">{value}</span>
    </div>
  );
}

export const ReportImageCanvas = forwardRef<HTMLDivElement, ReportImageCanvasProps>(
  (
    {
      dpLabel,
      namaSpv,
      codRows,
      totals,
      manualNumeric,
      manualText,
      sisaSetoranH1,
      photos,
      totalSetoranKurir,
      ttdCodSistem,
      okIndicator,
      pctDelivery,
      totalKaryawanMasuk,
    },
    ref
  ) => {
    return (
      <div ref={ref} style={{ width: 'max-content', backgroundColor: '#FFFFFF' }} className="p-6 text-slate-900 font-sans">
        <div className="flex items-stretch gap-4">
          {/* Kolom kiri: INFORMASI - ala sheet Excel (label:value), sama
              gaya title bar #4f6272 dgn tabel Excel-style lain di app ini. */}
          <div className="w-[280px] shrink-0 border border-gray-400 rounded-[6px] overflow-hidden self-start">
            <div className="bg-[#4f6272] text-white px-3 py-2 text-center text-[13px] font-bold uppercase tracking-wide">
              Informasi
            </div>
            <div className="p-3 divide-y divide-slate-100">
              <div className="pb-1.5">
                <InfoLine label="Kode - Nama DP" value={dpLabel} />
                <InfoLine label="Nama SPV" value={namaSpv || '-'} />
                <InfoLine label="Total Scan Sampai" value={fmtNum(manualNumeric.totalScanSampai)} />
                <InfoLine label="Total Scan Delivery" value={fmtNum(manualNumeric.totalScanDelivery)} />
                <InfoLine label="% Delivery" value={fmtPct(pctDelivery)} />
                <InfoLine label="Total Setoran Kurir" value={fmtRp(totalSetoranKurir)} />
                <InfoLine label="TTD COD (Sistem)" value={fmtRp(ttdCodSistem)} />
                <InfoLine label="Status Setoran" value={okIndicator} />
                <InfoLine label="Sisa Setoran H-1" value={sisaSetoranH1 || '-'} />
              </div>
              <div className="py-1.5">
                <p className="text-[11px] font-bold text-slate-500 uppercase mb-0.5">Absensi</p>
                <InfoLine label="Total Karyawan Masuk" value={fmtNum(totalKaryawanMasuk)} />
                <InfoLine label="- Jumlah Admin" value={fmtNum(manualNumeric.jumlahAdmin)} />
                <InfoLine label="- Jumlah Sprinter" value={fmtNum(manualNumeric.jumlahSprinter)} />
                <InfoLine label="- Jumlah Sortir" value={fmtNum(manualNumeric.jumlahSortir)} />
                <InfoLine label="Penambahan Peakseason" value={fmtNum(manualNumeric.penambahanPeakseason)} />
              </div>
              <div className="pt-1.5 space-y-1.5 text-[11px]">
                <div>
                  <p className="font-bold text-slate-500 uppercase">Nama Terlambat / Ijin</p>
                  <p className="text-slate-800">{manualText.namaTerlambatIjin || '-'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-500 uppercase">Missroute</p>
                  <p className="text-slate-800">{manualText.missroute || '-'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-500 uppercase">Nama² Indikasi COD</p>
                  <p className="text-slate-800">{manualText.namaIndikasiCod || '-'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-500 uppercase">Nama² Telat Setoran H-1</p>
                  <p className="text-slate-800">{manualText.namaTelatSetoranH1 || '-'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-500 uppercase">Catatan Khusus</p>
                  <p className="text-slate-800">{manualText.catatanKhusus || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom tengah: Rincian Nominal COD Kurir (Bagian A) */}
          <div className="self-start">
            <CodTable rows={codRows} totals={totals} dpLabel={dpLabel} />
          </div>

          {/* Kolom kanan: Foto-Foto Kondisi DP (opsional) */}
          <div className="w-[220px] shrink-0 border border-gray-400 rounded-[6px] overflow-hidden self-start">
            <div className="bg-[#4f6272] text-white px-3 py-2 text-center text-[13px] font-bold uppercase tracking-wide">
              Foto-Foto Kondisi DP
            </div>
            <div className="p-2.5 space-y-2.5">
              {photos.map((slot) => (
                <div key={slot.label} className="border border-slate-200 rounded-[4px] overflow-hidden">
                  <p className="bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">{slot.label}</p>
                  <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {slot.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slot.imageDataUrl} alt={slot.label} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-slate-400">Belum ada foto</span>
                    )}
                  </div>
                  <div className="px-2 py-1 text-[10px] text-slate-600 flex justify-between border-t border-slate-100">
                    <span>Jam: {slot.jam || '-'}</span>
                    <span>Kondisi: {slot.kondisi || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ReportImageCanvas.displayName = 'ReportImageCanvas';
