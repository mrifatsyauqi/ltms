'use client';

import { useState } from 'react';
import { Zap, CheckCircle2, Loader2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessingStep, DEFAULT_PROCESSING_STEPS } from './types';

interface GenerateSectionProps {
  hasFile: boolean;
  onStartGenerate: () => Promise<void>;
  disabled?: boolean;
}

export function GenerateSection({
  hasFile,
  onStartGenerate,
  disabled,
}: GenerateSectionProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [steps, setSteps] = useState<ProcessingStep[]>(
    DEFAULT_PROCESSING_STEPS.map((s) => ({ ...s, status: 'idle' }))
  );

  const handleGenerate = async () => {
    if (!hasFile || isProcessing) return;

    setIsProcessing(true);
    setIsSuccess(false);

    // Jalankan animasi step berurutan
    for (let i = 0; i < DEFAULT_PROCESSING_STEPS.length; i++) {
      setSteps((prev) =>
        prev.map((step, idx) => ({
          ...step,
          status: idx === i ? 'running' : idx < i ? 'done' : 'idle',
        }))
      );
      await new Promise((r) => setTimeout(r, 400));
    }

    // Tandai semua selesai
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
    await onStartGenerate();

    setIsSuccess(true);
    setIsProcessing(false);
    toast.success('Monitoring INC berhasil digenerate!', {
      position: 'bottom-right',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
      {/* Top Row: Title, Subtitle, and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
              3
            </span>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Generate Monitoring
            </h3>
          </div>
          <p className="text-xs text-slate-500 pl-7">
            Sistem memfilter kota penerima, memetakan kecamatan, dan menghitung batas SLA maksimal 24 jam.
          </p>
        </div>

        <div className="shrink-0">
          <button
            type="button"
            disabled={!hasFile || isProcessing || disabled}
            onClick={handleGenerate}
            className={`h-9 px-4 rounded-md font-semibold text-xs tracking-wide shadow-xs transition-all flex items-center justify-center gap-2 ${
              isSuccess
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : !hasFile || isProcessing || disabled
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                : 'bg-red-600 hover:bg-red-700 text-white active:scale-98 shadow-sm shadow-red-500/10'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-white" />
                <span>Memproses Data...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="size-3.5 text-white" />
                <span>Monitoring Dihasilkan</span>
              </>
            ) : (
              <>
                <Zap className="size-3.5 fill-white" />
                <span>Generate Monitoring</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sequential Processing Chips Bar */}
      {(isProcessing || isSuccess) && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-200">
          {steps.map((step) => {
            const isDone = step.status === 'done';
            const isRunning = step.status === 'running';

            return (
              <div
                key={step.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isDone
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : isRunning
                    ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse font-semibold'
                    : 'bg-slate-50 text-slate-400 border border-slate-200/60'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3 text-emerald-600" />
                ) : isRunning ? (
                  <Loader2 className="size-3 text-red-600 animate-spin" />
                ) : (
                  <Circle className="size-2.5 text-slate-300" />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
