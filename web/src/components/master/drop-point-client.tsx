'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge, isAktif } from '@/components/master/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TablePager } from '@/components/ui/table-pager';
import { CopyButton } from '@/components/ui/copy-button';
import { TagInput } from '@/components/ui/tag-input';
import { normalizeKecamatan } from '@/lib/kecamatan';
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
import type { DropPointRow } from '@/lib/data/drop-points';
import type { CreateGeneralAccountResult, UserRow } from '@/lib/data/users';
import type { CabangRow } from '@/lib/data/cabang';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

const NONE = ''; // sentinel "belum di-assign" - Kota & SPV Drop Point opsional

type FormState = {
  kodeDp: string;
  namaDp: string;
  kecamatan: string[];
  statusAktif: boolean;
  kodeKota: string;
  spvDropPointUserId: string;
};
const EMPTY: FormState = {
  kodeDp: '',
  namaDp: '',
  kecamatan: [],
  statusAktif: true,
  kodeKota: NONE,
  spvDropPointUserId: NONE,
};

export function DropPointClient() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['drop-points'],
    queryFn: () => api<DropPointRow[]>('/api/drop-points'),
    staleTime: SLOW_STALE_TIME, // jarang berubah (data master)
  });
  // Dipakai utk: (1) tahu DP mana yg sudah punya akun General (tombol
  // dinonaktifkan) - generalDpSet, dan (2) sumber dropdown SPV Drop Point.
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/api/users'),
    staleTime: SLOW_STALE_TIME,
  });
  const generalDpSet = useMemo(
    () => new Set((users ?? []).filter((u) => u['Tipe Akun'] === 'general').map((u) => u['Drop Point'])),
    [users],
  );
  const activeUsers = useMemo(
    () => (users ?? []).filter((u) => isAktif(u['Status Aktif'])).sort((a, b) => a.Nama.localeCompare(b.Nama)),
    [users],
  );
  // Sumber dropdown assignment Kota.
  const { data: cabangList } = useQuery({
    queryKey: ['cabang'],
    queryFn: () => api<CabangRow[]>('/api/cabang'),
    staleTime: SLOW_STALE_TIME,
  });

  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DropPointRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<DropPointRow | null>(null);
  const [generalFor, setGeneralFor] = useState<DropPointRow | null>(null);
  const [generalPassword, setGeneralPassword] = useState('');
  const [showGeneralPassword, setShowGeneralPassword] = useState(false);
  const [generalResult, setGeneralResult] = useState<CreateGeneralAccountResult | null>(null);

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
        body: JSON.stringify({
          kodeDp: f.kodeDp.trim(),
          namaDp: f.namaDp.trim(),
          kecamatan: f.kecamatan,
          kodeKota: f.kodeKota || null,
          spvDropPointUserId: f.spvDropPointUserId || null,
        }),
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
        body: JSON.stringify({
          namaDp: f.namaDp.trim(),
          kecamatan: f.kecamatan,
          statusAktif: f.statusAktif,
          kodeKota: f.kodeKota || null,
          spvDropPointUserId: f.spvDropPointUserId || null,
        }),
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

  const createGeneralMut = useMutation({
    mutationFn: ({ kodeDp, password }: { kodeDp: string; password: string }) =>
      api<CreateGeneralAccountResult>(`/api/drop-points/${encodeURIComponent(kodeDp)}/general-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }),
    onSuccess: (result) => {
      setGeneralResult(result); // dialog beralih ke tampilan konfirmasi NIK
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => toast.error(`Gagal membuat akun General: ${e.message}`),
  });

  function openGeneral(r: DropPointRow) {
    setGeneralFor(r);
    setGeneralPassword('');
    setShowGeneralPassword(false);
    setGeneralResult(null);
  }
  function closeGeneral() {
    setGeneralFor(null);
    setGeneralResult(null);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setKecamatanError(null);
    setDialogOpen(true);
  }
  function openEdit(r: DropPointRow) {
    setEditing(r);
    setKecamatanError(null);
    setForm({
      kodeDp: r['Kode DP'],
      namaDp: r['Nama DP'],
      kecamatan: r['Kecamatan'],
      statusAktif: isAktif(r['Status Aktif']),
      kodeKota: r['Kode Kota'],
      spvDropPointUserId: r['SPV Drop Point'],
    });
    setDialogOpen(true);
  }
  function submit() {
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const canSave = editing ? form.namaDp.trim() : form.kodeDp.trim() && form.namaDp.trim();

  // Peta Kecamatan -> Kode DP pemilik (dari data yang sudah dimuat) - dipakai
  // utk memberi peringatan instan di form saat user menambah Kecamatan yang
  // sudah dipakai DP lain, tanpa perlu round-trip ke server dulu. Validasi
  // final tetap di backend (lihat drop-points.ts validateKecamatanConflicts).
  const kecamatanOwnerMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data ?? []) {
      for (const k of r['Kecamatan']) m.set(k, r['Kode DP']);
    }
    return m;
  }, [data]);
  const [kecamatanError, setKecamatanError] = useState<string | null>(null);

  function addKecamatan(raw: string) {
    const kec = normalizeKecamatan(raw);
    if (!kec) return;
    if (form.kecamatan.includes(kec)) {
      setKecamatanError(`"${kec}" sudah ada di daftar ini.`);
      return;
    }
    const owner = kecamatanOwnerMap.get(kec);
    if (owner && owner !== form.kodeDp) {
      setKecamatanError(`"${kec}" sudah terdaftar di DP ${owner}.`);
      return;
    }
    setKecamatanError(null);
    setForm((prev) => ({ ...prev, kecamatan: [...prev.kecamatan, kec] }));
  }
  function removeKecamatan(kec: string) {
    setKecamatanError(null);
    setForm((prev) => ({ ...prev, kecamatan: prev.kecamatan.filter((k) => k !== kec) }));
  }

  // WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
  // trigger menampilkan label yang benar, bukan value mentah.
  const kotaItems: Record<string, string> = { [NONE]: '— Belum ada Kota —' };
  for (const c of cabangList ?? []) kotaItems[c['Kode Kota']] = `${c['Kode Kota']} — ${c['Nama Kota']}`;
  const spvItems: Record<string, string> = { [NONE]: '— Belum ditunjuk —' };
  for (const u of activeUsers) spvItems[u.Id] = `${u.Nama} (${u.Role})`;

  return (
    <>
      <PageHeader
        title="Master Drop Point"
        description="Kelola kode, nama, Kecamatan, dan status aktif Drop Point."
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
              placeholder="Cari kode / nama / kecamatan…"
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
                    <th className="h-8 border-b px-3 text-left font-medium">Kecamatan</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Kota</th>
                    <th className="h-8 border-b px-3 text-left font-medium">SPV Drop Point</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Admin DP</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Status</th>
                    <th className="h-8 w-32 border-b px-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r['Kode DP']} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono">{r['Kode DP']}</td>
                      <td className="px-3 py-1.5">{r['Nama DP']}</td>
                      <td className="px-3 py-1.5">{r['Wilayah/Cabang'] || '—'}</td>
                      <td className="px-3 py-1.5">{r['Nama Kota'] || '—'}</td>
                      <td className="px-3 py-1.5">{r['SPV Drop Point Nama'] || '—'}</td>
                      <td className="px-3 py-1.5">{r['Admin DP'].length > 0 ? r['Admin DP'].join(', ') : '—'}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge aktif={isAktif(r['Status Aktif'])} />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openGeneral(r)}
                            disabled={generalDpSet.has(r['Kode DP'])}
                            aria-label={`Buat Akun General ${r['Kode DP']}`}
                            title={
                              generalDpSet.has(r['Kode DP'])
                                ? 'Akun General sudah ada untuk DP ini'
                                : 'Buat Akun General untuk DP ini'
                            }
                            className="hover:bg-muted rounded-md p-1.5 transition-colors disabled:opacity-30"
                          >
                            <UserPlus className="size-3.5" aria-hidden />
                          </button>
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
                      <td colSpan={8} className="text-muted-foreground py-10 text-center">
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
              <Label htmlFor="kecamatan">Kecamatan</Label>
              <TagInput
                id="kecamatan"
                value={form.kecamatan}
                onAdd={addKecamatan}
                onRemove={removeKecamatan}
                placeholder="Ketik nama Kecamatan, lalu Enter/Tambah"
                error={kecamatanError}
              />
              <p className="text-muted-foreground text-[11px]">
                Satu Kecamatan cuma boleh terdaftar di satu DP - dipakai fitur lain (mis. Monitoring INC) utk
                mengetahui DP mana yang menangani Kecamatan tujuan tertentu.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kodeKota">Kota</Label>
              <Select items={kotaItems} value={form.kodeKota} onValueChange={(v) => setForm({ ...form, kodeKota: v ?? NONE })}>
                <SelectTrigger id="kodeKota" className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Belum ada Kota —</SelectItem>
                  {(cabangList ?? []).map((c) => (
                    <SelectItem key={c['Kode Kota']} value={c['Kode Kota']}>
                      {c['Kode Kota']} — {c['Nama Kota']}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spvDropPoint">SPV Drop Point</Label>
              <Select
                items={spvItems}
                value={form.spvDropPointUserId}
                onValueChange={(v) => setForm({ ...form, spvDropPointUserId: v ?? NONE })}
              >
                <SelectTrigger id="spvDropPoint" className="h-9 w-full text-sm">
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
              <p className="text-muted-foreground text-[11px]">
                Label organisasi (dipilih dari akun User Management manapun), bukan role otorisasi baru. Admin DP
                (hak akses login) tetap dikelola lewat User Management seperti biasa.
              </p>
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

      {/* Buat Akun General - satu per DP, tanpa identitas personal (login via NIK). */}
      <Dialog open={!!generalFor} onOpenChange={(o) => !o && closeGeneral()}>
        <DialogContent className="max-w-sm">
          {generalResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Akun General dibuat</DialogTitle>
                <DialogDescription>
                  Catat NIK ini — dipakai staff DP {generalFor?.['Kode DP']} untuk login (bukan email).
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted flex items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-muted-foreground text-[11px]">NIK Login</p>
                  <p className="font-mono text-sm font-semibold">{generalResult.nik}</p>
                </div>
                <CopyButton text={generalResult.nik} title="Salin NIK" successMessage="NIK disalin" className="p-1.5" />
              </div>
              <DialogFooter>
                <Button onClick={closeGeneral}>Tutup</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Buat Akun General</DialogTitle>
                <DialogDescription>
                  Satu akun bersama untuk staff DP <span className="font-mono">{generalFor?.['Kode DP']}</span> —
                  aktivitasnya tercatat sebagai nama DP, bukan nama personal. NIK login dibuat otomatis (format
                  GENERAL-{generalFor?.['Kode DP']}). Set password awal, minimal 8 karakter.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="general-password">Password awal</Label>
                <div className="relative">
                  <Input
                    id="general-password"
                    type={showGeneralPassword ? 'text' : 'password'}
                    value={generalPassword}
                    onChange={(e) => setGeneralPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeneralPassword((v) => !v)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                    title={showGeneralPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showGeneralPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeGeneral} disabled={createGeneralMut.isPending}>
                  Batal
                </Button>
                <Button
                  onClick={() => generalFor && createGeneralMut.mutate({ kodeDp: generalFor['Kode DP'], password: generalPassword })}
                  disabled={generalPassword.length < 8 || createGeneralMut.isPending}
                >
                  {createGeneralMut.isPending ? 'Membuat…' : 'Buat Akun'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
