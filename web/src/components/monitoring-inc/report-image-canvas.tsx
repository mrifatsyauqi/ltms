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

    return (
      <div
        ref={ref}
        style={{ width: '1200px', backgroundColor: '#FFFFFF' }}
        className="p-8 text-slate-900 font-sans"
      >
        {/* 1. Header Formal & Professional (Tanpa Logo LTMS) */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
              Monitoring INC
            </h1>
            <p className="text-xs font-semibold text-slate-600 tracking-wide mt-0.5">
              UNIT / CABANG: <span className="text-slate-900 font-bold">{dpDisplayName}</span> • KOTA <span className="text-slate-900 font-bold">{targetKota}</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-slate-700">
              🗓 Waktu Generate:
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {generateTime}
            </p>
          </div>
        </div>

        {/* 2. 4 KPI Summary Cards Grid */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {/* Card 1: Total AWB */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center gap-3">
            <div className="size-9 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="size-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Total AWB INC</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{stats.total}</p>
              <p className="text-[10px] text-slate-500">Total Pengiriman</p>
            </div>
          </div>

          {/* Card 2: Clear TTD */}
          <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-200 flex items-center gap-3">
            <div className="size-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-tight">Clear TTD (≤24 Jam)</p>
              <p className="text-xl font-bold text-emerald-900 leading-tight">{stats.clear}</p>
              <p className="text-[10px] text-emerald-700 font-semibold">{stats.percent}% Tepat Waktu</p>
            </div>
          </div>

          {/* Card 3: Belum TTD / Telat */}
          <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200 flex items-center gap-3">
            <div className="size-9 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="size-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-tight">Belum TTD / Telat</p>
              <p className="text-xl font-bold text-amber-900 leading-tight">{stats.belum + stats.late}</p>
              <p className="text-[10px] text-amber-700 font-semibold">
                {stats.total > 0 ? Math.round(((stats.belum + stats.late) / stats.total) * 100) : 0}% Belum Selesai
              </p>
            </div>
          </div>

          {/* Card 4: Presentase (Menggantikan Rata-rata SLA) */}
          <div className="bg-indigo-50/60 rounded-lg p-3 border border-indigo-200 flex items-center gap-3">
            <div className="size-9 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Percent className="size-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-indigo-800 uppercase tracking-tight">Presentase</p>
              <p className="text-xl font-bold text-indigo-900 leading-tight">{stats.percent}%</p>
              <p className="text-[10px] text-indigo-700 font-semibold">Pencapaian SLA</p>
            </div>
          </div>
        </div>

        {/* 3. Table with Crisp Borders */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
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
              {data.map((row, idx) => (
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
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Clear TTD
                      </span>
                    )}
                    {row.status === 'BELUM' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        Belum TTD
                      </span>
                    )}
                    {row.status === 'LATE' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                        Telat SLA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

ReportImageCanvas.displayName = 'ReportImageCanvas';
