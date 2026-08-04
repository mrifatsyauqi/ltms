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

    // Hitung Top Kecamatan breakdown
    const kecamatanMap = new Map<string, { total: number; belum: number; late: number; clear: number }>();
    data.forEach((row) => {
      const kec = row.tempatTujuan?.trim() || 'Lainnya';
      const existing = kecamatanMap.get(kec) || { total: 0, belum: 0, late: 0, clear: 0 };
      existing.total += 1;
      if (row.status === 'CLEAR') existing.clear += 1;
      if (row.status === 'BELUM') existing.belum += 1;
      if (row.status === 'LATE') existing.late += 1;
      kecamatanMap.set(kec, existing);
    });

    const topKecamatan = Array.from(kecamatanMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);

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
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
                    Monitoring INC
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
                    {targetKota}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Unit / Drop Point: <strong className="text-slate-800">{dpDisplayName}</strong> • Last Mile Delivery Logistics
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

          {/* 3. Top Kecamatan Summary Section */}
          {topKecamatan.length > 0 && (
            <div className="bg-slate-50/60 rounded-[8px] border border-slate-200 p-4 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                <span>Distribusi Wilayah & Tempat Tujuan</span>
                <span className="text-[11px] font-normal text-slate-500">Top {topKecamatan.length} Kecamatan</span>
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {topKecamatan.map(([kec, info]) => {
                  const pct = stats.total > 0 ? Math.round((info.total / stats.total) * 100) : 0;
                  return (
                    <div key={kec} className="bg-white rounded-[6px] p-2.5 border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[180px]" title={kec}>
                          {kec}
                        </span>
                        <span className="text-[11px] font-bold text-slate-900 font-mono">
                          {info.total} resi
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-[#E2231A] h-full rounded-full"
                          style={{ width: `${Math.max(5, Math.min(100, pct))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                        <span>Clear: <strong className="text-emerald-700">{info.clear}</strong></span>
                        <span>Pending/Late: <strong className="text-rose-700">{info.belum + info.late}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Table Preview with Crisp Borders */}
          <div className="rounded-[8px] border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 font-bold">AWB</th>
                  <th className="py-2.5 px-3 font-bold">Tempat Tujuan</th>
                  <th className="py-2.5 px-3 font-bold">Nama Penerima</th>
                  <th className="py-2.5 px-3 font-bold">Alamat Penerima</th>
                  <th className="py-2.5 px-3 font-bold text-right">COD</th>
                  <th className="py-2.5 px-3 font-bold">Waktu TTD</th>
                  <th className="py-2.5 px-3 font-bold">Maksimal TTD</th>
                  <th className="py-2.5 px-3 font-bold">Waktu Upload ke Sistem</th>
                  <th className="py-2.5 px-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.slice(0, 8).map((row, idx) => (
                  <tr key={`${row.awb}-${idx}`} className="even:bg-slate-50/50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.awb}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{row.tempatTujuan}</td>
                    <td className="py-2 px-3 text-slate-700">{row.namaPenerima}</td>
                    <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">{row.alamatPenerima}</td>
                    <td className="py-2 px-3 font-mono text-right text-slate-800">{formatCurrency(row.cod)}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{row.waktuTtd || '-'}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{row.maksimalTtd || '-'}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{row.waktuUploadSistem || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      {row.status === 'CLEAR' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Clear TTD
                        </span>
                      )}
                      {row.status === 'BELUM' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                          Belum TTD
                        </span>
                      )}
                      {row.status === 'LATE' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                          Telat SLA
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 8 && (
              <div className="bg-slate-50 py-1.5 px-3 text-center text-[11px] text-slate-500 font-medium border-t border-slate-200">
                Menampilkan 8 dari {data.length.toLocaleString('id-ID')} total paket
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

