'use client';

import { useRef, useState } from 'react';
import { CloudUpload, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface UploadCardProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadCard({ onFileSelected, disabled }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  const triggerConfetti = () => {
    const colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
    const newParticles = Array.from({ length: 14 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 160,
      y: (Math.random() - 0.5) * 120 - 40,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  };

  const handleProcessFile = (file: File) => {
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

    triggerConfetti();
    onFileSelected(file);
  };

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-[230px]">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center size-5 rounded-full bg-red-600 text-white text-xs font-bold">
          1
        </span>
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Upload Excel</h3>
      </div>

      {/* Drop Area */}
      <div
        className={`relative overflow-hidden flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-3 text-center transition-all cursor-pointer select-none my-1 flex-1 ${
          isDragOver
            ? 'border-red-500 bg-red-50/50 scale-[0.99]'
            : 'border-slate-200 bg-slate-50/40 hover:border-red-300 hover:bg-slate-50/80'
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
        {/* Floating Confetti Particle Bursts */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute size-2 rounded-full pointer-events-none animate-ping"
            style={{
              backgroundColor: p.color,
              transform: `translate(${p.x}px, ${p.y}px)`,
              opacity: 0.8,
            }}
          />
        ))}

        <div className="size-9 rounded-full bg-rose-100/70 text-red-500 flex items-center justify-center mb-1.5 shadow-sm">
          <CloudUpload className="size-5" />
        </div>

        <p className="text-xs font-semibold text-slate-800 leading-snug">
          Drag & drop file Excel di sini
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          atau klik tombol di bawah untuk memilih file
        </p>

        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm active:scale-95 transition-transform"
        >
          <Upload className="size-3.5" />
          Pilih File Excel
        </button>

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

      {/* Footer Info */}
      <div className="text-center">
        <p className="text-[11px] text-slate-400 font-medium">
          Format: XLSX, XLS • Maksimal 10 MB
        </p>
      </div>
    </div>
  );
}
