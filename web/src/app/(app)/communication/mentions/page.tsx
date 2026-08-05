'use client';

import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Upload,
  RefreshCw,
  HelpCircle,
  Check,
  X,
  Filter,
  UserCheck,
  ShieldAlert,
  Send,
  Building,
  Truck,
  MapPin,
} from 'lucide-react';
import type { MentionMappingRecord, MentionScopeType } from '@/lib/data/supabase/mention-mapping';
import { commApi } from '@/lib/communication-client';

const MENTIONS_KEY = ['communication-mentions'];

export default function MentionMappingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | MentionScopeType>('all');

  const {
    data: mentions = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: MENTIONS_KEY,
    queryFn: () => commApi<MentionMappingRecord[]>('/api/communication/mentions'),
    staleTime: 30 * 1000,
  });
  const error = queryError ? (queryError as Error).message || 'Gagal memuat data mapping mention' : null;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    scope_type: MentionScopeType;
    scope_key: string;
    pic_name: string;
    role: string;
    feishu_open_id: string;
    feishu_user_id: string;
    phone: string;
    is_active: boolean;
  }>({
    scope_type: 'kecamatan',
    scope_key: '',
    pic_name: '',
    role: 'Admin DP',
    feishu_open_id: '',
    feishu_user_id: '',
    phone: '',
    is_active: true,
  });

  // Validation / Test Mention State
  const [validatingOpenId, setValidatingOpenId] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid?: boolean;
    status?: string;
    message?: string;
  } | null>(null);

  // Bulk paste input
  const [bulkInput, setBulkInput] = useState('');

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filteredMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (scopeFilter !== 'all' && m.scope_type !== scopeFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          m.scope_key.toLowerCase().includes(s) ||
          m.pic_name.toLowerCase().includes(s) ||
          (m.role && m.role.toLowerCase().includes(s)) ||
          (m.feishu_open_id && m.feishu_open_id.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [mentions, scopeFilter, search]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      scope_type: scopeFilter !== 'all' ? scopeFilter : 'kecamatan',
      scope_key: '',
      pic_name: '',
      role: 'Admin DP',
      feishu_open_id: '',
      feishu_user_id: '',
      phone: '',
      is_active: true,
    });
    setValidationResult(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MentionMappingRecord) => {
    setEditingId(item.id);
    setFormData({
      scope_type: item.scope_type,
      scope_key: item.scope_key,
      pic_name: item.pic_name,
      role: item.role || 'Admin DP',
      feishu_open_id: item.feishu_open_id || '',
      feishu_user_id: item.feishu_user_id || '',
      phone: item.phone || '',
      is_active: item.is_active,
    });
    setValidationResult(
      item.feishu_open_id
        ? { valid: true, status: 'valid', message: 'Open ID tersimpan' }
        : null
    );
    setIsModalOpen(true);
  };

  const createMut = useMutation({
    mutationFn: (payload: typeof formData) =>
      commApi('/api/communication/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      showToast('Mention mapping baru berhasil ditambahkan');
      setIsModalOpen(false);
      qc.invalidateQueries({ queryKey: MENTIONS_KEY });
    },
    onError: (err: Error) => showToast(err.message || 'Gagal menambahkan', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<typeof formData> }) =>
      commApi(`/api/communication/mentions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      showToast('Mention mapping berhasil diperbarui');
      setIsModalOpen(false);
      qc.invalidateQueries({ queryKey: MENTIONS_KEY });
    },
    onError: (err: Error) => showToast(err.message || 'Gagal menyimpan', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commApi(`/api/communication/mentions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showToast('Mapping berhasil dihapus');
      qc.invalidateQueries({ queryKey: MENTIONS_KEY });
    },
    onError: (err: Error) => showToast(err.message || 'Gagal menghapus', 'error'),
  });

  const toggleActiveMut = useMutation({
    mutationFn: (item: MentionMappingRecord) =>
      commApi(`/api/communication/mentions/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      }),
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: MENTIONS_KEY });
      const previous = qc.getQueryData<MentionMappingRecord[]>(MENTIONS_KEY);
      qc.setQueryData<MentionMappingRecord[]>(MENTIONS_KEY, (prev) =>
        (prev ?? []).map((m) => (m.id === item.id ? { ...m, is_active: !m.is_active } : m))
      );
      return { previous };
    },
    onSuccess: (_data, item) => showToast(`Status mention ${item.pic_name} diubah`),
    onError: (_err, _item, ctx) => {
      if (ctx?.previous) qc.setQueryData(MENTIONS_KEY, ctx.previous);
      showToast('Gagal mengubah status', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: MENTIONS_KEY }),
  });

  const bulkImportMut = useMutation({
    mutationFn: (items: any[]) =>
      commApi<any[]>('/api/communication/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, items }),
      }),
    onSuccess: (data, items) => {
      showToast(`${(data && data.length) || items.length} mapping berhasil diimpor!`);
      setIsBulkModalOpen(false);
      setBulkInput('');
      qc.invalidateQueries({ queryKey: MENTIONS_KEY });
    },
    onError: (err: Error) => showToast(err.message || 'Gagal mengimpor', 'error'),
  });

  const handleValidateOpenId = async () => {
    if (!formData.feishu_open_id.trim()) {
      setValidationResult({ valid: false, message: 'Masukkan Open ID terlebih dahulu' });
      return;
    }
    setValidatingOpenId(true);
    setValidationResult(null);
    try {
      const data = await commApi<{ valid: boolean; status?: string; message?: string }>(
        '/api/communication/mentions/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ open_id: formData.feishu_open_id }),
        }
      );
      setValidationResult({
        valid: data.valid,
        status: data.status,
        message: data.message || (data.valid ? 'Open ID valid' : 'Format Open ID tidak valid'),
      });
    } catch (err: any) {
      setValidationResult({ valid: false, message: err.message || 'Gagal memverifikasi Open ID' });
    } finally {
      setValidatingOpenId(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.scope_key.trim() || !formData.pic_name.trim()) {
      showToast('Wilayah / Key dan Nama PIC wajib diisi', 'error');
      return;
    }

    if (editingId) {
      updateMut.mutate({ id: editingId, payload: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Hapus mapping mention untuk "${name}"?`)) return;
    deleteMut.mutate(id);
  };

  const handleToggleActive = (item: MentionMappingRecord) => {
    toggleActiveMut.mutate(item);
  };

  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.trim().split('\n');
    const items: any[] = [];

    for (const line of lines) {
      // format: Key, PIC, OpenID, Role, Scope
      // cth: BATANG, Agus Supriyanto, ou_123, Admin DP, kecamatan
      // or tab-separated from Excel
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length >= 2) {
        const key = parts[0]?.trim();
        const pic = parts[1]?.trim();
        const openId = parts[2]?.trim() || '';
        const role = parts[3]?.trim() || 'Admin DP';
        const scope = (parts[4]?.trim().toLowerCase() as MentionScopeType) || 'kecamatan';

        if (key && pic) {
          items.push({
            scope_type: ['kecamatan', 'drop_point', 'kurir'].includes(scope) ? scope : 'kecamatan',
            scope_key: key.toUpperCase(),
            pic_name: pic,
            feishu_open_id: openId.startsWith('ou_') ? openId : null,
            role,
            is_active: true,
          });
        }
      }
    }

    if (items.length === 0) {
      showToast('Format baris tidak dikenali. Gunakan: Kecamatan/Key, Nama PIC, OpenID', 'error');
      return;
    }

    bulkImportMut.mutate(items);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold transition-all ${
            toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 rounded-xl text-[#E2231A] border border-red-100">
              <AtSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Mention Mapping PIC
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Kelola pemetaan PIC & Feishu Open ID untuk penugasan operasional otomatis pada Interactive Card.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Panduan Open ID</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Impor Bulk</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-bold text-white bg-[#E2231A] rounded-xl hover:bg-[#B81912] flex items-center gap-1.5 transition-colors shadow-sm shadow-red-200"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah PIC</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Scope Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              scopeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({mentions.length})
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('kecamatan')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              scopeFilter === 'kecamatan'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Kecamatan (INC)</span>
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('drop_point')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              scopeFilter === 'drop_point'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Drop Point</span>
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('kurir')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              scopeFilter === 'kurir'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Kurir (Delivery)</span>
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari wilayah, nama PIC, Open ID..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-300" />
            <p className="text-xs font-medium">Memuat data mapping mention...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">{error}</p>
            <button
              onClick={() => refetch()}
              className="text-xs font-bold text-red-600 hover:underline"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredMentions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-700">Belum ada data mention mapping</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tambahkan mapping wilayah atau kurir ke PIC Feishu agar Interactive Card dapat otomatis menyebut (@mention) penanggung jawab operasional.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 text-xs font-bold text-[#E2231A] bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
            >
              Tambah Mapping Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Tipe & Wilayah / Key</th>
                  <th className="py-3.5 px-4">Nama PIC & Role</th>
                  <th className="py-3.5 px-4">Feishu Open ID & Tag Render</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMentions.map((item) => {
                  const hasOpenId = !!item.feishu_open_id && item.feishu_open_id.trim().length > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Scope & Key */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="font-extrabold text-slate-900 text-sm tracking-tight block">
                            {item.scope_key}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              item.scope_type === 'kecamatan'
                                ? 'bg-red-50 text-[#E2231A] border border-red-100'
                                : item.scope_type === 'kurir'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {item.scope_type === 'kecamatan' && <MapPin className="w-2.5 h-2.5" />}
                            {item.scope_type === 'kurir' && <Truck className="w-2.5 h-2.5" />}
                            {item.scope_type === 'drop_point' && <Building className="w-2.5 h-2.5" />}
                            {item.scope_type === 'kecamatan'
                              ? 'Kecamatan (INC)'
                              : item.scope_type === 'kurir'
                              ? 'Kurir Delivery'
                              : 'Drop Point'}
                          </span>
                        </div>
                      </td>

                      {/* PIC Name & Role */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 text-xs block">{item.pic_name}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.role || 'Admin DP'}
                          </span>
                        </div>
                      </td>

                      {/* Open ID & Mention Tag Preview */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {hasOpenId ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {item.feishu_open_id}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <AtSign className="w-2.5 h-2.5" />
                                {item.pic_name}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Tanpa Open ID (Fallback Text)
                              </span>
                              <span className="text-[11px] text-slate-500">@{item.pic_name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                            item.is_active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {item.is_active ? 'Aktif' : 'Non-Aktif'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Mapping"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.pic_name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-50 rounded-lg text-[#E2231A]">
                  <AtSign className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {editingId ? 'Edit Mapping Mention' : 'Tambah Mapping Mention PIC'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Scope Type */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Tipe Cakupan (Scope)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope_type: 'kecamatan' })}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formData.scope_type === 'kecamatan'
                        ? 'border-red-500 bg-red-50 text-[#E2231A]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Kecamatan (INC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope_type: 'kurir' })}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formData.scope_type === 'kurir'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Kurir Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scope_type: 'drop_point' })}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formData.scope_type === 'drop_point'
                        ? 'border-slate-800 bg-slate-100 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Drop Point
                  </button>
                </div>
              </div>

              {/* Scope Key */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  {formData.scope_type === 'kecamatan'
                    ? 'Nama Kecamatan Target (cth: BATANG, WARUNGASEM)'
                    : formData.scope_type === 'kurir'
                    ? 'Nama Kurir / Sprinter (cth: Andi, Rudi)'
                    : 'Kode Drop Point (cth: BATANG01)'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.scope_key}
                  onChange={(e) => setFormData({ ...formData, scope_key: e.target.value.toUpperCase() })}
                  placeholder={
                    formData.scope_type === 'kecamatan'
                      ? 'BATANG'
                      : formData.scope_type === 'kurir'
                      ? 'Andi'
                      : 'BATANG01'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-semibold uppercase tracking-wide"
                />
              </div>

              {/* PIC Name & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Nama Lengkap PIC</label>
                  <input
                    type="text"
                    required
                    value={formData.pic_name}
                    onChange={(e) => setFormData({ ...formData, pic_name: e.target.value })}
                    placeholder="Agus Supriyanto"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Jabatan / Role</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Admin DP Batang"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                  />
                </div>
              </div>

              {/* Feishu Open ID & Validation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 block">Feishu Open ID (Wajib untuk @tag aktif)</label>
                  <span className="text-[10px] text-slate-400 font-mono">Format: ou_xxxxxxxxxxxx</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.feishu_open_id}
                    onChange={(e) => {
                      setFormData({ ...formData, feishu_open_id: e.target.value.trim() });
                      setValidationResult(null);
                    }}
                    placeholder="ou_1234567890abcdef1234"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleValidateOpenId}
                    disabled={validatingOpenId || !formData.feishu_open_id.trim()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {validatingOpenId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span>Uji ID</span>
                  </button>
                </div>

                {validationResult && (
                  <div
                    className={`mt-1.5 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                      validationResult.valid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    )}
                    <span>{validationResult.message}</span>
                  </div>
                )}
              </div>

              {/* Status Toggle */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="font-semibold text-slate-700">Aktifkan untuk Penugasan</span>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#E2231A] hover:bg-[#B81912] rounded-xl transition-colors shadow-sm"
                >
                  {editingId ? 'Perbarui Mapping' : 'Simpan Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-800">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Impor Bulk Mention Mapping
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Tempel data dari Excel atau CSV. Format baris (pisahkan dengan koma atau tab):
                <br />
                <code className="block mt-1.5 p-2 bg-slate-100 rounded-lg text-[11px] font-mono text-slate-800">
                  Wilayah / Key, Nama PIC, Open ID (opsional), Role, Scope (kecamatan / kurir / drop_point)
                </code>
              </p>

              <textarea
                rows={7}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="BATANG, Agus Supriyanto, ou_demo_batang_01, Admin DP Batang, kecamatan&#10;WARUNGASEM, Dimas Prasetyo, ou_demo_warungasem_01, Admin DP Warungasem, kecamatan&#10;Andi, Andi Setiawan, ou_demo_kurir_andi, Sprinter, kurir"
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono text-xs"
              />

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={!bulkInput.trim()}
                  className="px-5 py-2 font-bold text-white bg-[#E2231A] hover:bg-[#B81912] rounded-xl transition-colors disabled:opacity-50"
                >
                  Mulai Impor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open ID Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Cara Mendapatkan Feishu Open ID
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900 space-y-1">
                <span className="font-bold block">Apa itu Feishu Open ID?</span>
                <p className="text-[11px]">
                  Open ID adalah identitas unik akun Feishu (cth: <code className="font-mono bg-blue-100/70 px-1 rounded">ou_123456...</code>) yang diperlukan agar notifikasi Interactive Card dapat langsung men-tag/mention orang yang bersangkutan di dalam Group.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 block">Langkah Mendapatkan Open ID:</span>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
                  <li>Buka aplikasi Feishu Desktop atau Web.</li>
                  <li>Buka profil PIC yang ingin di-tag.</li>
                  <li>Atau Administrator dapat mengunduh daftar Open ID dari Feishu Admin Console &gt; Contacts &gt; Member List.</li>
                  <li>Salin nilai Open ID (diawali dengan <code className="font-mono font-bold text-slate-900">ou_</code>) dan simpan pada form mapping di atas.</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1 text-[11px]">
                <span className="font-bold text-slate-800 block">Bagaimana jika Open ID belum ada?</span>
                <p>
                  Sistem tetap berjalan normal! Jika Open ID kosong, kartu akan otomatis menampilkan nama sebagai teks mention standar (cth: <code className="font-mono">@Agus</code>) tanpa merusak tampilan kartu.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="px-4 py-2 font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800"
                >
                  Saya Mengerti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
