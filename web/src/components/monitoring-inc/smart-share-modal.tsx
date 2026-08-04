'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Download,
  Share2,
  X,
  Copy,
  Loader2,
  Sparkles,
  FileImage,
  MessageSquareCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export type SmartShareStage =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'rendering'
  | 'captioning'
  | 'copying'
  | 'success'
  | 'error';

interface SmartShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: SmartShareStage;
  progress: number;
  imageUrl: string | null;
  captionText: string;
  onDownload: () => void;
}

const STAGE_LABELS: Record<SmartShareStage, { title: string; subtitle: string }> = {
  idle: { title: 'Mempersiapkan...', subtitle: 'Memulai proses Smart Share' },
  preparing: { title: 'Menyiapkan Data...', subtitle: 'Mengekstrak data ringkasan dan SLA' },
  generating: { title: 'Membuat Laporan...', subtitle: 'Menghitung statistik target kota dan kecamatan' },
  rendering: { title: 'Merender Gambar 1200×900...', subtitle: 'Membuat visual report beresolusi tinggi' },
  captioning: { title: 'Menyusun Caption...', subtitle: 'Memformat teks WhatsApp & Feishu tanpa tautan' },
  copying: { title: 'Menyalin ke Clipboard...', subtitle: 'Menempatkan caption otomatis ke papan klip' },
  success: { title: 'Smart Share Selesai!', subtitle: 'Report siap dibagikan' },
  error: { title: 'Terjadi Kesalahan', subtitle: 'Gagal memproses Smart Share' },
};

export function SmartShareModal({
  isOpen,
  onClose,
  stage,
  progress,
  imageUrl,
  captionText,
  onDownload,
}: SmartShareModalProps) {
  if (!isOpen) return null;

  const isProcessing = stage !== 'success' && stage !== 'error';

  const handleManualCopy = async () => {
    if (!captionText) return;
    try {
      await navigator.clipboard.writeText(captionText);
      toast.success('✔ Caption berhasil disalin ke clipboard');
    } catch {
      toast.error('Gagal menyalin caption');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isProcessing ? undefined : onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-[10px] border border-slate-200 bg-white p-6 shadow-2xl"
        >
          {/* Close button (only when finished) */}
          {!isProcessing && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 rounded-[6px] p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}

          {isProcessing ? (
            /* Progress State Machine */
            <div className="py-4 text-center space-y-5">
              <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 text-[#E2231A] ring-8 ring-red-50/50">
                <Loader2 className="size-8 animate-spin" />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-slate-900 p-1 text-white shadow-xs">
                  <Sparkles className="size-3" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {STAGE_LABELS[stage]?.title || 'Memproses Smart Share...'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {STAGE_LABELS[stage]?.subtitle}
                </p>
              </div>

              {/* Animated Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#E2231A] rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Smart Share Pipeline</span>
                  <span className="font-bold text-slate-700">{progress}%</span>
                </div>
              </div>

              {/* Process Checklist */}
              <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-2 rounded-full ${
                      progress >= 25 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                    }`}
                  />
                  <span>Format Caption</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-2 rounded-full ${
                      progress >= 60 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                    }`}
                  />
                  <span>Render Canvas HD</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-2 rounded-full ${
                      progress >= 85 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                    }`}
                  />
                  <span>Salin ke Clipboard</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-2 rounded-full ${
                      progress >= 100 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                    }`}
                  />
                  <span>Siapkan Preview</span>
                </div>
              </div>
            </div>
          ) : (
            /* Success State */
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex size-10 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Smart Share Berhasil Dibuat
                  </h3>
                  <p className="text-xs text-slate-500">
                    Laporan gambar dan teks caption siap dibagikan ke tim.
                  </p>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <FileImage className="size-3.5 text-emerald-600" />
                  Report Gambar Siap
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <MessageSquareCheck className="size-3.5 text-emerald-600" />
                  Caption Disalin ke Clipboard
                </span>
              </div>

              {/* Image Preview Thumbnail */}
              {imageUrl && (
                <div className="relative rounded-[8px] border border-slate-200 overflow-hidden bg-slate-900 shadow-inner group max-h-[190px] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Monitoring Report Preview"
                    className="max-h-[190px] w-auto object-contain transition-transform group-hover:scale-102 duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none flex items-end p-2.5">
                    <span className="text-[11px] font-mono text-white/90">
                      Resolusi 1200×900 • PNG High Quality
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleManualCopy}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <Copy className="size-3.5 text-slate-500" />
                  Salin Ulang Caption
                </button>

                <button
                  type="button"
                  onClick={onDownload}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#E2231A] hover:bg-[#C91C15] active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Download className="size-3.5" />
                  Download PNG
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
