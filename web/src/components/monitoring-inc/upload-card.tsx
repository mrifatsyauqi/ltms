'use client';

import { useRef, useState } from 'react';
import { CloudUpload, Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface UploadCardProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadCard({ onFileSelected, disabled }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFileName, setLoadingFileName] = useState('');

  const handleProcessFile = async (file: File) => {
    if (!file) return;

    // Validasi ekstensi
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const isExtValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isExtValid) {
      toast.error('Format file tidak didukung. Harap upload file .xlsx atau .xls.');
      return;
    }

    // Validasi ukuran < 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Ukuran file melebihi batas maksimal 10 MB.');
      return;
    }

    setIsLoading(true);
    setLoadingFileName(file.name);

    // Animasi skeleton loading profesional (350ms)
    setTimeout(() => {
      onFileSelected(file);
      setIsLoading(false);
      setLoadingFileName('');
    }, 350);
  };

  return (
    <div className="relative bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between h-[230px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
            1
          </span>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Upload File Excel</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400">JMS Outgoing INC</span>
      </div>

      {/* Drop Area */}
      {isLoading ? (
        /* Professional Skeleton Loading State */
        <div className="relative overflow-hidden flex flex-col items-center justify-center rounded-lg border-2 border-red-500/40 bg-red-50/20 px-4 py-3 text-center my-1 flex-1 animate-pulse">
          <div className="relative flex items-center justify-center size-10 rounded-lg bg-red-100/80 text-red-600 mb-2">
            <Loader2 className="size-5 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-800 truncate max-w-[240px]">
            {loadingFileName}
          </p>
          <div className="w-48 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-red-600 rounded-full animate-[shimmer_1s_infinite] w-full bg-gradient-to-r from-red-500 via-rose-400 to-red-600" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            Memverifikasi dan memproses struktur Excel...
          </p>
        </div>
      ) : (
        /* Ready / Dropzone State with Glowing Border on Hover/Drag */
        <div
          className={`relative group overflow-hidden flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-3 text-center transition-all cursor-pointer select-none my-1 flex-1 ${
            isDragOver
              ? 'border-red-500 bg-red-50/50 ring-2 ring-red-500/20'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50/80'
          } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleProcessFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="size-9 rounded-lg bg-white border border-slate-200 text-slate-600 group-hover:text-red-600 group-hover:border-red-200 group-hover:bg-red-50/60 flex items-center justify-center mb-1.5 shadow-2xs transition-colors">
            <CloudUpload className="size-4.5" />
          </div>

          <p className="text-xs font-semibold text-slate-800 leading-snug">
            Tarik & lepas file Excel di sini
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            atau klik untuk menjelajah file komputer
          </p>

          <div className="relative mt-2">
            {/* Subtle Gradient Glow Ring around Button */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-md blur-xs opacity-0 group-hover:opacity-40 transition duration-300" />
            <button
              type="button"
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Upload className="size-3.5" />
              Pilih File
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleProcessFile(e.target.files[0]);
              }
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
        <span>Format: XLSX, XLS</span>
        <span>Maksimal 10 MB</span>
      </div>
    </div>
  );
}
