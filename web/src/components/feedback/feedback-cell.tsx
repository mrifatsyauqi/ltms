'use client';

import { useEffect, useRef, useState } from 'react';
import type { LongTailRow } from '@/lib/apps-script/longtail';

type Props = {
  row: LongTailRow;
  optionsListId: string;
  saving: boolean;
  onCommit: (waybill: string, feedback: string, baseVersion: string | undefined) => void;
  registerRef: (waybill: string, el: HTMLInputElement | null) => void;
  onEnterNext: (waybill: string) => void;
};

export function FeedbackCell({ row, optionsListId, saving, onCommit, registerRef, onEnterNext }: Props) {
  const waybill = row['No. Waybill'];
  const serverValue = String(row.Feedback ?? '');
  const [value, setValue] = useState(serverValue);
  const dirtyRef = useRef(false);

  // Sinkronkan bila nilai server berubah (mis. setelah refresh optimistic-lock)
  // dan user tidak sedang mengetik perubahan yang belum disimpan.
  useEffect(() => {
    if (!dirtyRef.current) setValue(serverValue);
  }, [serverValue]);

  if (row.__isClearTTD) {
    return <span className="text-muted-foreground text-xs">{serverValue || '—'} (beku)</span>;
  }

  function commit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === serverValue) {
      dirtyRef.current = false;
      setValue(serverValue);
      return;
    }
    dirtyRef.current = false;
    onCommit(waybill, trimmed, row.__version);
  }

  return (
    <input
      ref={(el) => registerRef(waybill, el)}
      list={optionsListId}
      value={value}
      disabled={saving}
      placeholder="Isi feedback…"
      className="h-8 w-full min-w-40 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      onChange={(e) => {
        dirtyRef.current = true;
        setValue(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          onEnterNext(waybill);
        } else if (e.key === 'Escape') {
          dirtyRef.current = false;
          setValue(serverValue);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
