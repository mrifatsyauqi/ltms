'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadCardProps {
  onFileSelected: (file: File) => void;
  activeTargetCity: string;
  disabled?: boolean;
}

export function UploadCard({ onFileSelected, activeTargetCity, disabled = false }: UploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = (file: File) => {
    setErrorMessage(null);

    // 1. Validasi ekstensi
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('Format file tidak didukung. Harap upload file Excel (.xlsx atau .xls).');
      return;
    }

    // 2. Validasi ukuran (< 10 MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMessage(`Ukuran file (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 10 MB.`);
      return;
    }

    // Trigger success animation & light confetti
    setIsSuccessAnim(true);
    triggerLightConfetti();

    setTimeout(() => {
      onFileSelected(file);
      setIsSuccessAnim(false);
    }, 450);
  };

  const triggerLightConfetti = () => {
    try {
      confetti({
        particleCount: 12,
        spread: 45,
        origin: { y: 0.6 },
        colors: ['#E30613', '#16A34A', '#3B82F6', '#F59E0B'],
        disableForReducedMotion: true,
      });
    } catch {
      // ignore
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center size-6 rounded-full bg-[#E30613] text-white text-xs font-bold shadow-sm">
          1
        </span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Upload Tarikan Data JMS</h2>
      </div>

      <motion.div
        animate={{
          scale: isSuccessAnim ? 0.98 : dragOver ? 1.005 : 1,
          borderColor: isSuccessAnim ? '#16A34A' : dragOver ? '#E30613' : '#E5E7EB',
          backgroundColor: isSuccessAnim ? '#F0FDF4' : dragOver ? '#FEF2F2' : '#FFFFFF',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-[18px] border-2 border-dashed p-10 md:p-12 text-center transition-shadow shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)] cursor-pointer group select-none ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <AnimatePresence mode="wait">
          {isSuccessAnim ? (
            <motion.div
              key="success-icon"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 ring-8 ring-emerald-50"
            >
              <CheckCircle2 className="size-9" />
            </motion.div>
          ) : (
            <motion.div
              key="upload-icon"
              initial={{ scale: 0.9 }}
              animate={{ scale: dragOver ? 1.1 : 1 }}
              className="size-16 rounded-full bg-red-50 text-[#E30613] flex items-center justify-center mb-4 ring-8 ring-red-50/50 group-hover:bg-red-100 transition-colors"
            >
              <UploadCloud className="size-8 stroke-[2.2]" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1.5 max-w-md">
          <p className="text-base font-semibold text-slate-800">Drag & drop file Excel di sini</p>
          <p className="text-xs text-slate-500">atau klik untuk memilih file dari komputer</p>
        </div>

        <Button
          type="button"
          disabled={disabled}
          className="mt-4 bg-[#E30613] hover:bg-[#C60010] text-white font-semibold text-sm px-6 h-10 rounded-xl shadow-sm transition-all group-hover:scale-105 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) inputRef.current?.click();
          }}
        >
          Pilih File Excel
        </Button>

        <p className="text-[12px] text-slate-400 mt-4">
          Format: <strong className="text-slate-600 font-medium">.xlsx, .xls</strong> &bull; Maksimal{' '}
          <strong className="text-slate-600 font-medium">10 MB</strong> &bull; Tujuan{' '}
          <strong className="text-slate-700 font-semibold">{activeTargetCity}</strong>
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={disabled}
          onChange={handleFileChange}
        />
      </motion.div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}
    </div>
  );
}
