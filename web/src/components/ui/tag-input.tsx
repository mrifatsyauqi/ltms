'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

type TagInputProps = {
  id?: string;
  value: string[];
  onAdd: (raw: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  error?: string | null;
};

/** Input tag sederhana: ketik satu nilai, Enter/tombol "Tambah" utk
 *  menambahkan, klik X pada chip utk menghapus. Validasi (duplikat, konflik
 *  lintas-entitas, dsb) jadi tanggung jawab `onAdd` (caller) - komponen ini
 *  cuma UI, tidak tahu soal aturan bisnis. */
export function TagInput({ id, value, onAdd, onRemove, placeholder, error }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit() {
    const raw = draft.trim();
    if (!raw) return;
    onAdd(raw);
    setDraft('');
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="border-input hover:bg-muted h-8 shrink-0 rounded-md border px-3 text-xs disabled:opacity-40"
        >
          Tambah
        </button>
      </div>
      {error && <p className="text-destructive text-[11px]">{error}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                aria-label={`Hapus ${tag}`}
                className="hover:text-destructive"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
