'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { isAktif } from '@/components/master/status-badge';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import type { CabangRow } from '@/lib/data/cabang';
import type { UserRow } from '@/lib/data/users';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

const NONE = ''; // sentinel "belum ditunjuk" - Manager Kota/Asisten Manager opsional

type FormState = { kodeKota: string; namaKota: string; managerKotaUserId: string; asistenManagerUserId: string };
const EMPTY: FormState = { kodeKota: '', namaKota: '', managerKotaUserId: NONE, asistenManagerUserId: NONE };

export function CabangClient() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['cabang'],
    queryFn: () => api<CabangRow[]>('/api/cabang'),
    staleTime: SLOW_STALE_TIME, // jarang berubah (data master)
  });
  // Sumber dropdown Manager Kota/Asisten Manager - label organisasi, bebas
  // role apapun, cukup akun aktif (lihat keputusan desain: bukan role baru).
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/api/users'),
    staleTime: SLOW_STALE_TIME,
  });
  const activeUsers = useMemo(
    () => (users ?? []).filter((u) => isAktif(u['Status Aktif'])).sort((a, b) => a.Nama.localeCompare(b.Nama)),
    [users],
  );

  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CabangRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data ?? [];
    if (!needle) return all;
    return all.filter(
      (r) =>
        String(r['Kode Kota']).toLowerCase().includes(needle) ||
        String(r['Nama Kota']).toLowerCase().includes(needle),
    );
  }, [data, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cabang'] });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      api('/api/cabang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kodeKota: f.kodeKota.trim(),
          namaKota: f.namaKota.trim(),
          managerKotaUserId: f.managerKotaUserId || null,
          asistenManagerUserId: f.asistenManagerUserId || null,
        }),
      }),
    onSuccess: () => {
      toast.success('Cabang ditambahkan.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal menambah: ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: (f: FormState) =>
      api(`/api/cabang/${encodeURIComponent(f.kodeKota)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaKota: f.namaKota.trim(),
          managerKotaUserId: f.managerKotaUserId || null,
          asistenManagerUserId: f.asistenManagerUserId || null,
        }),
      }),
    onSuccess: () => {
      toast.success('Cabang diperbarui.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal memperbarui: ${e.message}`),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }
  function openEdit(r: CabangRow) {
    setEditing(r);
    setForm({
      kodeKota: r['Kode Kota'],
      namaKota: r['Nama Kota'],
      managerKotaUserId: r['Manager Kota'],
      asistenManagerUserId: r['Asisten Manager'],
    });
    setDialogOpen(true);
  }
  function submit() {
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const canSave = editing ? form.namaKota.trim() : form.kodeKota.trim() && form.namaKota.trim();

  // WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
  // trigger menampilkan label yang benar, bukan value mentah.
  const userItems: Record<string, string> = { [NONE]: '— Belum ditunjuk —' };
  for (const u of activeUsers) userItems[u.Id] = `${u.Nama} (${u.Role})`;

  return (
    <>
      <PageHeader
        title="Cabang"
        description="Kelola Kota, Manager Kota, dan Asisten Manager."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden /> Tambah Kota
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <div className="relative w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            placeholder="Cari kode / nama Kota…"
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
            <p className="text-destructive font-medium">Gagal memuat Cabang</p>
            <p className="text-muted-foreground mt-0.5">{(error as Error).message}</p>
          </div>
        )}

        {data && (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="h-8 border-b px-3 text-left font-medium">Kode Kota</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Nama Kota</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Manager Kota</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Asisten Manager</th>
                    <th className="h-8 w-20 border-b px-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r['Kode Kota']} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono">{r['Kode Kota']}</td>
                      <td className="px-3 py-1.5">{r['Nama Kota']}</td>
                      <td className="px-3 py-1.5">{r['Manager Kota Nama'] || '—'}</td>
                      <td className="px-3 py-1.5">{r['Asisten Manager Nama'] || '—'}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            aria-label={`Edit ${r['Kode Kota']}`}
                            className="hover:bg-muted rounded-md p-1.5 transition-colors"
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-10 text-center">
                        {q ? 'Tidak ada Kota yang cocok.' : 'Belum ada Kota. Klik “Tambah Kota”.'}
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
            <DialogTitle>{editing ? 'Edit Kota' : 'Tambah Kota'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Kode Kota tidak bisa diubah.'
                : 'Manager Kota & Asisten Manager dipilih dari akun User Management yang sudah ada - label organisasi, tidak mengubah hak akses login akun tsb.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kodeKota">Kode Kota</Label>
              <Input
                id="kodeKota"
                value={form.kodeKota}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, kodeKota: e.target.value })}
                placeholder="mis. BATANG"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="namaKota">Nama Kota</Label>
              <Input id="namaKota" value={form.namaKota} onChange={(e) => setForm({ ...form, namaKota: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="managerKota">Manager Kota</Label>
              <Select
                items={userItems}
                value={form.managerKotaUserId}
                onValueChange={(v) => setForm({ ...form, managerKotaUserId: v ?? NONE })}
              >
                <SelectTrigger id="managerKota" className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Belum ditunjuk —</SelectItem>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.Id} value={u.Id}>
                      {u.Nama} ({u.Role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asistenManager">Asisten Manager</Label>
              <Select
                items={userItems}
                value={form.asistenManagerUserId}
                onValueChange={(v) => setForm({ ...form, asistenManagerUserId: v ?? NONE })}
              >
                <SelectTrigger id="asistenManager" className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Belum ditunjuk —</SelectItem>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.Id} value={u.Id}>
                      {u.Nama} ({u.Role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
    </>
  );
}
