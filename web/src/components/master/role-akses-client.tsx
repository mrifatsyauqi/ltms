'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import type {
  ManageableRole,
  MenuKey,
  RoleAksesAccount,
  RoleAksesAccountDetail,
  RoleAksesSummary,
  RolePermissionRow,
  UserPermissionRow,
} from '@/lib/data/role-akses';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

type MenuCardDef = { title: string; desc: string; toggles: { key: MenuKey; label: string }[] };

// Editor Izin: card per menu_key yang dimiliki SPV Drop Point/Admin DP (5,
// lihat lib/data/supabase/permissions.ts) - Import/Master Data/User
// Management memang tak pernah dimiliki role ini, tak ada card-nya.
const GATED_MENU_CARDS: MenuCardDef[] = [
  { title: 'Dashboard', desc: 'Ringkasan statistik & monitoring', toggles: [{ key: 'dashboard', label: 'AKSES' }] },
  {
    title: 'Feedback Long Tail',
    desc: 'Isi & kelola feedback paket',
    toggles: [
      { key: 'feedback_longtail_view', label: 'LIHAT' },
      { key: 'feedback_longtail_edit', label: 'EDIT' },
    ],
  },
  {
    title: 'Monitoring Delivery',
    desc: 'Tabel Monitoring Delivery per Sprinter',
    toggles: [{ key: 'monitoring_delivery_dp', label: 'AKSES' }],
  },
  { title: 'Riwayat Feedback', desc: 'Histori aktivitas per waybill', toggles: [{ key: 'riwayat_feedback', label: 'AKSES' }] },
];

// Editor Izin utk Admin Cabang/Manager Kota/Asisten Manager Kota (cakupan
// sidebar full access, 14 menu_key relevan dari 15 di vocabulary - lihat
// lib/data/supabase/permissions.ts; monitoring_delivery_dp SENGAJA tak
// dipakai di sini, itu milik SPV Drop Point/Admin DP).
const FULL_ACCESS_MENU_CARDS: MenuCardDef[] = [
  { title: 'Dashboard', desc: 'Ringkasan statistik & monitoring', toggles: [{ key: 'dashboard', label: 'AKSES' }] },
  {
    title: 'Feedback Long Tail',
    desc: 'Isi & kelola feedback paket',
    toggles: [
      { key: 'feedback_longtail_view', label: 'LIHAT' },
      { key: 'feedback_longtail_edit', label: 'EDIT' },
    ],
  },
  { title: 'Data Long Tail', desc: 'Tabel data mentah per waybill', toggles: [{ key: 'data_longtail', label: 'AKSES' }] },
  { title: 'Import Long Tail', desc: 'Upload file tarikan JMS', toggles: [{ key: 'import_longtail', label: 'AKSES' }] },
  {
    title: 'Monitoring Delivery',
    desc: 'Tabel Monitoring Delivery Refine Total per Drop Point',
    toggles: [{ key: 'monitoring_delivery_cabang', label: 'AKSES' }],
  },
  {
    title: 'Cabang & Drop Point',
    desc: 'Struktur organisasi Kota & Drop Point',
    toggles: [
      { key: 'master_cabang', label: 'CABANG' },
      { key: 'master_drop_point', label: 'DROP POINT' },
    ],
  },
  { title: 'Master Feedback', desc: 'Daftar kategori feedback baku', toggles: [{ key: 'master_feedback', label: 'AKSES' }] },
  { title: 'User Management', desc: 'Kelola akun pengguna', toggles: [{ key: 'user_management', label: 'AKSES' }] },
  { title: 'Role & Akses', desc: 'Kelola hak akses menu SPV Drop Point/Admin DP', toggles: [{ key: 'role_akses', label: 'AKSES' }] },
  { title: 'Riwayat Import', desc: 'Histori tarikan data JMS', toggles: [{ key: 'riwayat_import', label: 'AKSES' }] },
  { title: 'Riwayat Feedback', desc: 'Histori aktivitas per waybill', toggles: [{ key: 'riwayat_feedback', label: 'AKSES' }] },
  { title: 'Pengaturan', desc: 'Pengaturan aplikasi & Link Berbagi Laporan', toggles: [{ key: 'pengaturan', label: 'AKSES' }] },
];

