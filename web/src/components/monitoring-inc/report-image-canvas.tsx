'use client';

import React, { forwardRef } from 'react';
import { IncRow, IncStats } from './types';
import { FileText, CheckCircle2, Clock, AlertCircle, Timer, PieChart } from 'lucide-react';

interface ReportImageCanvasProps {
  data: IncRow[];
  stats: IncStats;
  targetKota: string;
  generateTime: string;
}

export const ReportImageCanvas = forwardRef<HTMLDivElement, ReportImageCanvasProps>(
  ({ data, stats, targetKota, generateTime }, ref) => {
    const formatCurrency = (val: number) => {
      if (!val || val === 0) return '0';
      return new Intl.NumberFormat('id-ID').format(val);
    };

    return (
      <div
        ref={ref}
        style={{ width: '1200px', backgroundColor: '#FFFFFF' }}
        className="p-8 text-slate-900 font-sans"
      >
        {/* 1. Header Branding */}
        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-5 mb-6">
          <div className="flex items-center gap-3">
            {/* LTMS Cube Logo */}
            <div className="size-11 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md">
              <span className="font-black text-xl tracking-wider">LT</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-950">LTMS</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold border border-red-200">
                  MONITORING INC
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
                Logistics Monitoring System
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold mb-1">
              <span>📍 KOTA {targetKota}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Generated: {generateTime}
            </p>
          </div>
        </div>

        {/* 2. 5 KPI Summary Cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {/* Card 1: Total AWB */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">Total AWB INC</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-[10px] text-slate-400">Total Pengiriman</p>
            </div>
          </div>

          {/* Card 2: Clear TTD */}
          <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-200/80 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-emerald-800">Clear TTD (≤24 Jam)</p>
              <p className="text-xl font-bold text-emerald-900">{stats.clear}</p>
              <p className="text-[10px] text-emerald-700 font-bold">{stats.percent}% Tepat Waktu</p>
            </div>
          </div>

          {/* Card 3: Belum TTD */}
          <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200/80 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-amber-800">Belum TTD (&gt;24 Jam)</p>
              <p className="text-xl font-bold text-amber-900">{stats.belum}</p>
              <p className="text-[10px] text-amber-700 font-medium">
                {stats.total > 0 ? Math.round((stats.belum / stats.total) * 100) : 0}% Belum Selesai
              </p>
            </div>
          </div>

          {/* Card 4: Telat SLA */}
          <div className="bg-rose-50/50 rounded-xl p-3.5 border border-rose-200/80 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-rose-800">Telat SLA (24 Jam)</p>
              <p className="text-xl font-bold text-rose-900">{stats.late}</p>
              <p className="text-[10px] text-rose-700 font-medium">
                {stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0}% Melebihi SLA
              </p>
            </div>
          </div>

          {/* Card 5: Rata-rata SLA */}
          <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-200/80 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Timer className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-purple-800">Rata-rata SLA</p>
              <p className="text-xl font-bold text-purple-900">{stats.avgSlaHours || 0}</p>
              <p className="text-[10px] text-purple-700 font-medium">Jam Pengiriman</p>
            </div>
          </div>
        </div>

        {/* 3. Table with Exact Columns */}
        <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Clear TTD
                      </span>
                    )}
                    {row.status === 'BELUM' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Belum TTD
                      </span>
                    )}
                    {row.status === 'LATE' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        Telat SLA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Bottom Summary Cards */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                TOTAL AWB OUTGOING INC
              </p>
              <p className="text-xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                CLEAR TTD
              </p>
              <p className="text-xl font-black text-emerald-900">{stats.clear}</p>
            </div>
          </div>

          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <PieChart className="size-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                PRESENTASE
              </p>
              <p className="text-xl font-black text-purple-900">{stats.percent}%</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ReportImageCanvas.displayName = 'ReportImageCanvas';
