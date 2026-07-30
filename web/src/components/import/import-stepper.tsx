'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WizardStep = 1 | 2 | 3;

const STEPS: { step: WizardStep; title: string; desc: string }[] = [
  { step: 1, title: 'Upload File', desc: 'Pilih file Excel' },
  { step: 2, title: 'Preview Data', desc: 'Cek ringkasan data' },
  { step: 3, title: 'Import Data', desc: 'Proses import' },
];

/**
 * Header stepper 3-langkah. `maxReached` = step terjauh yang sudah valid
 * dicapai — HANYA dipakai untuk menentukan step mana yang boleh diklik
 * (user boleh klik mundur/maju ke step manapun <= maxReached). Ceklis
 * "selesai" TIDAK mengikuti maxReached — itu murni step < current, supaya
 * step berikutnya tidak langsung tampak "selesai" hanya karena datanya
 * sudah siap sebelum benar-benar dikunjungi.
 */
export function ImportStepper({
  current,
  maxReached,
  onJump,
}: {
  current: WizardStep;
  maxReached: WizardStep;
  onJump: (step: WizardStep) => void;
}) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = s.step < current;
        const active = s.step === current;
        const clickable = s.step <= maxReached && s.step !== current;
        return (
          <div key={s.step} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(s.step)}
              className={cn(
                'flex items-center gap-2.5 text-left',
                clickable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  active && 'bg-primary text-primary-foreground',
                  !active && done && 'bg-primary text-primary-foreground',
                  !active && !done && 'bg-muted text-muted-foreground',
                )}
              >
                {done && !active ? <Check className="size-4" aria-hidden /> : s.step}
              </span>
              <span className="hidden sm:block">
                <span className={cn('block text-sm font-semibold', !active && !done && 'text-muted-foreground')}>
                  {s.title}
                </span>
                <span className="text-muted-foreground block text-xs">{s.desc}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={cn('mx-3 h-0.5 flex-1 rounded-full', s.step < current ? 'bg-primary' : 'bg-muted')}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