function menuCardsFor(role: ManageableRole): MenuCardDef[] {
  return role === 'SPV Drop Point' || role === 'Admin DP' ? GATED_MENU_CARDS : FULL_ACCESS_MENU_CARDS;
}

function initials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent-green' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block size-3.5 translate-x-1 transform rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-[18px]',
        )}
      />
    </button>
  );
}

function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3" />}
          {item.onClick ? (
            <button type="button" onClick={item.onClick} className="hover:text-foreground hover:underline">
              {item.label}
            </button>
          ) : (
            <span className={i === items.length - 1 ? 'text-foreground font-medium' : undefined}>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function Avatar({ nama, size = 9 }: { nama: string; size?: 8 | 9 }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary',
        size === 9 ? 'size-9' : 'size-8',
      )}
    >
      {initials(nama)}
    </div>
  );
}

function RoleGrid({ summary, onSelect }: { summary: RoleAksesSummary[]; onSelect: (role: ManageableRole) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {summary.map((s) => (
        <button
          key={s.role}
          type="button"
          onClick={() => onSelect(s.role)}
          className="border-border bg-card hover:border-primary flex items-center gap-3 rounded-lg border p-4 text-left transition-colors"
        >
          <Avatar nama={s.role} />
          <div>
            <div className="text-sm font-semibold">{s.role}</div>
            <div className="text-muted-foreground text-xs">{s.count} akun</div>
          </div>
        </button>
      ))}
      {summary.length === 0 && <div className="text-muted-foreground col-span-2 py-6 text-center text-sm">Belum ada data.</div>}
    </div>
  );
}

function AccountList({
  role,
  accounts,
  onSelect,
}: {
  role: ManageableRole;
  accounts: RoleAksesAccount[];
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.nama.toLowerCase().includes(q) || a.nik.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  return (
    <>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama / NIK / email…"
          className="h-8 pl-8 text-xs"
        />
      </div>
      <SectionCard title={`Daftar Akun — ${role}`}>
        <div className="divide-border flex flex-col divide-y">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              className="hover:bg-muted/40 flex items-center justify-between gap-3 py-2.5 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar nama={a.nama} size={8} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.nama}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    NIK {a.nik || '-'} · {a.konteks}
                  </div>
                </div>
              </div>
              {a.customCount > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {a.customCount} izin custom
                </Badge>
              )}
            </button>
          ))}
          {filtered.length === 0 && <div className="text-muted-foreground py-6 text-center text-sm">Tidak ada akun.</div>}
        </div>
      </SectionCard>
    </>
  );
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="bg-muted-foreground size-1.5 rounded-full" /> Mengikuti default role
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-primary size-1.5 rounded-full" /> Sudah di-override khusus akun ini
      </span>
    </div>
  );
}

