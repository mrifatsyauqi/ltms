'use client';

import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Image as ImageIcon,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Timer,
  PieChart,
  MapPin,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { IncRow, IncStats, AVAILABLE_CITIES } from './types';
import { MonitoringIncTable } from './monitoring-inc-table';
import { ReportImageCanvas } from './report-image-canvas';

interface ResultsViewProps {
  data: IncRow[];
  stats: IncStats;
  targetKota: string;
  generateTime: string;
  onReset: () => void;
  onTargetKotaChange: (city: string) => void;
  isCityLocked?: boolean;
}

export function ResultsView({
  data,
  stats,
  targetKota,
  generateTime,
  onReset,
  onTargetKotaChange,
  isCityLocked,
}: ResultsViewProps) {
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const hiddenCanvasRef = useRef<HTMLDivElement>(null);

  // Copy Gambar Laporan ke Clipboard
  const handleCopyImage = async () => {
    if (!hiddenCanvasRef.current || isCopyingImage) return;

    try {
      setIsCopyingImage(true);
      const node = hiddenCanvasRef.current;

      const dataUrl = await toPng(node, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);

      toast.success('Gambar laporan berhasil disalin ke clipboard!', {
        description: 'Siap di-paste ke WhatsApp, Telegram, atau Feishu.',
        position: 'bottom-right',
      });
    } catch (err) {
      console.error('Gagal menyalin gambar laporan:', err);
      toast.error('Gagal menyalin gambar. Pastikan izin clipboard aktif.');
    } finally {
      setIsCopyingImage(false);
    }
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportRows = data.map((row) => ({
        'AWB': row.awb,
        'Tempat Tujuan': row.tempatTujuan,
        'Nama Penerima': row.namaPenerima,
        'Alamat Penerima': row.alamatPenerima,
        'COD': row.cod,
        'Waktu TTD': row.waktuTtd || '-',
        'Maksimal TTD': row.maksimalTtd || '-',
        'Waktu Upload ke Sistem': row.waktuUploadSistem || '-',
        'Status':
          row.status === 'CLEAR'
            ? 'Clear TTD'
            : row.status === 'BELUM'
            ? 'Belum TTD'
            : 'Telat SLA',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);

      // Tambahkan ringkasan di bawah
      const summaryStartRow = exportRows.length + 3;
      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ['RINGKASAN MONITORING INC'],
          ['Total AWB Outgoing INC', stats.total],
          ['Clear TTD', stats.clear],
          ['Belum TTD', stats.belum],
          ['Telat SLA', stats.late],
          ['Presentase TTD', `${stats.percent}%`],
          ['Rata-rata SLA (Jam)', stats.avgSlaHours],
        ],
        { origin: `A${summaryStartRow}` }
      );

      XLSX.utils.book_append_sheet(wb, ws, `INC_${targetKota}`);
      XLSX.writeFile(wb, `MONITORING_INC_${targetKota}_${Date.now()}.xlsx`);

      toast.success('File Excel berhasil diunduh!');
    } catch (err) {
      console.error('Gagal export excel:', err);
      toast.error('Gagal mengekspor data Excel.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Hidden Offscreen Canvas for Generating Crisp Image */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
        <ReportImageCanvas
          ref={hiddenCanvasRef}
          data={data}
          stats={stats}
          targetKota={targetKota}
          generateTime={generateTime}
        />
      </div>

      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors shrink-0 mt-1"
          >
            <ArrowLeft className="size-3.5" />
            Upload Ulang
          </button>

          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Monitoring INC
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring pengiriman Inter City (INC) dengan batas SLA maksimal TTD 24 jam.
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
              <span>🗓 Terakhir digenerate:</span>
              <span className="font-semibold text-slate-600">{generateTime}</span>
            </p>
          </div>
        </div>

        {/* Action Controls Top Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Target Kota Dropdown */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs text-xs font-bold text-slate-800">
              <MapPin className="size-3.5 text-red-600" />
              {isCityLocked ? (
                <div className="flex items-center gap-1">
                  <span>{targetKota}</span>
                  <Lock className="size-3 text-slate-400" />
                </div>
              ) : (
                <select
                  value={targetKota}
                  onChange={(e) => onTargetKotaChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {AVAILABLE_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Copy Gambar Laporan */}
          <button
            type="button"
            disabled={isCopyingImage}
            onClick={handleCopyImage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs active:scale-95 transition-all"
          >
            <ImageIcon className="size-3.5 text-blue-600" />
            {isCopyingImage ? 'Menyiapkan Gambar...' : 'Copy Gambar Laporan'}
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs active:scale-95 transition-all"
          >
            <Download className="size-3.5 text-emerald-600" />
            Export Excel
          </button>
        </div>
      </div>

      {/* 2. 5 KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total AWB INC */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Total AWB INC</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.total}</p>
            <p className="text-[11px] text-slate-500">Total Pengiriman</p>
          </div>
        </div>

        {/* Card 2: Clear TTD */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Clear TTD (≤24 Jam)</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.clear}</p>
            <p className="text-[11px] font-semibold text-emerald-600">{stats.percent}% Tepat Waktu</p>
          </div>
        </div>

        {/* Card 3: Belum TTD */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Belum TTD (&gt;24 Jam)</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.belum}</p>
            <p className="text-[11px] font-semibold text-amber-600">
              {stats.total > 0 ? Math.round((stats.belum / stats.total) * 100) : 0}% Belum Selesai
            </p>
          </div>
        </div>

        {/* Card 4: Telat SLA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertCircle className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Telat SLA (24 Jam)</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.late}</p>
            <p className="text-[11px] font-semibold text-rose-600">
              {stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0}% Melebihi SLA
            </p>
          </div>
        </div>

        {/* Card 5: Rata-rata SLA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Timer className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Rata-rata SLA</p>
            <p className="text-xl font-bold text-purple-900 leading-tight">{stats.avgSlaHours}</p>
            <p className="text-[11px] font-semibold text-purple-600">Jam</p>
          </div>
        </div>
      </div>

      {/* 3. Modern Data Table */}
      <MonitoringIncTable data={data} />

      {/* 4. Bottom Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <FileText className="size-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              TOTAL AWB OUTGOING INC
            </p>
            <p className="text-2xl font-black text-slate-900 leading-tight">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
              CLEAR TTD
            </p>
            <p className="text-2xl font-black text-slate-900 leading-tight">{stats.clear}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <PieChart className="size-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
              PRESENTASE
            </p>
            <p className="text-2xl font-black text-purple-900 leading-tight">{stats.percent}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
