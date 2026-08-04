'use client';

import { useRef, useState } from 'react';
import { CloudUpload, Upload, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { UploadStage } from './types';

interface UploadCardProps {
  onFileSelected: (file: File, setStage: (stage: UploadStage) => void) => Promise<void>;
  disabled?: boolean;
}

const STAGES: { key: UploadStage; label: string }[] = [
  { key: 'reading', label: 'Reading Excel' },
  { key: 'parsing', label: 'Parsing Data' },
  { key: 'filtering', label: 'Filtering Target City' },
  { key: 'counting', label: 'Counting Waybill' },
  { key: 'validating', label: 'Validation' },
  { key: 'completed', label: 'Completed' },
];

export function UploadCard({ onFileSelected, disabled }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [fileName, setFileName] = useState('');

  const stageIndex = (s: UploadStage) => {
    return STAGES.findIndex((item) => item.key === s);
  };

  const currentStageIdx = stageIndex(stage);

  const handleProcessFile = async (file: File) => {
    if (!file || isUploading || disabled) return;

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

    setFileName(file.name);
    setIsUploading(true);
    setStage('reading');

    try {
      await onFileSelected(file, (newStage) => {
        setStage(newStage);
      });
    } catch (err) {
      console.error('Error in file processing:', err);
      toast.error('Terjadi kesalahan saat memproses file Excel.');
    } finally {
      setIsUploading(false);
      setStage('idle');
      setFileName('');
    }
  };

  return (
    <div className="relative bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-xs transition-all duration-200 flex flex-col justify-between h-[230px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5 rounded-[6px] bg-[#E2231A] text-white text-[11px] font-bold shadow-xs">
            1
          </span>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Upload File Excel</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400">JMS Outgoing INC</span>
      </div>

      {/* Main Body: Upload / Loading Pipeline */}
      {isUploading ? (
        /* Continuous Shimmer + Stage Pipeline */
        <div className="relative overflow-hidden flex flex-col justify-center rounded-lg border border-[#E2231A]/30 bg-red-50/30 p-3 my-1 flex-1">
          {/* Top Shimmer Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#E2231A] via-rose-400 to-[#E2231A] w-full animate-[shimmer_1.2s_infinite]" />
          </div>

          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex items-center justify-center size-7 rounded-md bg-[#E2231A]/10 text-[#E2231A] shrink-0">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate" title={fileName}>
                {fileName}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Memproses data...</p>
            </div>
          </div>

          {/* Grid of Steps */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
            {STAGES.slice(0, 5).map((item, idx) => {
              const isDone = currentStageIdx > idx || stage === 'completed';
              const isCurrent = currentStageIdx === idx && stage !== 'completed';

              return (
                <div
                  key={item.key}
                  className={`flex items-center gap-1.5 text-[10.5px] transition-all duration-150 ${
                    isDone
                      ? 'text-emerald-700 font-medium'
                      : isCurrent
                      ? 'text-[#E2231A] font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="size-3 text-[#E2231A] animate-spin shrink-0" />
                  ) : (
                    <Circle className="size-2.5 text-slate-300 shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Ready / Dropzone State */
        <div
          className={`relative group overflow-hidden flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-2.5 text-center cursor-pointer select-none my-1 flex-1 transition-all duration-200 ${
            isDragOver
              ? 'border-[#E2231A] bg-red-50/50 scale-[1.01] shadow-xs'
              : 'border-[#E5E7EB] bg-slate-50/40 hover:border-[#E2231A]/50 hover:bg-red-50/20'
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
          <div className="size-8 rounded-md bg-white border border-[#E5E7EB] text-slate-600 group-hover:text-[#E2231A] group-hover:border-red-200 group-hover:bg-red-50/60 flex items-center justify-center mb-1 shadow-2xs transition-colors">
            <CloudUpload className="size-4" />
          </div>

          <p className="text-xs font-semibold text-slate-800 leading-snug">
            Tarik & lepas file Excel di sini
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            atau klik untuk memilih file dari komputer
          </p>

          <div className="mt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#E2231A] hover:bg-[#C91C15] active:scale-98 text-white text-xs font-semibold shadow-xs transition-all duration-150"
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
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
        <span>Format: XLSX, XLS</span>
        <span>Maksimal 10 MB</span>
      </div>
    </div>
  );
}
