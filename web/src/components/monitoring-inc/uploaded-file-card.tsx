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
    <div className="bg-card rounded-[8px] border border-border p-4 shadow-xs flex flex-col justify-between h-[230px] transition-all hover:border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
            2
          </span>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            File Terverifikasi
          </h3>
        </div>

        {fileInfo && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[6px] border border-emerald-200">
            <CheckCircle2 className="size-3 text-emerald-600" />
            Siap Diproses
          </span>
        )}
      </div>

      {fileInfo ? (
        <div className="flex flex-col justify-between flex-1 mt-2 animate-in fade-in-50 duration-200">
          {/* Top Row: Excel Icon + File info + Action buttons */}
          <div className="flex items-center justify-between gap-3 bg-muted p-2.5 rounded-[6px] border border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-[6px] bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileSpreadsheet className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate max-w-[200px]" title={fileInfo.name}>
                  {fileInfo.name}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {fileInfo.sizeFormatted}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onReplaceFile}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-border bg-card hover:bg-muted active:scale-[0.98] text-foreground text-xs font-medium shadow-2xs transition-all cursor-pointer"
              >
                <RefreshCw className="size-3 text-muted-foreground" />
                Ganti
              </button>

              <button
                type="button"
                onClick={onDeleteFile}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-rose-200 bg-rose-50/60 hover:bg-rose-100 active:scale-[0.98] text-rose-700 text-xs font-medium shadow-2xs transition-all cursor-pointer"
              >
                <Trash2 className="size-3 text-rose-600" />
                Hapus
              </button>
            </div>
          </div>

          {/* Bottom Row: Key Information Columns */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-left">
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Jumlah Resi</p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {fileInfo.totalResi.toLocaleString('id-ID')} Resi
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Waktu Upload</p>
              <p className="text-xs font-medium text-foreground mt-0.5">
                {fileInfo.uploadTimestamp}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Target Kota</p>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-[4px] bg-slate-900 text-white text-[11px] font-bold tracking-wide">
                {targetKota || fileInfo.targetKota}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Waiting State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-[6px] bg-muted/30 my-1">
          <p className="text-xs font-medium text-muted-foreground">
            Belum ada file Excel yang dipilih
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Silakan pilih atau seret file pada langkah 1 di sebelah kiri
          </p>
        </div>
      )}
    </div>
  );
}
