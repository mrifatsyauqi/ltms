'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import { ASSIGNABLE_ROLES, hasFullAccess, isAssignableRole, type AssignableRole } from '@/lib/roles';
import type { UserRow } from '@/lib/data/users';
import type { DropPointRow } from '@/lib/data/drop-points';
import type { JabatanRow } from '@/lib/data/jabatan';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

type FormState = { nama: string; email: string; nik: string; role: AssignableRole; dropPoint: string; statusAktif: boolean };
const EMPTY: FormState = { nama: '', email: '', nik: '', role: 'Admin DP', dropPoint: '', statusAktif: true };

// Tabel jabatan punya 6 baris (Super Admin, Admin Cabang, Manager Kota,
// Asisten Manager Kota, SPV Drop Point, Admin DP). Dropdown ini menawarkan 5
// - SEMUA KECUALI Super Admin (lihat ASSIGNABLE_ROLES) - Super Admin sengaja
// TIDAK BISA dibuat lewat form, cuma lewat SQL manual (mencegah risiko
// privilege escalation via UI). Manager Kota/Asisten Manager Kota punya
// akses PENUH setara Admin Cabang (Langkah 3); SPV Drop Point di-assign ke
// DP-nya lewat halaman Drop Point, BUKAN field di form ini.
const SELECTABLE_JABATAN = new Set<string>(ASSIGNABLE_ROLES);

