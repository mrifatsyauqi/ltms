'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2, Loader2, Circle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ProgressStepItem {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed';
}

interface GenerateSectionProps {
  hasValidFile: boolean;
  isGenerating: boolean;
  isSuccess: boolean;
  steps: ProgressStepItem[];
  onGenerate: () => void;
  onViewResults: () => void;
}

export function GenerateSection({
  hasValidFile,
  isGenerating,
  isSuccess,
  steps,
  onGenerate,
  onViewResults,
}: GenerateSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center size-6 rounded-full bg-[#E30613] text-white text-xs font-bold shadow-sm">
          3
        </span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Generate Monitoring</h2>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-[18px] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Proses Tarikan Data JMS</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              Sistem akan memfilter kota, memetakan kecamatan sebagai Tempat Tujuan, dan menghitung SLA batas maksimal 24 jam.
            </p>
          </div>

          <div className="shrink-0">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success-btn"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <Button
                    type="button"
                    onClick={onViewResults}
                    className="h-12 px-6 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-[15px] shadow-md shadow-emerald-600/20 gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <CheckCircle2 className="size-5" />
                    Lihat Hasil Monitoring
                    <ArrowRight className="size-4 ml-1" />
                  </Button>
                </motion.div>
              ) : isGenerating ? (
                <motion.div
                  key="generating-btn"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Button
                    type="button"
                    disabled
                    className="h-12 px-8 rounded-full bg-slate-800 text-white font-semibold text-[15px] shadow-md gap-2 cursor-wait"
                  >
                    <Loader2 className="size-5 animate-spin text-red-500" />
                    Memproses Data...
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="ready-btn"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={hasValidFile ? { scale: 0.97 } : undefined}
                >
                  <Button
                    type="button"
                    disabled={!hasValidFile}
                    onClick={onGenerate}
                    className={`h-12 px-8 rounded-full font-semibold text-[15px] shadow-md transition-all ${
                      hasValidFile
                        ? 'bg-[#E30613] hover:bg-[#C60010] text-white shadow-red-600/20 hover:scale-105 active:scale-95'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <Zap className="size-4 fill-current mr-1" />
                    Generate Monitoring
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Step Progress Animation when generating or completed */}
        <AnimatePresence>
          {(isGenerating || isSuccess) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-slate-100 pt-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {steps.map((step, idx) => {
                  const isDone = step.status === 'completed';
                  const isLoading = step.status === 'loading';

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs transition-all ${
                        isDone
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 font-semibold'
                          : isLoading
                          ? 'bg-red-50/70 border-red-200 text-red-800 font-semibold animate-pulse'
                          : 'bg-slate-50 border-slate-100 text-slate-400 font-medium'
                      }`}
                    >
                      {isDone ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        >
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        </motion.div>
                      ) : isLoading ? (
                        <Loader2 className="size-4 animate-spin text-[#E30613] shrink-0" />
                      ) : (
                        <Circle className="size-4 text-slate-300 shrink-0 stroke-[1.5]" />
                      )}
                      <span className="truncate">{step.label}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
