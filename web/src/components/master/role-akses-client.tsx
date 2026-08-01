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
  GatedRole,
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

// Editor Izin: card per menu_key (Dashboard, Feedback Long Tail Lihat/Edit,
// Riwayat Feedback) - PERSIS 4 menu_key yg ada di matrix (lihat
// lib/data/supabase/permissions.ts), TIDAK lebih (Import/Master Data/User
// Management memang tak pernah dimiliki SPV DP/Admin DP).
const MENU_CARDS: MenuCardDef[] = [
  { title: 'Dashboard', desc: 'Ringkasan statistik & monitoring', toggles: [{ key: 'dashboard', label: 'AKSES' }] },
  {
    title: 'Feedback Long Tail',
    desc: 'Isi & kelola feedback paket',
    toggles: [
      { key: 'feedback_longtail_view', label: 'LIHAT' },
      { key: 'feedback_longtail_edit', label: 'EDIT' },
    ],
  },
  { title: 'Riwayat Feedback', desc: 'Histori aktivitas per waybill', toggles: [{ key: 'riwayat_feedback', label: 'AKSES' }] },
];

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

function RoleGrid({ summary, onSelect }: { summary: RoleAksesSummary[]; onSelect: (role: GatedRole) => void }) {
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
  role: GatedRole;
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
  rows,
  onToggle,
  onReset,
  pending,
}: {
  rows: (RolePermissionRow | UserPermissionRow)[];
  onToggle: (menuKey: MenuKey, enabled: boolean) => void;
  onReset?: (menuKey: MenuKey) => void;
  pending?: boolean;
}) {
  const byKey = new Map(rows.map((r) => [r.menuKey, r]));
  return (
    <div className="flex flex-col gap-2">
      {MENU_CARDS.map((card) => {
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
  const [role, setRole] = useState<GatedRole | null>(null);
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
  function openRole(r: GatedRole) {
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
        description="Atur hak akses menu untuk SPV Drop Point & Admin DP — per role sekaligus, atau per akun secara individual."
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

