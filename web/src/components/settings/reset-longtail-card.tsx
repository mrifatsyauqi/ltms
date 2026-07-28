'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ResetPreview, ResetResult } from '@/lib/data/longtail';

const CONFIRM_WORD = 'RESET';

/** Nama sheet -> label yang mudah dipahami di UI. */
const LABELS: Record<string, string> = {
  LongTail: 'Paket Long Tail',
  LongTail_Archive: 'Arsip paket',
  Activity_Log: 'Log aktivitas feedback',
  'Import Batch': 'Riwayat import',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

export function ResetLongTailCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['reset-preview'],
    queryFn: () => api<ResetPreview>('/api/reset-longtail'),
  });

  // Initialize selected all true
  useEffect(() => {
    if (data?.counts) {
      const init: Record<string, boolean> = {};
      Object.keys(data.counts).forEach((k) => (init[k] = true));
      setSelected(init);
    }
  }, [data?.counts]);

  const runMut = useMutation({
    mutationFn: () => {
      const targets = Object.keys(selected).filter(k => selected[k]);
      return api<ResetResult>('/api/reset-longtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      });
    },
    onSuccess: (res) => {
      const total = Object.values(res.cleared).reduce((a, b) => a + b, 0);
      toast.success(`Reset selesai. ${total.toLocaleString('id-ID')} baris data dihapus.`);
      setOpen(false);
      setTyped('');
      // Segarkan semua data turunan (dashboard, longtail, riwayat, preview reset).
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(`Gagal reset: ${e.message}`),
  });

  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <SectionCard
      className="border-destructive/40"
      title={
        <span className="text-destructive inline-flex items-center gap-1.5">
          <AlertTriangle className="size-4" aria-hidden /> Reset Data Long Tail
        </span>
      }
      description="Menghapus SEMUA data paket & riwayatnya (LongTail, arsip, log aktivitas, riwayat import) agar sistem mulai bersih untuk data asli. Master data (user, drop point, template feedback) tidak terhapus. Tindakan ini permanen."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
          <span className="sr-only sm:not-sr-only">Cek ulang</span>
        </Button>
      }
    >
      {isLoading ? (
        <div className="bg-muted h-10 w-full max-w-sm animate-pulse rounded" />
      ) : error ? (
        <p className="text-destructive text-xs">{(error as Error).message}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-2xl font-bold tabular-nums">{total.toLocaleString('id-ID')}</div>
            <div className="text-muted-foreground text-xs">baris data akan dihapus</div>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              setTyped('');
              setOpen(true);
            }}
            disabled={total === 0 || runMut.isPending}
          >
            <Trash2 className="size-4" aria-hidden /> Reset sekarang
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !runMut.isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset semua data Long Tail?</DialogTitle>
            <DialogDescription>
              Data berikut akan dihapus <strong>permanen</strong> dan tidak bisa dikembalikan:
            </DialogDescription>
          </DialogHeader>

          <ul className="border-border divide-border divide-y rounded-lg border text-sm">
            {Object.entries(counts).map(([sheet, n]) => (
              <li key={sheet} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id={`chk-${sheet}`} 
                    checked={selected[sheet] ?? false} 
                    onCheckedChange={(c) => setSelected((s) => ({ ...s, [sheet]: c === true }))} 
                  />
                  <Label htmlFor={`chk-${sheet}`} className="cursor-pointer">{LABELS[sheet] ?? sheet}</Label>
                </div>
                <span className="tabular-nums font-medium">{n.toLocaleString('id-ID')} baris</span>
              </li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-reset">
              Ketik <span className="text-destructive font-mono font-semibold">{CONFIRM_WORD}</span> untuk konfirmasi
            </Label>
            <Input
              id="confirm-reset"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={CONFIRM_WORD}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={runMut.isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => runMut.mutate()}
              disabled={typed !== CONFIRM_WORD || runMut.isPending || Object.values(selected).filter(Boolean).length === 0}
            >
              {runMut.isPending ? 'Menghapus…' : 'Ya, hapus terpilih'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
