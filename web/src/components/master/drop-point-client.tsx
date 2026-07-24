'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge, isAktif } from '@/components/master/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TablePager } from '@/components/ui/table-pager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DropPointRow } from '@/lib/apps-script/drop-points';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

type FormState = { kodeDp: string; namaDp: string; wilayah: string; statusAktif: boolean };
const EMPTY: FormState = { kodeDp: '', namaDp: '', wilayah: '', statusAktif: true };

export function DropPointClient() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['drop-points'],
    queryFn: () => api<DropPointRow[]>('/api/drop-points'),
  });

  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DropPointRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<DropPointRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data ?? [];
    if (!needle) return all;
    return all.filter(
      (r) =>
        String(r['Kode DP']).toLowerCase().includes(needle) ||
        String(r['Nama DP']).toLowerCase().includes(needle) ||
        String(r['Wilayah/Cabang']).toLowerCase().includes(needle),
    );
  }, [data, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['drop-points'] });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      api('/api/drop-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kodeDp: f.kodeDp.trim(), namaDp: f.namaDp.trim(), wilayah: f.wilayah.trim() }),
      }),
    onSuccess: () => {
      toast.success('Drop Point ditambahkan.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal menambah: ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: (f: FormState) =>
      api(`/api/drop-points/${encodeURIComponent(f.kodeDp)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaDp: f.namaDp.trim(), wilayah: f.wilayah.trim(), statusAktif: f.statusAktif }),
      }),
    onSuccess: () => {
      toast.success('Drop Point diperbarui.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal memperbarui: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (kodeDp: string) =>
      api(`/api/drop-points/${encodeURIComponent(kodeDp)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Drop Point dihapus.');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal menghapus: ${e.message}`),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }
  function openEdit(r: DropPointRow) {
    setEditing(r);
    setForm({
      kodeDp: r['Kode DP'],
      namaDp: r['Nama DP'],
      wilayah: r['Wilayah/Cabang'],
      statusAktif: isAktif(r['Status Aktif']),
    });
    setDialogOpen(true);
  }
  function submit() {
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const canSave = editing ? form.namaDp.trim() : form.kodeDp.trim() && form.namaDp.trim();

  return (
    <>
      <PageHeader
        title="Master Drop Point"
        description="Kelola kode, nama, wilayah, dan status aktif Drop Point."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden /> Tambah Drop Point
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
            <Input
              placeholder="Cari kode / nama / wilayah…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPageIndex(0);
              }}
              className="h-8 w-64 pl-7 text-xs"
            />
          </div>
        </div>

        {isLoading && (
          <div className="space-y-1.5" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted h-9 animate-pulse rounded" />
            ))}
          </div>
        )}
        {error && (
          <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-xs">
            <p className="text-destructive font-medium">Gagal memuat Drop Point</p>
            <p className="text-muted-foreground mt-0.5">{(error as Error).message}</p>
          </div>
        )}

        {data && (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="h-8 border-b px-3 text-left font-medium">Kode DP</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Nama DP</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Wilayah/Cabang</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Status</th>
                    <th className="h-8 w-24 border-b px-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r['Kode DP']} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono">{r['Kode DP']}</td>
                      <td className="px-3 py-1.5">{r['Nama DP']}</td>
                      <td className="px-3 py-1.5">{r['Wilayah/Cabang'] || '—'}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge aktif={isAktif(r['Status Aktif'])} />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            aria-label={`Edit ${r['Kode DP']}`}
                            className="hover:bg-muted rounded-md p-1.5 transition-colors"
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            aria-label={`Hapus ${r['Kode DP']}`}
                            className="text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-10 text-center">
                        {q ? 'Tidak ada Drop Point yang cocok.' : 'Belum ada Drop Point. Klik “Tambah Drop Point”.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePager
              pageIndex={pageIndex}
              pageCount={pageCount}
              onGoto={(i) => setPageIndex(Math.max(0, Math.min(i, pageCount - 1)))}
              canPrev={pageIndex > 0}
              canNext={pageIndex < pageCount - 1}
              totalRows={rows.length}
              pageSize={pageSize}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPageIndex(0);
              }}
            />
          </>
        )}
      </div>

      {/* Form tambah/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Drop Point' : 'Tambah Drop Point'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Kode DP tidak bisa diubah (jadi acuan pencocokan data Long Tail).'
                : 'Kode DP harus sama persis dengan nilai “DP Sampai” di data JMS.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kodeDp">Kode DP</Label>
              <Input
                id="kodeDp"
                value={form.kodeDp}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, kodeDp: e.target.value })}
                placeholder="mis. BATANG01"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="namaDp">Nama DP</Label>
              <Input id="namaDp" value={form.namaDp} onChange={(e) => setForm({ ...form, namaDp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wilayah">Wilayah/Cabang</Label>
              <Input id="wilayah" value={form.wilayah} onChange={(e) => setForm({ ...form, wilayah: e.target.value })} />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.statusAktif}
                  onChange={(e) => setForm({ ...form, statusAktif: e.target.checked })}
                />
                Aktif
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={submit} disabled={!canSave || saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Drop Point?</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{confirmDelete?.['Kode DP']}</span> — {confirmDelete?.['Nama DP']}. Tindakan
              ini tidak bisa dibatalkan. Jika DP masih dipakai user Admin DP, sebaiknya nonaktifkan saja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleteMut.isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete['Kode DP'])}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