function PermissionCards({
  menuCards,
  rows,
  onToggle,
  onReset,
  pending,
}: {
  menuCards: MenuCardDef[];
  rows: (RolePermissionRow | UserPermissionRow)[];
  onToggle: (menuKey: MenuKey, enabled: boolean) => void;
  onReset?: (menuKey: MenuKey) => void;
  pending?: boolean;
}) {
  const byKey = new Map(rows.map((r) => [r.menuKey, r]));
  return (
    <div className="flex flex-col gap-2">
      {menuCards.map((card) => {
        const cardOverride = card.toggles.some((t) => (byKey.get(t.key) as UserPermissionRow | undefined)?.isOverride);
        return (
          <div key={card.title} className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{card.title}</span>
                {cardOverride && (
                  <>
                    <Badge variant="secondary" className="text-[10px]">
                      Custom
                    </Badge>
                    {onReset && (
                      <button
                        type="button"
                        className="text-primary text-[11px] hover:underline"
                        disabled={pending}
                        onClick={() => card.toggles.forEach((t) => (byKey.get(t.key) as UserPermissionRow)?.isOverride && onReset(t.key))}
                      >
                        Reset ke Default ↺
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="text-muted-foreground text-xs">{card.desc}</div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {card.toggles.map((t) => {
                const row = byKey.get(t.key);
                return (
                  <div key={t.key} className="flex flex-col items-center gap-1">
                    <span className="text-muted-foreground text-[10px] font-medium">{t.label}</span>
                    <Toggle checked={row?.enabled ?? true} onChange={(v) => onToggle(t.key, v)} disabled={pending} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccountHeaderCard({ detail }: { detail: RoleAksesAccountDetail }) {
  return (
    <div className="border-primary bg-primary/5 flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <Avatar nama={detail.nama} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{detail.nama}</div>
        <div className="text-muted-foreground text-xs">{detail.konteks}</div>
      </div>
      <Badge variant="destructive">{detail.role}</Badge>
      <Badge variant="outline">NIK {detail.nik || '-'}</Badge>
    </div>
  );
}

type Mode = 'per-akun' | 'per-role';
type View = 'grid' | 'accounts' | 'editor';

export function RoleAksesClient() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('per-akun');
  const [view, setView] = useState<View>('grid');
  const [role, setRole] = useState<ManageableRole | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  const summaryQ = useQuery({
    queryKey: ['role-akses-summary'],
    queryFn: () => api<RoleAksesSummary[]>('/api/role-permissions'),
    staleTime: SLOW_STALE_TIME,
  });

  const accountsQ = useQuery({
    queryKey: ['role-akses-accounts', role],
    queryFn: () => api<RoleAksesAccount[]>(`/api/role-permissions/${encodeURIComponent(role ?? '')}/accounts`),
    enabled: !!role && view === 'accounts',
    staleTime: SLOW_STALE_TIME,
  });

  const roleDefaultQ = useQuery({
    queryKey: ['role-akses-default', role],
    queryFn: () => api<RolePermissionRow[]>(`/api/role-permissions/${encodeURIComponent(role ?? '')}`),
    enabled: !!role && mode === 'per-role' && view === 'editor',
    staleTime: SLOW_STALE_TIME,
  });

  const accountDetailQ = useQuery({
    queryKey: ['role-akses-account-detail', accountId],
    queryFn: () => api<RoleAksesAccountDetail>(`/api/user-permissions/${accountId}`),
    enabled: !!accountId && mode === 'per-akun' && view === 'editor',
    staleTime: SLOW_STALE_TIME,
  });

  const setRoleDefaultMut = useMutation({
    mutationFn: (input: { menuKey: MenuKey; enabled: boolean }) =>
      api<RolePermissionRow[]>(`/api/role-permissions/${encodeURIComponent(role ?? '')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['role-akses-default', role], data);
      qc.invalidateQueries({ queryKey: ['role-akses-accounts', role] });
      toast.success('Default role diperbarui');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setOverrideMut = useMutation({
    mutationFn: (input: { menuKey: MenuKey; enabled: boolean }) =>
      api<RoleAksesAccountDetail>(`/api/user-permissions/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['role-akses-account-detail', accountId], data);
      qc.invalidateQueries({ queryKey: ['role-akses-accounts', role] });
      toast.success('Izin akun diperbarui');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetOverrideMut = useMutation({
    mutationFn: (menuKey: MenuKey) =>
      api<RoleAksesAccountDetail>(`/api/user-permissions/${accountId}?menuKey=${encodeURIComponent(menuKey)}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      qc.setQueryData(['role-akses-account-detail', accountId], data);
      qc.invalidateQueries({ queryKey: ['role-akses-accounts', role] });
      toast.success('Dikembalikan ke default role');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function switchMode(m: Mode) {
    setMode(m);
    setView('grid');
    setRole(null);
    setAccountId(null);
  }
  function openRole(r: ManageableRole) {
    setRole(r);
    setView(mode === 'per-role' ? 'editor' : 'accounts');
  }
  function backToGrid() {
    setView('grid');
    setRole(null);
    setAccountId(null);
  }
  function backToAccounts() {
    setView('accounts');
    setAccountId(null);
  }

  const roleDefaultAsUserRows: UserPermissionRow[] = (roleDefaultQ.data ?? []).map((r) => ({ ...r, isOverride: false }));

  return (
    <>
      <PageHeader
        title="Role & Akses"
        description="Atur hak akses menu per role atau per akun secara individual. Super Admin bisa mengatur seluruh jabatan; Admin Cabang/Manager Kota/Asisten Manager Kota hanya SPV Drop Point & Admin DP."
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="bg-muted flex w-fit items-center gap-1 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => switchMode('per-role')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'per-role' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Per Role
          </button>
          <button
            type="button"
            onClick={() => switchMode('per-akun')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'per-akun' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Per Akun
          </button>
        </div>

        {view === 'grid' &&
          (summaryQ.isLoading ? (
            <div className="text-muted-foreground py-6 text-center text-sm">Memuat…</div>
          ) : (
            <RoleGrid summary={summaryQ.data ?? []} onSelect={openRole} />
          ))}

        {view === 'accounts' && role && (
          <>
            <Breadcrumb items={[{ label: 'Role & Akses', onClick: backToGrid }, { label: role }]} />
            {accountsQ.isLoading ? (
              <div className="text-muted-foreground py-6 text-center text-sm">Memuat…</div>
            ) : (
              <AccountList
                role={role}
                accounts={accountsQ.data ?? []}
                onSelect={(id) => {
                  setAccountId(id);
                  setView('editor');
                }}
              />
            )}
          </>
        )}

        {view === 'editor' && role && mode === 'per-akun' && (
          <>
            <Breadcrumb
              items={[
                { label: 'Role & Akses', onClick: backToGrid },
                { label: role, onClick: backToAccounts },
                { label: accountDetailQ.data?.nama ?? '…' },
              ]}
            />
            {accountDetailQ.isLoading || !accountDetailQ.data ? (
              <div className="text-muted-foreground py-6 text-center text-sm">Memuat…</div>
            ) : (
              <>
                <AccountHeaderCard detail={accountDetailQ.data} />
                <Legend />
                <PermissionCards
                  menuCards={menuCardsFor(accountDetailQ.data.role)}
                  rows={accountDetailQ.data.permissions}
                  onToggle={(menuKey, enabled) => setOverrideMut.mutate({ menuKey, enabled })}
                  onReset={(menuKey) => resetOverrideMut.mutate(menuKey)}
                  pending={setOverrideMut.isPending || resetOverrideMut.isPending}
                />
              </>
            )}
          </>
        )}

        {view === 'editor' && role && mode === 'per-role' && (
          <>
            <Breadcrumb items={[{ label: 'Role & Akses', onClick: backToGrid }, { label: `Default — ${role}` }]} />
            <p className="text-muted-foreground text-xs">
              {`Berlaku untuk semua akun ${role} yang belum punya izin custom sendiri (lihat tab "Per Akun" utk override 1 akun).`}
            </p>
            {roleDefaultQ.isLoading ? (
              <div className="text-muted-foreground py-6 text-center text-sm">Memuat…</div>
            ) : (
              <PermissionCards
                menuCards={menuCardsFor(role)}
                rows={roleDefaultAsUserRows}
                onToggle={(menuKey, enabled) => setRoleDefaultMut.mutate({ menuKey, enabled })}
                pending={setRoleDefaultMut.isPending}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

