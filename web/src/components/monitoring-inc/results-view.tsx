'use client';

import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Image as ImageIcon,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  Percent,
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
  userDropPoint?: string;
}

export function ResultsView({
  data,
  stats,
  targetKota,
  generateTime,
  onReset,
  onTargetKotaChange,
  isCityLocked,
  userDropPoint,
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
        description: 'Format formal siap di-paste ke WhatsApp, Telegram, atau grup cabang.',
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

      // Tambahkan ringkasan di bawah sheet
      const summaryStartRow = exportRows.length + 3;
      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ['RINGKASAN MONITORING INC'],
          ['Total AWB Outgoing INC', stats.total],
          ['Clear TTD', stats.clear],
          ['Belum TTD / Telat SLA', stats.belum + stats.late],
          ['Presentase TTD', `${stats.percent}%`],
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
      {/* Hidden Offscreen Canvas for Generating Crisp Formal Image */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
        <ReportImageCanvas
          ref={hiddenCanvasRef}
          data={data}
          stats={stats}
          targetKota={targetKota}
          generateTime={generateTime}
          userDropPoint={userDropPoint}
        />
      </div>

      {/* 1. Header Bar with Integrated Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">
            Monitoring INC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring pengiriman Inter City (INC) SLA maksimal 24 jam • Terakhir digenerate:{' '}
            <span className="font-medium text-slate-700">{generateTime}</span>
          </p>
        </div>

        {/* Action Controls Top Right */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Upload File Baru Button */}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
          >
            <ArrowLeft className="size-3.5 text-slate-500" />
            Upload File Baru
          </button>

          {/* Target Kota Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 shadow-2xs text-xs font-medium text-slate-800">
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
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Copy Gambar Laporan */}
          <button
            type="button"
            disabled={isCopyingImage}
            onClick={handleCopyImage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs active:scale-98 transition-all"
          >
            <ImageIcon className="size-3.5 text-blue-600" />
            {isCopyingImage ? 'Menyiapkan Gambar...' : 'Salin Gambar'}
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs active:scale-98 transition-all"
          >
            <Download className="size-3.5 text-emerald-600" />
            Ekspor Excel
          </button>
        </div>
      </div>

      {/* 2. 4 KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total AWB INC */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <FileText className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Total AWB INC</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.total}</p>
            <p className="text-[11px] text-slate-400">Total Pengiriman</p>
          </div>
        </div>

        {/* Card 2: Clear TTD */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Clear TTD (≤24 Jam)</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.clear}</p>
            <p className="text-[11px] font-medium text-emerald-600">{stats.percent}% Tepat Waktu</p>
          </div>
        </div>

        {/* Card 3: Belum TTD / Telat */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Belum TTD / Telat</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{stats.belum + stats.late}</p>
            <p className="text-[11px] font-medium text-amber-600">
              {stats.total > 0 ? Math.round(((stats.belum + stats.late) / stats.total) * 100) : 0}% Belum Selesai
            </p>
          </div>
        </div>

        {/* Card 4: Presentase (Paling Kanan) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Percent className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Presentase</p>
            <p className="text-xl font-bold text-indigo-900 leading-tight">{stats.percent}%</p>
            <p className="text-[11px] font-medium text-indigo-600">Pencapaian SLA</p>
          </div>
        </div>
      </div>

      {/* 3. Modern Data Table */}
      <MonitoringIncTable data={data} />
    </div>
  );
}
