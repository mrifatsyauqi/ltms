'use client';

import { FileSpreadsheet, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { UploadedFileInfo } from './types';

interface UploadedFileCardProps {
  fileInfo: UploadedFileInfo | null;
  onReplaceFile: () => void;
  onDeleteFile: () => void;
  targetKota: string;
}

export function UploadedFileCard({
  fileInfo,
  onReplaceFile,
  onDeleteFile,
  targetKota,
}: UploadedFileCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-[230px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5 rounded-[6px] bg-[#E2231A] text-white text-[11px] font-bold shadow-xs">
            2
          </span>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            File Terverifikasi
          </h3>
        </div>

        {fileInfo && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[6px] border border-emerald-200 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle2 className="size-3 text-emerald-600" />
            File berhasil diverifikasi
          </span>
        )}
      </div>

      {fileInfo ? (
        /* Verified Content with Slide Up + Scale 0.95 -> 1 + Duration 500ms */
        <div className="flex flex-col justify-between flex-1 mt-2 animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-500 fill-mode-forwards">
          {/* Top Box: File Icon + Details + Actions */}
          <div className="flex items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-lg border border-[#E5E7EB]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-[6px] bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <FileSpreadsheet className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px]" title={fileInfo.name}>
                  {fileInfo.name}
                </p>
                <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                  {fileInfo.sizeFormatted}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onReplaceFile}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] border border-[#E5E7EB] bg-white hover:bg-slate-50 active:scale-98 text-slate-700 text-xs font-medium shadow-2xs transition-all duration-150"
              >
                <RefreshCw className="size-3 text-slate-500" />
                Ganti
              </button>

              <button
                type="button"
                onClick={onDeleteFile}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] border border-rose-200 bg-rose-50/50 hover:bg-rose-100 active:scale-98 text-rose-700 text-xs font-medium shadow-2xs transition-all duration-150"
              >
                <Trash2 className="size-3 text-rose-600" />
                Hapus
              </button>
            </div>
          </div>

          {/* Bottom Grid: Filtered Count, Upload Time, Target City */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E7EB] text-left">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Jumlah Resi</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {fileInfo.totalResi.toLocaleString('id-ID')} Resi
              </p>
              {fileInfo.rawTotalResi > fileInfo.totalResi && (
                <p className="text-[9.5px] text-slate-400 truncate">
                  (dari {fileInfo.rawTotalResi.toLocaleString('id-ID')} total)
                </p>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Waktu Upload</p>
              <p className="text-xs font-medium text-slate-700 mt-0.5">
                {fileInfo.uploadTimestamp}
              </p>
              <p className="text-[9.5px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> Ready
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Target Kota</p>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-[6px] bg-[#E2231A] text-white text-[11px] font-bold tracking-wide shadow-2xs">
                {targetKota || fileInfo.targetKota}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Waiting State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#E5E7EB] rounded-lg bg-slate-50/30 my-1">
          <p className="text-xs font-medium text-slate-400">
            Belum ada file Excel yang dipilih
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Silakan pilih atau seret file pada langkah 1 di sebelah kiri
          </p>
        </div>
      )}
    </div>
  );
}
