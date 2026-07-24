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
import type { MasterFeedbackRow } from '@/lib/apps-script/master-feedback';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

type FormState = { id: number | string; namaFeedback: string; statusAktif: boolean };
const EMPTY: FormState = { id: '', namaFeedback: '', statusAktif: true };

export function MasterFeedbackClient() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['master-feedback'],
    queryFn: () => api<MasterFeedbackRow[]>('/api/master-feedback'),
  });

  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MasterFeedbackRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<MasterFeedbackRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data ?? [];
    return needle ? all.filter((r) => String(r['Nama Feedback']).toLowerCase().includes(needle)) : all;
  }, [data, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['master-feedback'] });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      api('/api/master-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaFeedback: f.namaFeedback.trim() }),
      }),
    onSuccess: () => {
      toast.success('Master Feedback ditambahkan.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal menambah: ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: (f: FormState) =>
      api(`/api/master-feedback/${encodeURIComponent(String(f.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaFeedback: f.namaFeedback.trim(), statusAktif: f.statusAktif }),
      }),
    onSuccess: () => {
      toast.success('Master Feedback diperbarui.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal memperbarui: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number | string) =>
      api(`/api/master-feedback/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Master Feedback dihapus.');
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
  function openEdit(r: MasterFeedbackRow) {
    setEditing(r);
    setForm({ id: r.ID, namaFeedback: r['Nama Feedback'], statusAktif: isAktif(r['Status Aktif']) });
    setDialogOpen(true);
  }
  function submit() {
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <PageHeader
        title="Master Feedback"
        description="Daftar opsi feedback baku yang muncul di dropdown Admin DP."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden /> Tambah Feedback
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <div className="relative w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            placeholder="Cari feedback…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageIndex(0);
            }}
            className="h-8 pl-7 text-xs"
          />
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
            <p className="text-destructive font-medium">Gagal memuat Master Feedback</p>
            <p className="text-muted-foreground mt-0.5">{(error as Error).message}</p>
          </div>
        )}

        {data && (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="h-8 w-16 border-b px-3 text-left font-medium">ID</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Nama Feedback</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Status</th>
                    <th className="h-8 w-24 border-b px-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.ID} className="border-b last:border-0">
                      <td className="px-3 py-1.5 tabular-nums">{r.ID}</td>
                      <td className="px-3 py-1.5">{r['Nama Feedback']}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge aktif={isAktif(r['Status Aktif'])} />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            aria-label={`Edit ${r['Nama Feedback']}`}
                            className="hover:bg-muted rounded-md p-1.5 transition-colors"
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            aria-label={`Hapus ${r['Nama Feedback']}`}
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
                      <td colSpan={4} className="text-muted-foreground py-10 text-center">
                        {q ? 'Tidak ada feedback yang cocok.' : 'Belum ada Master Feedback. Klik “Tambah Feedback”.'}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Feedback' : 'Tambah Feedback'}</DialogTitle>
            <DialogDescription>Teks feedback baku, mis. “PENERIMA TIDAK DI TEMPAT”.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="namaFeedback">Nama Feedback</Label>
              <Input
                id="namaFeedback"
                value={form.namaFeedback}
                onChange={(e) => setForm({ ...form, namaFeedback: e.target.value })}
                autoFocus
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.statusAktif}
                  onChange={(e) => setForm({ ...form, statusAktif: e.target.checked })}
                />
                Aktif (muncul di dropdown)
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={submit} disabled={!form.namaFeedback.trim() || saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus feedback?</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.['Nama Feedback']}” akan dihapus dari daftar baku. Feedback yang sudah tercatat pada
              waybill tidak terpengaruh. Jika ragu, nonaktifkan saja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleteMut.isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.ID)}
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
