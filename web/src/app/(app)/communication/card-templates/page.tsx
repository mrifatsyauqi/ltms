'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelsTopLeft,
  Plus,
  Search,
  CheckCircle2,
  Copy,
  Sparkles,
  Layers,
  ChevronRight,
  Eye,
  X,
  Star,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Check,
  Clock,
  Package,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Truck,
  Trash2,
  Settings,
  LayoutGrid,
  Send,
  AtSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CardTemplateRecord, FeishuGroupConfigRecord } from '@/lib/data/supabase/communication-config';
import type { StarterPreset } from '@/services/communication/configuration/template-presets';
import { STARTER_PRESETS, OFFICIAL_VARIABLES } from '@/services/communication/configuration/template-presets';
import type {
  VisualCardBlocksConfig,
  CardTheme,
  CardKpiItem,
} from '@/services/communication/configuration/template.types';
import { InteractiveCardPreview } from '@/components/communication/interactive-card-preview';
import { commApi, compileCardPreview, useDebouncedValue } from '@/lib/communication-client';

const THEMES: Array<{ id: CardTheme; name: string; bgClass: string; hex: string }> = [
  { id: 'red', name: 'J&T Red (Utama)', bgClass: 'bg-[#E2231A]', hex: '#E2231A' },
  { id: 'dark', name: 'Dark Slate (Delivery)', bgClass: 'bg-slate-800', hex: '#1E293B' },
  { id: 'blue', name: 'Royal Blue', bgClass: 'bg-blue-600', hex: '#2563EB' },
  { id: 'green', name: 'Emerald Green', bgClass: 'bg-emerald-600', hex: '#059669' },
];

// Mock variable context used for Live Preview in the Builder (Decision #9's
// Mock Data mode). Kept identical to the Send Test payload so switching
// between preview and test-send never changes the rendered layout.
const MOCK_PREVIEW_VARIABLES = {
  pickup_dp: 'BATANG01',
  target_city: 'KOTA BATANG',
  drop_point: 'BATANG01',
  total_inc: '14.942',
  clear_ttd: '14.816',
  pending_ttd: '72',
  over_sla: '54',
  sla_percentage: '99.1',
  total_delivery: '3.240',
  delivered: '3.198',
  pending_delivery: '42',
  delivery_sla: '98.0',
  last_scan_time: '08:21 WIB',
  last_scan_awb: 'JT1234567890',
  last_scan_status: 'Delivery',
  generated_at: new Date().toLocaleString('id-ID'),
  subdistricts: [
    { name: 'BATANG', count: '10 AWB', picName: 'Agus Supriyanto' },
    { name: 'WARUNGASEM', count: '8 AWB', picName: 'Dimas Prasetyo' },
    { name: 'LIMPUNG', count: '6 AWB', picName: 'Rian Hidayat' },
    { name: 'BANDAR', count: '5 AWB', picName: 'Arif Munandar' },
  ],
  kurirList: [
    { name: 'Andi Setiawan', count: '12 Paket' },
    { name: 'Rudi Hermawan', count: '8 Paket' },
  ],
};

const TEMPLATES_KEY = ['communication-card-templates'];
const GROUPS_KEY = ['communication-groups'];

