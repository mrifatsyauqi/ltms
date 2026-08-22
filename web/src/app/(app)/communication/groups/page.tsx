'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Radio,
  Star,
  Clock,
  Send,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { FeishuGroupConfigRecord } from '@/lib/data/supabase/communication-config';
import { commApi } from '@/lib/communication-client';

const GROUPS_KEY = ['communication-groups'];

export default function CommunicationGroupsPage() {
  const qc = useQueryClient();
  const [syncLatency, setSyncLatency] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: groups = [], isLoading: loading } = useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => commApi<FeishuGroupConfigRecord[]>('/api/communication/groups'),
    staleTime: 30 * 1000,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const startTime = performance.now();
      const data = await commApi<FeishuGroupConfigRecord[]>('/api/communication/groups', { method: 'POST' });
      setSyncLatency(Math.round(performance.now() - startTime));
      return data;
    },
    onSuccess: (data) => qc.setQueryData(GROUPS_KEY, data),
    onError: (err: Error) => alert(err.message || 'Terjadi kesalahan jaringan saat sync Feishu'),
  });

  // 1-Click Radio Button Set Default Group - optimistic, auto-rollback via onError.
  const setDefaultMut = useMutation({
    mutationFn: (chatId: string) =>
      commApi('/api/communication/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, isDefault: true }),
      }),
    onMutate: async (chatId) => {
      await qc.cancelQueries({ queryKey: GROUPS_KEY });
      const previous = qc.getQueryData<FeishuGroupConfigRecord[]>(GROUPS_KEY);
      qc.setQueryData<FeishuGroupConfigRecord[]>(GROUPS_KEY, (prev) =>
        (prev ?? []).map((g) => ({ ...g, is_default: g.chat_id === chatId }))
      );
      return { previous };
    },
    onError: (_err, _chatId, ctx) => {
      if (ctx?.previous) qc.setQueryData(GROUPS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });

  // Toggle Connected / Disconnected Status - optimistic, auto-rollback via onError.
  const toggleStatusMut = useMutation({
    mutationFn: (group: FeishuGroupConfigRecord) => {
      const nextStatus = group.status === 'active' ? 'disconnected' : 'active';
      return commApi('/api/communication/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: group.chat_id, status: nextStatus }),
      });
    },
    onMutate: async (group) => {
      await qc.cancelQueries({ queryKey: GROUPS_KEY });
      const previous = qc.getQueryData<FeishuGroupConfigRecord[]>(GROUPS_KEY);
      const nextStatus = group.status === 'active' ? 'disconnected' : 'active';
      qc.setQueryData<FeishuGroupConfigRecord[]>(GROUPS_KEY, (prev) =>
        (prev ?? []).map((g) => (g.chat_id === group.chat_id ? { ...g, status: nextStatus } : g))
      );
      return { previous };
    },
    onError: (_err, _group, ctx) => {
      if (ctx?.previous) qc.setQueryData(GROUPS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });

  const handleSyncFeishu = () => syncMut.mutate();
  const handleSetDefault = (chatId: string) => setDefaultMut.mutate(chatId);
  const handleToggleStatus = (group: FeishuGroupConfigRecord) => toggleStatusMut.mutate(group);
  const syncing = syncMut.isPending;

  const filteredGroups = groups.filter(
    (g) =>
      g.group_name.toLowerCase().includes(search.toLowerCase()) ||
      g.chat_id.toLowerCase().includes(search.toLowerCase())
  );

  const defaultGroup = groups.find((g) => g.is_default);
  const activeCount = groups.filter((g) => g.status === 'active').length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            Communication Center
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Groups Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola daftar grup Feishu resmi, tentukan grup default 1-klik, dan pantau status konektivitas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {syncLatency !== null && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
              <Zap className="w-3.5 h-3.5" />
              Sync Feishu: {syncLatency}ms
            </div>
          )}

          <button
            onClick={handleSyncFeishu}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E2231A] hover:bg-[#c91d15] text-white text-sm font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Menyinkronkan...' : 'Sinkronkan Group Feishu'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Group Feishu</div>
            <div className="text-lg font-bold text-foreground">{groups.length} Grup</div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Status Terhubung</div>
            <div className="text-lg font-bold text-foreground">{activeCount} Grup Aktif</div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Star className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="text-xs text-muted-foreground font-medium">Grup Default Utama</div>
            <div className="text-base font-bold text-foreground truncate">
              {defaultGroup ? defaultGroup.group_name : 'Belum ditentukan'}
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden space-y-4">
        {/* Search Bar */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama group atau chat_id..."
              className="w-full pl-9 pr-3 py-1.5 bg-muted border border-border rounded-lg text-xs text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <button
            onClick={() => qc.invalidateQueries({ queryKey: GROUPS_KEY })}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            title="Muat ulang tabel"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table View */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Memuat daftar group...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Tidak ada group ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Klik &quot;Sinkronkan Group Feishu&quot; untuk menarik daftar grup dari akun bot Feishu Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="bg-muted/80 border-b border-border text-[11px] font-bold text-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Default</th>
                  <th className="py-3 px-4">Nama Group & Chat ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Anggota</th>
                  <th className="py-3 px-4">Terakhir Sync</th>
                  <th className="py-3 px-4">Terakhir Kirim</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGroups.map((g) => {
                  const isDefault = g.is_default;
                  const isConnected = g.status === 'active';

                  return (
                    <tr
                      key={g.chat_id}
                      className={`hover:bg-muted/80 transition-colors ${
                        isDefault ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Radio Selector */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="radio"
                          name="default_group_radio"
                          checked={isDefault}
                          onChange={() => handleSetDefault(g.chat_id)}
                          title="Klik untuk memilih sebagai group default"
                          className="w-4 h-4 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      </td>

                      {/* Group Name & Chat ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center font-bold text-foreground shrink-0">
                            {g.avatar ? (
                              <img
                                src={g.avatar}
                                alt={g.group_name}
                                className="w-8 h-8 rounded-lg object-cover"
                              />
                            ) : (
                              g.group_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">
                                {g.group_name}
                              </span>
                              {isDefault && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                              {g.chat_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isConnected
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                            }`}
                          />
                          {isConnected ? 'Terhubung' : 'Terputus'}
                        </span>
                      </td>

                      {/* Members */}
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {g.member_count} anggota
                      </td>

                      {/* Last Sync */}
                      <td className="py-3.5 px-4 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {new Date(g.last_sync).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Last Send */}
                      <td className="py-3.5 px-4 text-[11px] text-muted-foreground">
                        {g.last_send ? (
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            <Send className="w-3 h-3 text-emerald-500" />
                            {new Date(g.last_send).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Belum pernah</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(g)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md border transition-all ${
                            isConnected
                              ? 'border-border text-muted-foreground hover:bg-muted'
                              : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {isConnected ? 'Putuskan' : 'Hubungkan'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
