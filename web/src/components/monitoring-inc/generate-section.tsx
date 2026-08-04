'use client';

import { useState } from 'react';
import { Zap, CheckCircle2, Loader2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessingStep, DEFAULT_PROCESSING_STEPS } from './types';

interface GenerateSectionProps {
  hasFile: boolean;
  disabled?: boolean;
  onGenerate: () => Promise<void>;
}

export function GenerateSection({
  hasFile,
  disabled,
  onGenerate,
}: GenerateSectionProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessingStep[]>(
    DEFAULT_PROCESSING_STEPS.map((s) => ({ ...s, status: 'idle' }))
  );
  const [progressPercent, setProgressPercent] = useState(0);

  const handleStartGenerate = async () => {
    if (!hasFile || isProcessing || disabled) return;

    setIsProcessing(true);
    setProgressPercent(10);

    try {
      // Step-by-step visual progression
      for (let i = 0; i < steps.length; i++) {
        setSteps((prev) =>
          prev.map((step, idx) => {
            if (idx < i) return { ...step, status: 'done' };
            if (idx === i) return { ...step, status: 'running' };
            return { ...step, status: 'idle' };
          })
        );
        setProgressPercent(Math.round(((i + 1) / steps.length) * 90));
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      await onGenerate();

      setSteps((prev) => prev.map((step) => ({ ...step, status: 'done' })));
      setProgressPercent(100);

      toast.success('Monitoring INC berhasil di-generate!');
    } catch (err) {
      console.error('Error generating monitoring:', err);
      toast.error('Gagal men-generate monitoring.');
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
      setSteps(DEFAULT_PROCESSING_STEPS.map((s) => ({ ...s, status: 'idle' })));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-[230px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5 rounded-[6px] bg-[#E2231A] text-white text-[11px] font-bold shadow-xs">
            3
          </span>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            Generate Monitoring
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Proses Otomatis
        </span>
      </div>

      {/* Body: Checklist Steps */}
      <div className="bg-slate-50/70 border border-[#E5E7EB] rounded-lg p-2.5 my-1 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {steps.map((step) => {
            const isDone = step.status === 'done';
            const isRunning = step.status === 'running';

            return (
              <div
                key={step.id}
                className={`flex items-center gap-1.5 text-xs transition-all duration-150 ${
                  isDone
                    ? 'text-emerald-700 font-medium'
                    : isRunning
                    ? 'text-[#E2231A] font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                ) : isRunning ? (
                  <Loader2 className="size-3.5 text-[#E2231A] animate-spin shrink-0" />
                ) : (
                  <Circle className="size-3 text-slate-300 shrink-0" />
                )}
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Small Progress Bar during generating */}
        {isProcessing && (
          <div className="mt-2 w-full bg-slate-200 rounded-full h-1 overflow-hidden">
            <div
              className="bg-[#E2231A] h-full transition-all duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Footer / CTA Button */}
      <div className="pt-1">
        <button
          type="button"
          disabled={!hasFile || isProcessing || disabled}
          onClick={handleStartGenerate}
          className={`w-full py-2 px-3 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all duration-150 ${
            !hasFile || disabled
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-[#E5E7EB]'
              : isProcessing
              ? 'bg-[#E2231A] text-white opacity-90 cursor-wait'
              : 'bg-[#E2231A] hover:bg-[#C91C15] active:scale-98 text-white cursor-pointer hover:shadow-sm'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Zap className="size-3.5 fill-current" />
              <span>Generate Monitoring</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
