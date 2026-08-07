'use client';

import React, { forwardRef } from 'react';
import { IncRow, IncStats } from './types';
import { FileText, CheckCircle2, Clock, Percent } from 'lucide-react';

interface ReportImageCanvasProps {
  data: IncRow[];
  stats: IncStats;
  targetKota: string;
  generateTime: string;
  userDropPoint?: string;
}

export const ReportImageCanvas = forwardRef<HTMLDivElement, ReportImageCanvasProps>(
  ({ data, stats, targetKota, generateTime, userDropPoint }, ref) => {
    const formatCurrency = (val: number) => {
      if (!val || val === 0) return '0';
      return new Intl.NumberFormat('id-ID').format(val);
    };

    const dpDisplayName = userDropPoint && userDropPoint !== 'SEMUA DP'
      ? userDropPoint
      : `DP ${targetKota}`;

    // Batas baris di SCREENSHOT (bukan tabel di layar/Ekspor Excel - itu
    // tetap tampilkan semua baris). Tanpa batas, toPng() bisa menghasilkan
    // gambar raksasa (data ratusan/ribuan baris x pixelRatio 2) yang base64-nya
    // menembus limit body request platform (413 Request Entity Too Large,
    // gagal kirim ke Feishu). 60 baris tetap jauh lebih banyak dari batas
    // lama (8) tanpa berisiko gambar kegedean.
    const SCREENSHOT_ROW_LIMIT = 60;
    const visibleRows = data.slice(0, SCREENSHOT_ROW_LIMIT);
    const hiddenRowCount = data.length - visibleRows.length;

    return (
      <div
        ref={ref}
        style={{ width: '1200px', minHeight: '900px', backgroundColor: '#FFFFFF' }}
        className="p-8 text-slate-900 font-sans flex flex-col justify-between"
      >
        <div>
          {/* 1. Modern Enterprise Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-5 mb-6">
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-[8px] bg-[#E2231A] text-white flex items-center justify-center font-black text-lg shadow-sm">
                LT
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
                  Monitoring INC {dpDisplayName}
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {targetKota} • Last Mile Delivery Logistics
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                Waktu Generate
              </span>
              <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                {generateTime}
              </p>
            </div>
          </div>

          {/* 2. 4 KPI Summary Cards Grid */}
          <div className="grid grid-cols-4 gap-3.5 mb-6">
            {/* Card 1: Total Resi */}
            <div className="bg-slate-50/80 rounded-[8px] p-4 border border-slate-200 flex items-center gap-3.5 shadow-2xs">
              <div className="size-10 rounded-[6px] bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Total Resi</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight font-mono">{stats.total.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-slate-500">Total Paket INC</p>
              </div>
            </div>

            {/* Card 2: Belum TTD */}
            <div className="bg-amber-50/60 rounded-[8px] p-4 border border-amber-200 flex items-center gap-3.5 shadow-2xs">
              <div className="size-10 rounded-[6px] bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-tight">Belum TTD</p>
                <p className="text-2xl font-bold text-amber-900 leading-tight font-mono">{stats.belum.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-amber-700 font-medium">Dalam Pengantaran</p>
              </div>
            </div>

            {/* Card 3: Melebihi SLA */}
            <div className="bg-rose-50/60 rounded-[8px] p-4 border border-rose-200 flex items-center gap-3.5 shadow-2xs">
              <div className="size-10 rounded-[6px] bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-rose-800 uppercase tracking-tight">Melebihi SLA</p>
                <p className="text-2xl font-bold text-rose-900 leading-tight font-mono">{stats.late.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-rose-700 font-medium">Prioritas Follow-up</p>
              </div>
            </div>

            {/* Card 4: Progress SLA */}
            <div className="bg-emerald-50/60 rounded-[8px] p-4 border border-emerald-200 flex items-center gap-3.5 shadow-2xs">
              <div className="size-10 rounded-[6px] bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Percent className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-tight">Progress TTD</p>
                <p className="text-2xl font-bold text-emerald-900 leading-tight font-mono">{stats.percent}%</p>
                <p className="text-[10px] text-emerald-700 font-semibold">{stats.clear} Paket Selesai</p>
              </div>
            </div>
          </div>

          {/* 3. Tabel penuh semua AWB, gaya Excel - REUSE title bar & grid
              style persis dari MonitoringTable (Monitoring Delivery), sama
              dgn tabel on-screen (monitoring-inc-table.tsx). GANTI blok
              "Drop Point Tujuan"/breakdown Kecamatan yang dulu ada di sini
              (blok itu TETAP ADA di kartu Interactive Feishu yang dikirim,
              cuma dihapus dari versi gambar/screenshot ini). Font +30%,
              padding baris dirapatkan. */}
          <div className="rounded-[8px] border border-gray-400 overflow-hidden shadow-2xs">
            <div className="bg-[#4f6272] text-white px-3 py-2 text-center text-[15px] font-bold uppercase tracking-wide">
              Monitoring INC {dpDisplayName}
            </div>
            <table className="w-full text-left text-[14px] border-collapse border border-gray-400">
              <thead className="bg-white border-b border-gray-400">
                <tr className="text-black uppercase font-bold text-[13px] tracking-wider">
                  <th className="py-1.5 px-3 font-bold border border-gray-400 text-center">No</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">AWB</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">Tempat Tujuan</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">Nama Penerima</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">Alamat Penerima</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400 text-right">COD</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">Waktu TTD</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">Maksimal TTD</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400">Waktu Upload ke Sistem</th>
                  <th className="py-1.5 px-3 font-bold border border-gray-400 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
                  <tr key={`${row.awb}-${idx}`} className="even:bg-slate-50/50">
                    <td className="py-1 px-3 border border-gray-400 text-center text-slate-500 font-medium">{idx + 1}</td>
                    <td className="py-1 px-3 border border-gray-400 font-mono font-bold text-slate-900">{row.awb}</td>
                    <td className="py-1 px-3 border border-gray-400 font-medium text-slate-800">{row.tempatTujuan}</td>
                    <td className="py-1 px-3 border border-gray-400 text-slate-700">{row.namaPenerima}</td>
                    <td className="py-1 px-3 border border-gray-400 text-slate-600 max-w-[200px] truncate">{row.alamatPenerima}</td>
                    <td className="py-1 px-3 border border-gray-400 font-mono text-right text-slate-800">{formatCurrency(row.cod)}</td>
                    <td className="py-1 px-3 border border-gray-400 font-mono text-slate-600">{row.waktuTtd || '-'}</td>
                    <td className="py-1 px-3 border border-gray-400 font-mono text-slate-600">{row.maksimalTtd || '-'}</td>
                    <td className="py-1 px-3 border border-gray-400 font-mono text-slate-600">{row.waktuUploadSistem || '-'}</td>
                    <td className="py-1 px-3 border border-gray-400 text-center">
                      {row.status === 'CLEAR' && (
                        <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Clear TTD
                        </span>
                      )}
                      {row.status === 'BELUM' && (
                        <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                          Belum TTD
                        </span>
                      )}
                      {row.status === 'LATE' && (
                        <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                          Telat SLA
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hiddenRowCount > 0 && (
              <div className="bg-slate-50 py-1.5 px-3 text-center text-[13px] text-slate-500 font-medium border-t border-gray-400">
                +{hiddenRowCount.toLocaleString('id-ID')} baris lainnya - lihat tabel lengkap di layar atau Ekspor Excel
              </div>
            )}
          </div>
        </div>

        {/* Footer info in graphic */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>LTMS Enterprise • Logistics Task & Monitoring System</span>
          <span>Target Kota: {targetKota}</span>
        </div>
      </div>
    );
  }
);

ReportImageCanvas.displayName = 'ReportImageCanvas';

