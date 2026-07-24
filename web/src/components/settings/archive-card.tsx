'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ArchivePreview, ArchiveResult } from '@/lib/apps-script/archive';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

export function ArchiveCard() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['archive-preview'],
    queryFn: () => api<ArchivePreview>('/api/archive'),
  });

  const runMut = useMutation({
    mutationFn: () => api<ArchiveResult>('/api/archive', { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(
        res.archived > 0
          ? `${res.archived} paket dipindah ke arsip.`
          : 'Tidak ada paket yang memenuhi syarat arsip.',
      );
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ['archive-preview'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['longtail'] });
    },
    onError: (e: Error) => toast.error(`Gagal mengarsip: ${e.message}`),
  });

  const eligible = data?.eligible ?? 0;

  return (
    <SectionCard
      title="Arsip Data Long Tail"
      description="Pindahkan paket Clear TTD yang sudah lebih dari 30 hari ke arsip agar sheet utama tetap ringan (PRD Bagian 8)."
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
            <div className="text-2xl font-bold tabular-nums">{eligible.toLocaleString('id-ID')}</div>
            <div className="text-muted-foreground text-xs">paket Clear TTD &gt; 30 hari, siap diarsipkan</div>
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={eligible === 0 || runMut.isPending}>
            <Archive className="size-4" aria-hidden /> Arsipkan sekarang
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Arsipkan {eligible} paket?</DialogTitle>
            <DialogDescription>
              Paket akan dipindah dari LongTail ke LongTail_Archive dan tidak lagi muncul di Dashboard/Feedback.
              Data tetap tersimpan di arsip. Tindakan ini tidak otomatis bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={runMut.isPending}>
              Batal
            </Button>
            <Button onClick={() => runMut.mutate()} disabled={runMut.isPending}>
              {runMut.isPending ? 'Mengarsip…' : 'Ya, arsipkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