export default function CardTemplatesPage() {
  const qc = useQueryClient();

  const { data: templates = [], isLoading: loading, refetch: refetchTemplates } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => commApi<CardTemplateRecord[]>('/api/communication/card-templates'),
    staleTime: 30 * 1000,
  });

  const { data: groups = [] } = useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => commApi<FeishuGroupConfigRecord[]>('/api/communication/groups'),
    staleTime: 30 * 1000,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CardTemplateRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    module: string;
    blocks_config: VisualCardBlocksConfig;
    change_summary: string;
  }>({
    name: '',
    description: '',
    module: 'monitoring_inc',
    blocks_config: STARTER_PRESETS[0].blocksConfig,
    change_summary: 'Initial update',
  });

  // Accordion Sections in Builder
  const [openSections, setOpenSections] = useState({
    header: true,
    lastScan: true,
    kpiGrid: true,
    assignment: true,
    screenshot: true,
    actionButton: true,
    footer: true,
  });

  // Test Send State
  const [testChatId, setTestChatId] = useState('');

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filteredTemplates = templates.filter((t) => {
    const name = (t as any).template_name || (t as any).name || '';
    const description = (t as any).version_note || (t as any).description || '';

    if (selectedModule !== 'all' && t.module !== selectedModule) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        name.toLowerCase().includes(s) ||
        description.toLowerCase().includes(s) ||
        t.module.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleOpenCreate = (preset?: StarterPreset) => {
    const p = preset || STARTER_PRESETS[0];
    setEditingTemplate(null);
    setFormData({
      name: p.name,
      description: p.description,
      module: p.module,
      blocks_config: JSON.parse(JSON.stringify(p.blocksConfig)),
      change_summary: 'Template dibuat dari preset ' + p.name,
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (t: CardTemplateRecord) => {
    setEditingTemplate(t);
    setFormData({
      name: (t as any).template_name || (t as any).name || '',
      description: (t as any).version_note || (t as any).description || '',
      module: t.module,
      blocks_config: JSON.parse(JSON.stringify(t.blocks_config)),
      change_summary: '',
    });
    setIsEditorOpen(true);
  };

  const createMut = useMutation({
    mutationFn: (payload: typeof formData) =>
      commApi('/api/communication/card-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      showToast('Template baru berhasil dibuat');
      setIsEditorOpen(false);
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
    onError: (err: Error) => showToast(err.message || 'Gagal membuat template', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof formData }) =>
      commApi(`/api/communication/card-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      showToast('Template berhasil diperbarui');
      setIsEditorOpen(false);
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
    onError: (err: Error) => showToast(err.message || 'Gagal menyimpan', 'error'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Nama template wajib diisi', 'error');
      return;
    }

    if (editingTemplate) {
      updateMut.mutate({ id: editingTemplate.id, payload: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  const setDefaultMut = useMutation({
    mutationFn: (t: CardTemplateRecord) =>
      commApi(`/api/communication/card-templates/${t.id}/set-default`, { method: 'POST' }),
    onSuccess: (_data, t) => {
      const tName = (t as any).template_name || (t as any).name || '';
      showToast(`Template "${tName}" dijadikan template default ${t.module}`);
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
    onError: () => showToast('Gagal mengatur default', 'error'),
  });

  const handleToggleDefault = (t: CardTemplateRecord) => setDefaultMut.mutate(t);

  const deleteMut = useMutation({
    mutationFn: (t: CardTemplateRecord) =>
      commApi(`/api/communication/card-templates/${t.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showToast('Template berhasil dihapus');
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
    onError: () => showToast('Gagal menghapus template', 'error'),
  });

  const handleDelete = (t: CardTemplateRecord) => {
    const name = (t as any).template_name || (t as any).name || 'template ini';
    if (!confirm(`Yakin hapus "${name}"? Tindakan tidak bisa dibatalkan.`)) return;
    deleteMut.mutate(t);
  };

  const sendTestMut = useMutation({
    mutationFn: (chatId: string) =>
      commApi('/api/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'feishu',
          chatId,
          messageType: 'interactive_card',
          cardConfig: formData.blocks_config,
          data: { ...MOCK_PREVIEW_VARIABLES, module: formData.module },
        }),
      }),
    onSuccess: () => {
      showToast('Kartu berhasil dikirim ke group Feishu!');
      setIsTestSendOpen(false);
    },
    onError: (err: Error) => showToast(err.message || 'Gagal mengirim test card', 'error'),
  });

  const handleSendTestCard = () => {
    if (!testChatId) {
      showToast('Pilih group Feishu penerima', 'error');
      return;
    }
    sendTestMut.mutate(testChatId);
  };
  const sendingTest = sendTestMut.isPending;

  // Helper Form Modifiers
  const updateHeader = (fields: Partial<VisualCardBlocksConfig['header']>) => {
    setFormData((prev) => ({
      ...prev,
      blocks_config: {
        ...prev.blocks_config,
        header: {
          ...prev.blocks_config.header,
          ...fields,
        },
      },
    }));
  };

  const updateKpiItem = (index: number, fields: Partial<CardKpiItem>) => {
    setFormData((prev) => {
      const items = [...(prev.blocks_config.kpiGrid?.items || [])];
      items[index] = { ...items[index], ...fields };
      return {
        ...prev,
        blocks_config: {
          ...prev.blocks_config,
          kpiGrid: {
            ...prev.blocks_config.kpiGrid,
            items,
          },
        },
      };
    });
  };

  const addKpiItem = () => {
    setFormData((prev) => {
      const items = [...(prev.blocks_config.kpiGrid?.items || [])];
      items.push({
        id: String(Date.now()),
        label: 'Indikator Baru',
        valueTemplate: '0',
        color: 'default',
      });
      return {
        ...prev,
        blocks_config: {
          ...prev.blocks_config,
          kpiGrid: {
            ...prev.blocks_config.kpiGrid,
            items,
          },
        },
      };
    });
  };

  const removeKpiItem = (index: number) => {
    setFormData((prev) => {
      const items = [...(prev.blocks_config.kpiGrid?.items || [])];
      items.splice(index, 1);
      return {
        ...prev,
        blocks_config: {
          ...prev.blocks_config,
          kpiGrid: {
            ...prev.blocks_config.kpiGrid,
            items,
          },
        },
      };
    });
  };

  // Live Feishu Interactive Card Preview: debounce edits so the server
  // compiler (CardCompilerService, via CardRenderPipeline) isn't called on
  // every keystroke, then compile fresh JSON through the single render
  // pipeline shared with Share Dialog and History Preview.
  const debouncedBlocksConfig = useDebouncedValue(formData.blocks_config, 400);
  const { data: previewData, isFetching: isCompilingPreview } = useQuery({
    queryKey: ['communication-card-preview', 'builder', formData.module, debouncedBlocksConfig],
    queryFn: () =>
      compileCardPreview({
        module: formData.module,
        cardConfig: debouncedBlocksConfig,
        data: MOCK_PREVIEW_VARIABLES,
      }),
    enabled: isEditorOpen,
    staleTime: 10 * 1000,
  });

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
            <AlertTriangle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 rounded-xl text-[#E2231A] border border-red-100">
              <PanelsTopLeft className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Card Templates (Interactive Card Builder)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Desain kartu pengingat & penugasan operasional Feishu dengan Single Source of Truth compiler.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenCreate()}
            className="px-4 py-2 text-xs font-bold text-white bg-[#E2231A] rounded-xl hover:bg-[#B81912] flex items-center gap-1.5 transition-colors shadow-sm shadow-red-200"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Template Baru</span>
          </button>
        </div>
      </div>

      {/* Starter Presets Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STARTER_PRESETS.map((preset) => (
          <div
            key={preset.id}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-red-300 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-[#E2231A] border border-red-100">
                  {preset.badge}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#E2231A] transition-colors">
                {preset.name}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {preset.description}
              </p>
            </div>
            <div className="pt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleOpenCreate(preset)}
                className="text-xs font-bold text-[#E2231A] hover:underline flex items-center gap-1"
              >
                <span>Gunakan Preset</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedModule('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedModule === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Modul
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule('monitoring_inc')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedModule === 'monitoring_inc'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monitoring INC
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule('monitoring_delivery')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedModule === 'monitoring_delivery'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monitoring Delivery
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule('longtail')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedModule === 'longtail'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Long Tail
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama template..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
          <button
            type="button"
            onClick={() => refetchTemplates()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Templates Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            <p className="text-xs">Memuat template kartu...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <PanelsTopLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada template yang cocok</p>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan salah satu preset resmi di atas untuk membuat template pertama Anda.
            </p>
          </div>
        ) : (
          filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-red-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {t.module}
                    </span>
                    {t.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    v{(t as any).version || (t as any).current_version || '1.0'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {(t as any).template_name || (t as any).name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {(t as any).version_note || (t as any).description}
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Tema Header:</span>
                  <span className="font-bold capitalize">{t.blocks_config?.theme || 'Red'}</span>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleDefault(t)}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      t.is_default
                        ? 'text-amber-500 bg-amber-50'
                        : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                    }`}
                    title={t.is_default ? 'Template Default Aktif' : 'Set Sebagai Default'}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs"
                    title="Hapus Permanen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(t)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-[#E2231A] hover:text-white rounded-xl transition-colors"
                >
                  Edit Desain & Konten
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Visual Content Card Builder Modal (Full-featured Split Screen) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-xl text-[#E2231A] border border-red-100">
                  <PanelsTopLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {editingTemplate ? `Edit Template: ${formData.name}` : 'Card Content Builder'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Atur konten, warna, indikator KPI, dan konfigurasi mention secara visual.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTestSendOpen(true)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Kirim Uji Coba</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Body */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Column: Form & Configuration Accordions (7 cols) */}
              <div className="lg:col-span-7 overflow-y-auto p-4 sm:p-6 space-y-4 border-r border-slate-200 text-xs">
                {/* 1. General & Theme */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 text-sm block">Informasi Umum & Tema</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Nama Template</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Modul</label>
                      <select
                        value={formData.module}
                        onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium"
                      >
                        <option value="monitoring_inc">Monitoring INC</option>
                        <option value="monitoring_delivery">Monitoring Delivery</option>
                        <option value="longtail">Long Tail Alert</option>
                        <option value="dashboard">Ringkasan Dashboard</option>
                      </select>
                    </div>
                  </div>

                  {/* Theme Selector */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 block">Warna Header Card</label>
                    <div className="grid grid-cols-4 gap-2">
                      {THEMES.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              blocks_config: { ...prev.blocks_config, theme: th.id },
                            }))
                          }
                          className={`p-2 rounded-xl border flex items-center gap-2 font-semibold text-[11px] transition-all ${
                            formData.blocks_config.theme === th.id
                              ? 'border-red-500 bg-red-50 text-[#E2231A]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full ${th.bgClass}`} />
                          <span className="truncate">{th.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Header & Sub-Header Section */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setOpenSections({ ...openSections, header: !openSections.header })}
                  >
                    <span className="font-bold text-slate-800 text-sm">Header & Informasi Operasional</span>
                    {openSections.header ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>

                  {openSections.header && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700">Judul Utama (Title)</label>
                          <input
                            type="text"
                            value={formData.blocks_config.header?.title || ''}
                            onChange={(e) => updateHeader({ title: e.target.value })}
                            placeholder="📦 LTMS • Monitoring INC"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700">Sub-Judul (Subtitle)</label>
                          <input
                            type="text"
                            value={formData.blocks_config.header?.subtitle || ''}
                            onChange={(e) => updateHeader({ subtitle: e.target.value })}
                            placeholder="Intercity Outgoing Reminder"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none font-medium"
                          />
                        </div>
                      </div>

                      {/* Sub Header Information toggles & labels */}
                      <div className="p-3 bg-slate-50 rounded-xl space-y-2.5">
                        <span className="font-bold text-slate-700 block">Kolom Informasi Header</span>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="space-y-1">
                            <label className="text-slate-600 flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={formData.blocks_config.header?.showPickupDp ?? true}
                                onChange={(e) => updateHeader({ showPickupDp: e.target.checked })}
                                className="w-3.5 h-3.5 text-red-600 rounded border-slate-300"
                              />
                              <span>Label Kolom 1</span>
                            </label>
                            <input
                              type="text"
                              value={formData.blocks_config.header?.pickupDpLabel || 'Pickup DP'}
                              onChange={(e) => updateHeader({ pickupDpLabel: e.target.value })}
                              disabled={formData.blocks_config.header?.showPickupDp === false}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-600 flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={formData.blocks_config.header?.showTargetCity ?? true}
                                onChange={(e) => updateHeader({ showTargetCity: e.target.checked })}
                                className="w-3.5 h-3.5 text-red-600 rounded border-slate-300"
                              />
                              <span>Label Kolom 2</span>
                            </label>
                            <input
                              type="text"
                              value={formData.blocks_config.header?.targetCityLabel || 'Kota Tujuan'}
                              onChange={(e) => updateHeader({ targetCityLabel: e.target.value })}
                              disabled={formData.blocks_config.header?.showTargetCity === false}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-600 flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={formData.blocks_config.header?.showUpdate ?? true}
                                onChange={(e) => updateHeader({ showUpdate: e.target.checked })}
                                className="w-3.5 h-3.5 text-red-600 rounded border-slate-300"
                              />
                              <span>Label Kolom 3</span>
                            </label>
                            <input
                              type="text"
                              value={formData.blocks_config.header?.updateLabel || 'Generate'}
                              onChange={(e) => updateHeader({ updateLabel: e.target.value })}
                              disabled={formData.blocks_config.header?.showUpdate === false}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Ringkasan KPI Grid Section */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setOpenSections({ ...openSections, kpiGrid: !openSections.kpiGrid })}
                  >
                    <span className="font-bold text-slate-800 text-sm">Grid Indikator KPI</span>
                    {openSections.kpiGrid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>

                  {openSections.kpiGrid && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={formData.blocks_config.kpiGrid?.title || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              blocks_config: {
                                ...prev.blocks_config,
                                kpiGrid: { ...prev.blocks_config.kpiGrid, title: e.target.value },
                              },
                            }))
                          }
                          placeholder="📊 Ringkasan Monitoring"
                          className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold w-64"
                        />
                        <button
                          type="button"
                          onClick={addKpiItem}
                          className="px-3 py-1.5 bg-red-50 text-[#E2231A] font-bold rounded-xl flex items-center gap-1 hover:bg-red-100"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah KPI</span>
                        </button>
                      </div>

                      {/* KPI Items List */}
                      <div className="space-y-2">
                        {(formData.blocks_config.kpiGrid?.items || []).map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-12 gap-2 items-center"
                          >
                            <div className="col-span-4 space-y-1">
                              <input
                                type="text"
                                value={item.label}
                                onChange={(e) => updateKpiItem(idx, { label: e.target.value })}
                                placeholder="Nama Metrik"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
                              />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <input
                                type="text"
                                value={item.valueTemplate}
                                onChange={(e) => updateKpiItem(idx, { valueTemplate: e.target.value })}
                                placeholder="{{total_inc}}"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                              />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <select
                                value={item.color || 'default'}
                                onChange={(e) => updateKpiItem(idx, { color: e.target.value as any })}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
                              >
                                <option value="default">Default</option>
                                <option value="red">Merah (Alert)</option>
                                <option value="green">Hijau (Sukses)</option>
                              </select>
                            </div>
                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => removeKpiItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Operational Assignment Section */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => setOpenSections({ ...openSections, assignment: !openSections.assignment })}
                    >
                      <span className="font-bold text-slate-800 text-sm">
                        Penugasan Operasional & Mention PIC
                      </span>
                      {openSections.assignment ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={formData.blocks_config.subdistricts?.show ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            blocks_config: {
                              ...prev.blocks_config,
                              subdistricts: { ...prev.blocks_config.subdistricts!, show: e.target.checked },
                            },
                          }))
                        }
                        className="w-3.5 h-3.5 text-red-600 rounded border-slate-300"
                      />
                      <span>Tampilkan</span>
                    </label>
                  </div>

                  {openSections.assignment && (
                    <div className="space-y-3 pt-2">
                      <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-slate-700 leading-relaxed text-[11px]">
                        Bagian ini akan merender daftar wilayah / kurir secara dinamis dengan tag mention{' '}
                        <code className="font-mono font-bold text-red-600">&lt;at id="..."&gt;Nama PIC&lt;/at&gt;</code>{' '}
                        berdasarkan database Mention Mapping.
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700">Judul Blok Penugasan</label>
                          <input
                            type="text"
                            value={
                              formData.blocks_config.subdistricts?.title ||
                              formData.blocks_config.kurirFollowUp?.title ||
                              '📍 Kecamatan Tujuan'
                            }
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                blocks_config: {
                                  ...prev.blocks_config,
                                  subdistricts: {
                                    ...prev.blocks_config.subdistricts!,
                                    title: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700">Batas Maksimal Baris</label>
                          <select
                            value={formData.blocks_config.subdistricts?.maxItems || '10'}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                blocks_config: {
                                  ...prev.blocks_config,
                                  subdistricts: {
                                    ...prev.blocks_config.subdistricts!,
                                    maxItems: e.target.value as any,
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                          >
                            <option value="5">5 Item</option>
                            <option value="10">10 Item</option>
                            <option value="15">15 Item</option>
                            <option value="all">Tampilkan Semua</option>
                          </select>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="font-semibold text-slate-700">Gaya Tampilan List</label>
                          <select
                            value={formData.blocks_config.subdistricts?.listStyle || 'divided'}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                blocks_config: {
                                  ...prev.blocks_config,
                                  subdistricts: {
                                    ...prev.blocks_config.subdistricts!,
                                    listStyle: e.target.value as any,
                                  },
                                },
                              }))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                          >
                            <option value="divided">Terpisah Garis (default)</option>
                            <option value="numbered">Bernomor (1. Nama (jumlah) / mention di baris baru)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Action Button & Footer Note */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => setOpenSections({ ...openSections, actionButton: !openSections.actionButton })}
                    >
                      <span className="font-bold text-slate-800 text-sm">Tombol CTA & Catatan Kaki</span>
                      {openSections.actionButton ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={formData.blocks_config.actionButton?.enabled ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            blocks_config: {
                              ...prev.blocks_config,
                              actionButton: { ...prev.blocks_config.actionButton, enabled: e.target.checked },
                            },
                          }))
                        }
                        className="w-3.5 h-3.5 text-red-600 rounded border-slate-300"
                      />
                      <span>Tampilkan Tombol</span>
                    </label>
                  </div>

                  {openSections.actionButton && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">Teks Tombol Aksi</label>
                        <input
                          type="text"
                          value={formData.blocks_config.actionButton?.label || '🚀 Buka LTMS Dashboard'}
                          disabled={formData.blocks_config.actionButton?.enabled === false}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              blocks_config: {
                                ...prev.blocks_config,
                                actionButton: {
                                  ...prev.blocks_config.actionButton,
                                  label: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium disabled:opacity-40"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">Teks Footer Note</label>
                        <input
                          type="text"
                          value={formData.blocks_config.footer?.title || 'Generated Automatically by LTMS'}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              blocks_config: {
                                ...prev.blocks_config,
                                footer: { ...prev.blocks_config.footer, title: e.target.value, show: true },
                              },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Change Summary */}
                <div className="space-y-1 pt-2">
                  <label className="font-semibold text-slate-700">Ringkasan Perubahan Versi</label>
                  <input
                    type="text"
                    value={formData.change_summary}
                    onChange={(e) => setFormData({ ...formData, change_summary: e.target.value })}
                    placeholder="Contoh: Mengubah penataan warna KPI dan mention PIC"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              {/* Right Column: Live Pixel-Identical Preview (5 cols) */}
              <div className="lg:col-span-5 bg-slate-100 p-4 sm:p-6 overflow-y-auto flex flex-col items-center justify-start space-y-4">
                <div className="w-full flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                  <span>📱 Live Feishu Interactive Card Preview</span>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Single Source Compiler
                  </span>
                </div>

                <div className="w-full max-w-sm sticky top-0">
                  <InteractiveCardPreview
                    cardJson={previewData?.cardJson}
                    loading={isCompilingPreview && !previewData}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-slate-200 flex items-center justify-end gap-2.5 bg-white">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2 text-xs font-bold text-white bg-[#E2231A] hover:bg-[#B81912] rounded-xl transition-colors shadow-sm shadow-red-200"
              >
                {editingTemplate ? 'Simpan Perubahan' : 'Buat Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Send Modal */}
      {isTestSendOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Uji Coba Pengiriman Kartu</h3>
              </div>
              <button onClick={() => setIsTestSendOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Pilih group Feishu untuk mengirim kartu penugasan saat ini sebagai simulasi pesan real-time.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Pilih Group Feishu</label>
                <select
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="">-- Pilih Group --</option>
                  {groups.map((g) => (
                    <option key={g.chat_id} value={g.chat_id}>
                      {g.group_name} ({g.chat_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTestSendOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={sendingTest || !testChatId}
                  onClick={handleSendTestCard}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                >
                  {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Kirim Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
