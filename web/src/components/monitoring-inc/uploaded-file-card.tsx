'use client';

import { motion } from 'framer-motion';
import { FileSpreadsheet, RefreshCw, Trash2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadedFileCardProps {
  fileName: string;
  fileSizeFormatted: string;
  totalResi: number;
  uploadDateFormatted: string;
  targetCity: string;
  onChangeFile: () => void;
  onRemoveFile: () => void;
  disabled?: boolean;
}

export function UploadedFileCard({
  fileName,
  fileSizeFormatted,
  totalResi,
  uploadDateFormatted,
  targetCity,
  onChangeFile,
  onRemoveFile,
  disabled = false,
}: UploadedFileCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center size-6 rounded-full bg-[#E30613] text-white text-xs font-bold shadow-sm">
          2
        </span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">File Berhasil Diupload</h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        whileHover={disabled ? undefined : { y: -2, boxShadow: '0 12px 28px rgba(0,0,0,0.07)' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white border border-[#E5E7EB] rounded-[18px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 transition-shadow"
      >
        {/* Left: Excel Icon & File Info */}
        <div className="flex items-center gap-3.5 min-w-[240px]">
          <div className="size-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
            <FileSpreadsheet className="size-6 stroke-[2.2]" />
          </div>
          <div className="space-y-0.5 overflow-hidden">
            <p className="text-[14px] font-bold text-slate-900 font-mono tracking-tight truncate max-w-[280px]" title={fileName}>
              {fileName}
            </p>
            <p className="text-xs text-slate-500 font-medium">{fileSizeFormatted}</p>
          </div>
        </div>

        {/* Center: Metadata Columns */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 border-y lg:border-y-0 lg:border-x border-slate-100 py-3 lg:py-0 lg:px-8">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">Jumlah Data</span>
            <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
              {totalResi.toLocaleString('id-ID')} Resi
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">Tanggal Upload</span>
            <span className="text-xs font-semibold text-slate-700 mt-0.5 block whitespace-nowrap">
              {uploadDateFormatted}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">Target Kota</span>
            <span className="inline-block text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
              {targetCity}
            </span>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onChangeFile}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 shadow-none hover:shadow-sm"
          >
            <ArrowLeftRight className="size-3.5 text-slate-500" />
            Ganti File
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onRemoveFile}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5 shadow-none hover:shadow-sm"
          >
            <Trash2 className="size-3.5 text-rose-500" />
            Hapus
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