export function UserManagementClient({ selfEmail }: { selfEmail: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/api/users'),
    staleTime: SLOW_STALE_TIME, // jarang berubah (data master)
  });
  // DP aktif untuk dropdown (requirement terkunci: bukan teks bebas).
  const { data: dps } = useQuery({
    queryKey: ['drop-points'],
    queryFn: () => api<DropPointRow[]>('/api/drop-points'),
    staleTime: SLOW_STALE_TIME, // jarang berubah (data master)
  });
  const activeDps = useMemo(() => (dps ?? []).filter((d) => isAktif(d['Status Aktif'])), [dps]);
  // Sumber dropdown Jabatan - lihat SELECTABLE_JABATAN utk kenapa cuma 2 dari
  // 6 baris yang tampil di sini.
  const { data: jabatanList } = useQuery({
    queryKey: ['jabatan'],
    queryFn: () => api<JabatanRow[]>('/api/jabatan'),
    staleTime: SLOW_STALE_TIME,
  });
  const selectableJabatan = useMemo(
    () => (jabatanList ?? []).filter((j) => SELECTABLE_JABATAN.has(j.Nama)).sort((a, b) => a.Tingkat - b.Tingkat),
    [jabatanList],
  );

  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data ?? [];
    if (!needle) return all;
    return all.filter(
      (r) =>
        String(r.Nama).toLowerCase().includes(needle) ||
        String(r.Email).toLowerCase().includes(needle) ||
        String(r.NIK).toLowerCase().includes(needle) ||
        String(r.Role).toLowerCase().includes(needle) ||
        String(r['Drop Point']).toLowerCase().includes(needle),
    );
  }, [data, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      api('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: f.nama.trim(),
          email: f.email.trim(),
          nik: f.nik.trim(),
          role: f.role,
          dropPoint: f.role === 'Admin DP' ? f.dropPoint : '',
        }),
      }),
    onSuccess: () => {
      toast.success('User ditambahkan.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal menambah: ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: (f: FormState) =>
      api(`/api/users/${encodeURIComponent(f.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: f.nama.trim(),
          nik: f.nik.trim(),
          role: f.role,
          // Admin Cabang -> DP dikosongkan (dijaga juga di backend).
          dropPoint: f.role === 'Admin DP' ? f.dropPoint : '',
          statusAktif: f.statusAktif,
        }),
      }),
    onSuccess: () => {
      toast.success('User diperbarui.');
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal memperbarui: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (email: string) => api(`/api/users/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('User dihapus.');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Gagal menghapus: ${e.message}`),
  });

  const setPasswordMut = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api(`/api/users/${encodeURIComponent(email)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      toast.success('Password diperbarui.');
      setPasswordFor(null);
      setPasswordValue('');
    },
    onError: (e: Error) => toast.error(`Gagal set password: ${e.message}`),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, dropPoint: activeDps[0]?.['Kode DP'] ?? '' });
    setDialogOpen(true);
  }
  function openEdit(r: UserRow) {
    setEditing(r);
    setForm({
      nama: r.Nama,
      email: r.Email,
      nik: r.NIK,
      // Super Admin (satu-satunya role di luar ASSIGNABLE_ROLES) tak bisa
      // dibuat/diubah lewat form ini - fallback ke Admin DP kalau baris yang
      // dibuka edit-nya kebetulan Super Admin, supaya dropdown tetap valid.
      role: isAssignableRole(r.Role) ? r.Role : 'Admin DP',
      dropPoint: r['Drop Point'] || activeDps[0]?.['Kode DP'] || '',
      statusAktif: isAktif(r['Status Aktif']),
    });
    setDialogOpen(true);
  }
  function submit() {
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const needDp = form.role === 'Admin DP';
  const canSave =
    form.nama.trim() &&
    (editing || form.email.trim()) &&
    form.nik.trim() &&
    (!needDp || form.dropPoint) &&
    (!needDp || activeDps.length > 0);

  // WAJIB: base-ui Select butuh peta value->label eksplisit (`items`) supaya
  // trigger menampilkan label yang benar, bukan value mentah.
  const jabatanItems = Object.fromEntries(selectableJabatan.map((j) => [j.Nama, j.Nama]));
  const dpItems = Object.fromEntries(activeDps.map((d) => [d['Kode DP'], `${d['Kode DP']} — ${d['Nama DP']}`]));

  return (
    <>
      <PageHeader
        title="User Management"
        description="Kelola user, role, dan Drop Point terkait."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden /> Tambah User
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <div className="relative w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            placeholder="Cari nama / email / DP…"
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
            <p className="text-destructive font-medium">Gagal memuat user</p>
            <p className="text-muted-foreground mt-0.5">{(error as Error).message}</p>
          </div>
        )}

        {data && (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="h-8 border-b px-3 text-left font-medium">Nama</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Email</th>
                    <th className="h-8 border-b px-3 text-left font-medium">NIK</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Role</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Drop Point</th>
                    <th className="h-8 border-b px-3 text-left font-medium">Status</th>
                    <th className="h-8 w-32 border-b px-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.Email} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {r.Nama}
                          {r['Tipe Akun'] === 'general' && (
                            <span className="bg-accent-blue/12 text-accent-blue rounded px-1.5 py-0.5 text-[10px] font-medium">
                              General
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-1.5">{r.Email}</td>
                      <td className="text-muted-foreground px-3 py-1.5 font-mono">{r.NIK || '—'}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-medium',
                            hasFullAccess(r.Role)
                              ? 'bg-brand-muted text-brand'
                              : 'bg-accent-blue/12 text-accent-blue',
                          )}
                        >
                          {r.Role}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono">{r['Drop Point'] || '—'}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge aktif={isAktif(r['Status Aktif'])} />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            aria-label={`Edit ${r.Email}`}
                            className="hover:bg-muted rounded-md p-1.5 transition-colors"
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordFor(r);
                              setPasswordValue('');
                              setShowPassword(false);
                            }}
                            aria-label={`Set password ${r.Email}`}
                            title="Set password login manual"
                            className="hover:bg-muted rounded-md p-1.5 transition-colors"
                          >
                            <KeyRound className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            disabled={r.Email.toLowerCase() === selfEmail.toLowerCase()}
                            title={
                              r.Email.toLowerCase() === selfEmail.toLowerCase()
                                ? 'Tidak bisa menghapus akun sendiri'
                                : undefined
                            }
                            aria-label={`Hapus ${r.Email}`}
                            className="text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-muted-foreground py-10 text-center">
                        {q ? 'Tidak ada user yang cocok.' : 'Belum ada user. Klik “Tambah User”.'}
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
            <DialogTitle>{editing ? 'Edit User' : 'Tambah User'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Email tidak bisa diubah (identitas unik akun). NIK dipakai untuk login utama.'
                : 'Email jadi identitas unik akun. NIK dipakai untuk login utama.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nama@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nik">NIK</Label>
              <Input
                id="nik"
                value={form.nik}
                onChange={(e) => setForm({ ...form, nik: e.target.value })}
                placeholder="Nomor Induk Karyawan"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jabatan">Jabatan</Label>
              <Select
                items={jabatanItems}
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: (v ?? 'Admin DP') as AssignableRole })}
              >
                <SelectTrigger id="jabatan" className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableJabatan.map((j) => (
                    <SelectItem key={j.Id} value={j.Nama}>
                      {j.Nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needDp && (
              <div className="space-y-1.5">
                <Label htmlFor="dropPoint">Drop Point</Label>
                {activeDps.length === 0 ? (
                  <p className="text-destructive text-xs">
                    Belum ada Drop Point aktif. Tambahkan di Master Drop Point dulu.
                  </p>
                ) : (
                  <Select items={dpItems} value={form.dropPoint} onValueChange={(v) => setForm({ ...form, dropPoint: v ?? '' })}>
                    <SelectTrigger id="dropPoint" className="h-9 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDps.map((d) => (
                        <SelectItem key={d['Kode DP']} value={d['Kode DP']}>
                          {d['Kode DP']} — {d['Nama DP']}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-muted-foreground text-[11px]">
                  Dipilih dari daftar Master Drop Point (bukan ketik bebas) supaya cocok dengan data Long Tail.
                </p>
              </div>
            )}
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.statusAktif}
                  onChange={(e) => setForm({ ...form, statusAktif: e.target.checked })}
                />
                Aktif (boleh login)
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

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus user?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.Nama} ({confirmDelete?.Email}) akan dihapus permanen dan tidak bisa login lagi. Kalau
              hanya ingin mencabut akses sementara, nonaktifkan saja lewat Edit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleteMut.isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.Email)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordFor} onOpenChange={(o) => !o && setPasswordFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Password login manual untuk {passwordFor?.Nama} ({passwordFor?.Email}). Minimal 8 karakter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password baru</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                autoComplete="new-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordFor(null)} disabled={setPasswordMut.isPending}>
              Batal
            </Button>
            <Button
              onClick={() => passwordFor && setPasswordMut.mutate({ email: passwordFor.Email, password: passwordValue })}
              disabled={passwordValue.length < 8 || setPasswordMut.isPending}
            >
              {setPasswordMut.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
