'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, RefreshCw, ShieldOff } from 'lucide-react';
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

type ShareLinkStats = {
  token: string;
  dibuatOleh: string;
  createdAt: string;
  totalDashboard: number;
  totalDataLongtail: number;
  akses7HariTerakhir: number;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

function formatTanggal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
}

function shareUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/public/${token}/dashboard`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Link disalin'),
    () => toast.error('Gagal menyalin - salin manual dari kolom di atas'),
  );
}

export function PublicShareLinkCard() {
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<'regenerate' | 'revoke' | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-share-links'],
    queryFn: () => api<ShareLinkStats | null>('/api/public-share-links'),
  });

  const createMut = useMutation({
    mutationFn: () => api<{ token: string }>('/api/public-share-links', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Link Laporan dibuat.');
      qc.invalidateQueries({ queryKey: ['public-share-links'] });
    },
    onError: (e: Error) => toast.error(`Gagal membuat link: ${e.message}`),
  });

  const regenerateMut = useMutation({
    mutationFn: () => api<{ token: string }>('/api/public-share-links/regenerate', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Link lama dicabut, link baru dibuat. Bagikan link yang baru.');
      setConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['public-share-links'] });
    },
    onError: (e: Error) => toast.error(`Gagal regenerate: ${e.message}`),
  });

  const revokeMut = useMutation({
    mutationFn: () => api<null>('/api/public-share-links/revoke', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Link Laporan dicabut. Fitur nonaktif sampai dibuat ulang.');
      setConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['public-share-links'] });
    },
    onError: (e: Error) => toast.error(`Gagal mencabut: ${e.message}`),
  });

  const busy = createMut.isPending || regenerateMut.isPending || revokeMut.isPending;

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-1.5">
          <Link2 className="size-4" aria-hidden /> Link Laporan
        </span>
      }
      description="Link permanen tanpa login untuk dibagikan ke manager lewat chat - akses Dashboard & Data Long Tail read-only, terbatas hanya ke 2 halaman itu. Aktif sampai dicabut manual."
    >
      {isLoading ? (
        <div className="bg-muted h-10 w-full max-w-sm animate-pulse rounded" />
      ) : error ? (
        <p className="text-destructive text-xs">{(error as Error).message}</p>
      ) : !data ? (
        <div>
          <p className="text-muted-foreground mb-2 text-xs">Belum ada Link Laporan yang aktif.</p>
          <Button onClick={() => createMut.mutate()} disabled={busy}>
            <Link2 className="size-4" aria-hidden />
            {createMut.isPending ? 'Membuat…' : 'Buat Link Laporan'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="border-input bg-muted flex-1 truncate rounded-md border px-2.5 py-1.5 text-xs">
              {shareUrl(data.token)}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(shareUrl(data.token))}>
              <Copy className="size-3.5" aria-hidden /> Salin
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Dibuat {formatTanggal(data.createdAt)} oleh {data.dibuatOleh}. Berisi tab &ldquo;Dashboard&rdquo; dan
            &ldquo;Data Long Tail&rdquo;.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border-border rounded-lg border p-2">
              <div className="text-lg font-semibold tabular-nums">{data.totalDashboard.toLocaleString('id-ID')}</div>
              <div className="text-muted-foreground text-[10px]">Akses Dashboard</div>
            </div>
            <div className="border-border rounded-lg border p-2">
              <div className="text-lg font-semibold tabular-nums">{data.totalDataLongtail.toLocaleString('id-ID')}</div>
              <div className="text-muted-foreground text-[10px]">Akses Data Long Tail</div>
            </div>
            <div className="border-border rounded-lg border p-2">
              <div className="text-lg font-semibold tabular-nums">{data.akses7HariTerakhir.toLocaleString('id-ID')}</div>
              <div className="text-muted-foreground text-[10px]">Akses 7 Hari Terakhir</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction('regenerate')} disabled={busy}>
              <RefreshCw className="size-3.5" aria-hidden /> Regenerate Link
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmAction('revoke')} disabled={busy}>
              <ShieldOff className="size-3.5" aria-hidden /> Cabut Total
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmAction !== null} onOpenChange={(o) => !busy && !o && setConfirmAction(null)}>
        <DialogContent className="max-w-md">
          {confirmAction === 'regenerate' ? (
            <>
              <DialogHeader>
                <DialogTitle>Regenerate Link Laporan?</DialogTitle>
                <DialogDescription>
                  Link yang sedang aktif akan <strong>langsung berhenti berfungsi</strong> dan diganti dengan link baru.
                  Gunakan ini kalau link lama bocor/tersebar ke pihak yang tidak dimaksud. Siapa pun yang masih memegang
                  link lama tidak akan bisa mengaksesnya lagi.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={busy}>
                  Batal
                </Button>
                <Button onClick={() => regenerateMut.mutate()} disabled={busy}>
                  {regenerateMut.isPending ? 'Memproses…' : 'Ya, regenerate'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Cabut Link Laporan total?</DialogTitle>
                <DialogDescription>
                  Link yang aktif akan <strong>berhenti berfungsi</strong> dan TIDAK ada link baru dibuat. Fitur Link
                  Laporan nonaktif sampai Anda membuat link baru secara manual.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={busy}>
                  Batal
                </Button>
                <Button variant="destructive" onClick={() => revokeMut.mutate()} disabled={busy}>
                  {revokeMut.isPending ? 'Memproses…' : 'Ya, cabut total'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
