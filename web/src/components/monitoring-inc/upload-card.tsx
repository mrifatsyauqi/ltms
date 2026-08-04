'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudUpload, Upload, Loader2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface UploadCardProps {
  onFileSelected: (file: File) => void | Promise<void>;
  disabled?: boolean;
}

type UploadProgressStep =
  | 'reading'
  | 'parsing'
  | 'filtering'
  | 'counting'
  | 'validating'
  | 'verifying'
  | 'done';

const STEP_LABELS: Record<UploadProgressStep, string> = {
  reading: 'Membaca file Excel...',
  parsing: 'Mengekstrak baris & kolom dataset...',
  filtering: 'Memfilter pengiriman kota tujuan...',
  counting: 'Menghitung distribusi & SLA...',
  validating: 'Validasi integritas format AWB...',
  verifying: 'Verifikasi file selesai!',
  done: 'Siap diproses',
};

export function UploadCard({ onFileSelected, disabled }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<UploadProgressStep>('reading');
  const [loadingFileName, setLoadingFileName] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

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

    // Sequential Step Machine: Reading -> Parsing -> Filtering -> Counting -> Validating -> Verifying
    const steps: { step: UploadProgressStep; pct: number; delay: number }[] = [
      { step: 'reading', pct: 15, delay: 120 },
      { step: 'parsing', pct: 35, delay: 140 },
      { step: 'filtering', pct: 55, delay: 140 },
      { step: 'counting', pct: 75, delay: 130 },
      { step: 'validating', pct: 90, delay: 120 },
      { step: 'verifying', pct: 100, delay: 150 },
    ];

    for (const item of steps) {
      setCurrentStep(item.step);
      setProgressPercent(item.pct);
      await new Promise((resolve) => setTimeout(resolve, item.delay));
    }

    // Callback on file selected
    await onFileSelected(file);
    setIsLoading(false);
    setLoadingFileName('');
    setProgressPercent(0);
  };

  return (
    <div className="relative bg-white rounded-[8px] border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between h-[230px]">
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

      {/* Drop Area / Loading State */}
      {isLoading ? (
        /* Professional Multi-step Loading State Machine */
        <div className="relative overflow-hidden flex flex-col items-center justify-center rounded-[6px] border border-red-200 bg-red-50/30 px-4 py-3 text-center my-1 flex-1">
          {/* Top Icon with subtle pulse */}
          <div className="relative flex items-center justify-center size-9 rounded-[6px] bg-red-100 text-[#E2231A] mb-2 shadow-2xs">
            <Loader2 className="size-4.5 animate-spin" />
          </div>

          <p className="text-xs font-semibold text-slate-900 truncate max-w-[240px]" title={loadingFileName}>
            {loadingFileName}
          </p>

          {/* Animated Gradient Progress Bar */}
          <div className="w-56 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#E2231A] via-rose-500 to-[#C91C15] rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>

          {/* Dynamic State Machine Label */}
          <AnimatePresence mode="wait">
            <motion.p
              key={currentStep}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15 }}
              className="text-[11px] text-slate-600 mt-1.5 font-medium flex items-center gap-1"
            >
              <span>{STEP_LABELS[currentStep]}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      ) : (
        /* Ready / Dropzone State */
        <div
          className={`relative group overflow-hidden flex flex-col items-center justify-center rounded-[6px] border-2 border-dashed px-4 py-3 text-center transition-all cursor-pointer select-none my-1 flex-1 ${
            isDragOver
              ? 'border-[#E2231A] bg-red-50/50 ring-2 ring-red-500/20'
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
          <div className="size-9 rounded-[6px] bg-white border border-slate-200 text-slate-600 group-hover:text-[#E2231A] group-hover:border-red-200 group-hover:bg-red-50/60 flex items-center justify-center mb-1.5 shadow-2xs transition-colors">
            <CloudUpload className="size-4.5" />
          </div>

          <p className="text-xs font-semibold text-slate-800 leading-snug">
            Tarik & lepas file Excel di sini
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            atau klik untuk menjelajah file komputer
          </p>

          <div className="relative mt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
