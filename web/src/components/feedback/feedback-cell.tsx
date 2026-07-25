'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { LongTailRow } from '@/lib/apps-script/longtail';

type Props = {
  row: LongTailRow;
  /** Daftar rekomendasi feedback (favorit + master aktif), sudah terurut. */
  options: string[];
  saving: boolean;
  onCommit: (waybill: string, feedback: string, baseVersion: string | undefined) => void;
  registerRef: (waybill: string, el: HTMLInputElement | null) => void;
  onEnterNext: (waybill: string) => void;
};

const MAX_SUGGEST = 8;

export function FeedbackCell({ row, options, saving, onCommit, registerRef, onEnterNext }: Props) {
  const waybill = row['No. Waybill'];
  const serverValue = String(row.Feedback ?? '');
  const [value, setValue] = useState(serverValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dirtyRef = useRef(false);
  const skipBlurRef = useRef(false); // cegah commit ganda saat Enter/pilih -> pindah baris
  const lastSentRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sinkron bila nilai server berubah dan user tidak sedang mengetik.
  useEffect(() => {
    if (!dirtyRef.current) setValue(serverValue);
  }, [serverValue]);

  if (row.__isClearTTD) {
    return <span className="text-muted-foreground text-xs">{serverValue || '—'} (beku)</span>;
  }

  // Rekomendasi: cocok dari huruf pertama (prefix), urut sesuai options.
  const q = value.trim().toLowerCase();
  const suggestions = q
    ? options.filter((o) => o.toLowerCase().startsWith(q) && o.toLowerCase() !== q).slice(0, MAX_SUGGEST)
    : [];

  function openMenu() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setHighlight(0);
    setOpen(true);
  }

  function commit(v?: string) {
    const trimmed = (v ?? value).trim();
    if (!trimmed || trimmed === serverValue || trimmed === lastSentRef.current) {
      dirtyRef.current = false;
      if (v === undefined) setValue(serverValue);
      return;
    }
    dirtyRef.current = false;
    lastSentRef.current = trimmed;
    onCommit(waybill, trimmed, row.__version);
  }

  function selectSuggestion(s: string) {
    dirtyRef.current = false;
    setValue(s);
    setOpen(false);
    skipBlurRef.current = true;
    commit(s);
    // Tunda pindah fokus agar update value ter-flush dulu (fokus sinkron ke
    // input berikut memicu blur yang membatalkan pembaruan value).
    setTimeout(() => onEnterNext(waybill), 0);
  }

  return (
    <>
      <input
        ref={(el) => {
          inputRef.current = el;
          registerRef(waybill, el);
        }}
        value={value}
        disabled={saving}
        placeholder="Isi feedback…"
        autoComplete="off"
        className="border-input focus:ring-ring h-7 w-full min-w-32 rounded-md border bg-transparent px-2 text-xs outline-none focus:ring-2 disabled:opacity-50"
        onChange={(e) => {
          const v = e.target.value;
          dirtyRef.current = true;
          setValue(v);
          const vv = v.trim().toLowerCase();
          if (vv && options.some((o) => o.toLowerCase().startsWith(vv) && o.toLowerCase() !== vv)) {
            openMenu();
          } else {
            setOpen(false);
          }
        }}
        onBlur={() => {
          setOpen(false);
          if (skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (open && suggestions.length) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => (h + 1) % suggestions.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              selectSuggestion(suggestions[highlight] ?? suggestions[0]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              return;
            }
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            skipBlurRef.current = true;
            commit();
            onEnterNext(waybill);
          } else if (e.key === 'Escape') {
            dirtyRef.current = false;
            setValue(serverValue);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {open && suggestions.length > 0 && rect &&
        createPortal(
          <ul
            style={{ position: 'fixed', left: rect.left, top: rect.bottom + 2, width: Math.max(rect.width, 180) }}
            className="border-border bg-card z-[100] max-h-56 overflow-auto rounded-md border py-1 text-xs shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  // onMouseDown + preventDefault: pilih sebelum input blur.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn('block w-full px-2 py-1 text-left', i === highlight ? 'bg-muted' : 'hover:bg-muted')}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
