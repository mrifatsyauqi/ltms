'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelsTopLeft,
  Plus,
  Search,
  CheckCircle2,
  Copy,
  Archive,
  RotateCcw,
  History,
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
} from 'lucide-react';
import type { CardTemplateRecord, CardTemplateVersionRecord } from '@/lib/data/supabase/communication-config';
import type { StarterPreset } from '@/services/communication/configuration/template-presets';
import type { VisualCardBlocksConfig, CardTheme, KpiGridStyle } from '@/services/communication/configuration/template.types';
import { MessageTemplateEngine } from '@/services/communication/configuration/message-template.engine';

const THEMES: Array<{ id: CardTheme; name: string; bgClass: string; hex: string }> = [
  { id: 'red', name: 'J&T Red', bgClass: 'bg-[#E2231A]', hex: '#E2231A' },
  { id: 'dark', name: 'Dark Slate', bgClass: 'bg-slate-800', hex: '#1E293B' },
  { id: 'blue', name: 'Royal Blue', bgClass: 'bg-blue-600', hex: '#2563EB' },
  { id: 'green', name: 'Emerald Green', bgClass: 'bg-emerald-600', hex: '#059669' },
];

const DEFAULT_BLOCKS_CONFIG: VisualCardBlocksConfig = {
  title: 'LTMS • Monitoring Report {{city}}',
  theme: 'red',
  showLogo: true,
  showSummary: true,
  showKpiGrid: true,
  kpiStyle: '4_column',
  showTopKecamatan: true,
  topKecamatanLimit: 5,
  showImage: true,
  showFooter: true,
  footerText: 'Logistics Traceability & Monitoring System (LTMS)',
  actionButton: 'open_dashboard',
};

export default function CardTemplatesPage() {
  const [templates, setTemplates] = useState<CardTemplateRecord[]>([]);
  const [presets, setPresets] = useState<StarterPreset[]>([]);
  const [dummyContext, setDummyContext] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'archived'>('active');

  // Modals
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [activeVersions, setActiveVersions] = useState<CardTemplateVersionRecord[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');

  // Builder Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moduleVal, setModuleVal] = useState('monitoring_inc');
  const [templateName, setTemplateName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [blocksConfig, setBlocksConfig] = useState<VisualCardBlocksConfig>(DEFAULT_BLOCKS_CONFIG);

  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'dummy' | 'real'>('dummy');

  // Load Presets & Templates
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [presetRes, tplRes] = await Promise.all([
          fetch('/api/communication/templates/presets').then((r) => r.json()),
          fetch('/api/communication/templates/card').then((r) => r.json()),
        ]);

        if (presetRes.ok) {
          setPresets(presetRes.presets || []);
          setDummyContext(presetRes.dummyContext || {});
        }
        if (tplRes.ok) {
          setTemplates(tplRes.data || []);
        }
      } catch (err) {
        console.error('Failed to load card templates:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  const refreshTemplates = async () => {
    try {
      const res = await fetch(`/api/communication/templates/card?status=${selectedStatus}`);
      const json = await res.json();
      if (json.ok) setTemplates(json.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshTemplates();
  }, [selectedStatus]);

  // Open Builder from Preset
  const handleSelectPreset = (preset: StarterPreset | null) => {
    setPresetModalOpen(false);
    setEditingId(null);
    if (preset) {
      setModuleVal(preset.module);
      setTemplateName(`Kartu ${preset.name}`);
      setBlocksConfig(preset.blocksConfig);
      setIsDefault(false);
      setVersionNote('Template awal dari preset');
    } else {
      setModuleVal('monitoring_inc');
      setTemplateName('Kartu Interaktif Baru');
      setBlocksConfig(DEFAULT_BLOCKS_CONFIG);
      setIsDefault(false);
      setVersionNote('Initial version');
    }
    setBuilderOpen(true);
  };

  // Open Edit Builder
  const handleOpenEdit = (tpl: CardTemplateRecord) => {
    setEditingId(tpl.id);
    setModuleVal(tpl.module);
    setTemplateName(tpl.template_name);
    setBlocksConfig(tpl.blocks_config as VisualCardBlocksConfig);
    setIsDefault(tpl.is_default);
    setVersionNote('');
    setBuilderOpen(true);
  };

  // Save Card Template
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    try {
      setSaving(true);
      const url = '/api/communication/templates/card';
      const method = editingId ? 'PUT' : 'POST';
      const payload = {
        id: editingId || undefined,
        module: moduleVal,
        template_name: templateName,
        blocks_config: blocksConfig,
        is_default: isDefault,
        version_note: versionNote || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.ok) {
        setBuilderOpen(false);
        await refreshTemplates();
      } else {
        alert(json.error || 'Gagal menyimpan template');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setSaving(false);
    }
  };

  // Archive / Restore
  const handleToggleArchive = async (tpl: CardTemplateRecord) => {
    const isArchiving = tpl.status === 'active';
    const action = isArchiving ? 'archive' : 'restore';
    if (
      !confirm(
        isArchiving
          ? `Arsipkan template "${tpl.template_name}"?`
          : `Aktifkan kembali template "${tpl.template_name}"?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/communication/templates/card/${tpl.id}/${action}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) refreshTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  // Duplicate
  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/communication/templates/card/${id}/duplicate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) refreshTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  // Set Default
  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/communication/templates/card/${id}/set-default`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) refreshTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  // View Versions
  const handleViewVersions = async (tpl: CardTemplateRecord) => {
    setSelectedTemplateName(tpl.template_name);
    setVersionModalOpen(true);
    setVersionLoading(true);
    try {
      const res = await fetch(`/api/communication/templates/card/${tpl.id}/versions`);
      const json = await res.json();
      if (json.ok) setActiveVersions(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setVersionLoading(false);
    }
  };

  // Filtered Templates
  const filteredTemplates = templates.filter((tpl) => {
    const matchSearch = tpl.template_name.toLowerCase().includes(search.toLowerCase());
    const matchModule = selectedModule === 'all' || tpl.module === selectedModule;
    return matchSearch && matchModule;
  });

  const normalizedCtx = MessageTemplateEngine.normalizeContext(dummyContext);
  const renderedTitle = MessageTemplateEngine.render(blocksConfig.title, normalizedCtx);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">
            <PanelsTopLeft className="w-4 h-4" />
            Communication Center
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Card Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Desain tata letak Feishu Interactive Card dengan Visual Card Builder modular tanpa coding JSON.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setPresetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E2231A] hover:bg-[#c91d15] text-white text-sm font-semibold rounded-lg shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Buat Desain Kartu
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Semua Modul' },
            { id: 'monitoring_inc', label: 'Monitoring INC' },
            { id: 'monitoring_delivery', label: 'Delivery' },
            { id: 'longtail', label: 'Long Tail' },
            { id: 'dashboard', label: 'Dashboard' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedModule(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedModule === tab.id
                  ? 'bg-slate-900 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                selectedStatus === 'active'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Aktif
            </button>
            <button
              onClick={() => setSelectedStatus('archived')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                selectedStatus === 'archived'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Diarsipkan
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari template kartu..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Card Template Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">Memuat template kartu interaktif...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <PanelsTopLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Belum ada template kartu</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Gunakan Starter Preset Visual Card untuk membuat kartu laporan profesional dalam 1 klik.
          </p>
          <button
            onClick={() => setPresetModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Pilih Starter Preset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => {
            const config = tpl.blocks_config as VisualCardBlocksConfig;
            const themeObj = THEMES.find((t) => t.id === config?.theme) || THEMES[0];

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Card Header Color Bar */}
                  <div className={`h-2.5 w-full ${themeObj.bgClass}`} />

                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {tpl.module.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            {tpl.version}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: themeObj.hex }}
                            />
                            {themeObj.name}
                          </span>
                          {tpl.is_default && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              Default
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-base mt-2 line-clamp-1">
                          {tpl.template_name}
                        </h3>
                      </div>

                      {!tpl.is_default && tpl.status === 'active' && (
                        <button
                          onClick={() => handleSetDefault(tpl.id)}
                          title="Jadikan template kartu default"
                          className="text-xs text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-slate-50"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Features Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {config?.showSummary && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-100">
                          Wilayah & Waktu
                        </span>
                      )}
                      {config?.showKpiGrid && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-100">
                          Grid KPI ({config.kpiStyle === '4_column' ? '4 Kolom' : '2 Kolom'})
                        </span>
                      )}
                      {config?.showTopKecamatan && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-100">
                          Top {config.topKecamatanLimit || 5} Kecamatan
                        </span>
                      )}
                      {config?.showImage && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-100">
                          Bukti Gambar
                        </span>
                      )}
                      {config?.actionButton === 'open_dashboard' && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-100">
                          Tombol Dashboard
                        </span>
                      )}
                    </div>

                    {tpl.version_note && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1 pt-1">
                        💬 {tpl.version_note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleViewVersions(tpl)}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium"
                  >
                    <History className="w-3.5 h-3.5" />
                    Riwayat
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDuplicate(tpl.id)}
                      title="Duplikasi Template"
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleArchive(tpl)}
                      title={tpl.status === 'active' ? 'Arsipkan Template' : 'Aktifkan Kembali'}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-white rounded-md transition-colors"
                    >
                      {tpl.status === 'active' ? (
                        <Archive className="w-3.5 h-3.5" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(tpl)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-md shadow-2xs"
                    >
                      Buka Builder
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Starter Preset Picker */}
      <AnimatePresence>
        {presetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Pilih Desain Starter Preset
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mulai dengan tata letak kartu Feishu yang telah dioptimalkan untuk operasional.
                  </p>
                </div>
                <button
                  onClick={() => setPresetModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="flex flex-col text-left p-4 rounded-xl border border-slate-200 hover:border-red-500 hover:ring-2 hover:ring-red-500/10 bg-white hover:bg-red-50/20 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 group-hover:bg-red-100 group-hover:text-red-700">
                        {preset.badge}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-red-600">
                      {preset.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </button>
                ))}

                <button
                  onClick={() => handleSelectPreset(null)}
                  className="flex flex-col justify-center items-center text-center p-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100 transition-all group"
                >
                  <PanelsTopLeft className="w-5 h-5 text-slate-400 mb-1" />
                  <h4 className="font-bold text-slate-700 text-sm">
                    Mulai Kartu Kosong
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Atur setiap blok secara manual
                  </p>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Visual Card Builder */}
      <AnimatePresence>
        {builderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Builder Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    <PanelsTopLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingId ? 'Edit Visual Card Template' : 'Visual Card Builder'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Sesuaikan komponen kartu di panel kiri; lihat tampilan Feishu Interactive Card di panel kanan secara instan.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setBuilderOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Builder Body: Left Controls (7 cols) + Right Card Mockup (5 cols) */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                {/* Left Controls (7 cols) */}
                <div className="lg:col-span-7 p-6 overflow-y-auto border-r border-slate-200 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Nama Template Kartu <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Contoh: Kartu Monitoring INC"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Modul Terkait
                      </label>
                      <select
                        value={moduleVal}
                        onChange={(e) => setModuleVal(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                      >
                        <option value="monitoring_inc">Monitoring INC</option>
                        <option value="monitoring_delivery">Monitoring Delivery</option>
                        <option value="longtail">Long Tail</option>
                        <option value="dashboard">Dashboard</option>
                        <option value="custom">Laporan Custom</option>
                      </select>
                    </div>
                  </div>

                  {/* Section 1: Header & Theme */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      1. Header & Tema Warna
                    </h4>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Judul Header Kartu
                      </label>
                      <input
                        type="text"
                        value={blocksConfig.title}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({ ...p, title: e.target.value }))
                        }
                        placeholder="LTMS • Monitoring Report {{city}}"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-2">
                        Pilihan Tema Header Feishu
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {THEMES.map((theme) => {
                          const isSelected = blocksConfig.theme === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() =>
                                setBlocksConfig((p) => ({ ...p, theme: theme.id }))
                              }
                              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                isSelected
                                  ? 'border-slate-900 bg-white ring-2 ring-slate-900/10 shadow-xs'
                                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: theme.hex }}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              <span className="truncate">{theme.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Summary Block */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="summary_check"
                        className="text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer"
                      >
                        2. Blok Ringkasan (Wilayah & Waktu)
                      </label>
                      <input
                        type="checkbox"
                        id="summary_check"
                        checked={blocksConfig.showSummary}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({ ...p, showSummary: e.target.checked }))
                        }
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Menampilkan target kota/cabang dan tanggal/jam update laporan secara otomatis.
                    </p>
                  </div>

                  {/* Section 3: KPI Statistics Grid */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="kpi_check"
                        className="text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer"
                      >
                        3. Grid Statistik KPI
                      </label>
                      <input
                        type="checkbox"
                        id="kpi_check"
                        checked={blocksConfig.showKpiGrid}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({ ...p, showKpiGrid: e.target.checked }))
                        }
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                    </div>

                    {blocksConfig.showKpiGrid && (
                      <div className="pt-2 border-t border-slate-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-2">
                          Gaya Tata Letak KPI
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            {
                              id: '4_column',
                              label: '4 Kolom Sejajar',
                              desc: 'Total, Belum TTD, Lewat SLA, Progress',
                            },
                            {
                              id: '2_column',
                              label: '2 Kolom Ringkas',
                              desc: '2 Baris x 2 Kolom (Cocok untuk Mobile)',
                            },
                          ].map((style) => (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() =>
                                setBlocksConfig((p) => ({
                                  ...p,
                                  kpiStyle: style.id as KpiGridStyle,
                                }))
                              }
                              className={`p-3 text-left rounded-lg border text-xs transition-all ${
                                blocksConfig.kpiStyle === style.id
                                  ? 'border-red-600 bg-white ring-2 ring-red-500/10 font-semibold'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <div className="font-bold text-slate-900">{style.label}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {style.desc}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Top Kecamatan */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="kecamatan_check"
                        className="text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer"
                      >
                        4. Rincian Top Kecamatan
                      </label>
                      <input
                        type="checkbox"
                        id="kecamatan_check"
                        checked={blocksConfig.showTopKecamatan}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({
                            ...p,
                            showTopKecamatan: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                    </div>

                    {blocksConfig.showTopKecamatan && (
                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Batas Maksimal Kecamatan
                        </span>
                        <div className="flex items-center gap-1.5">
                          {([5, 10, 15] as const).map((limit) => (
                            <button
                              key={limit}
                              type="button"
                              onClick={() =>
                                setBlocksConfig((p) => ({
                                  ...p,
                                  topKecamatanLimit: limit,
                                }))
                              }
                              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                blocksConfig.topKecamatanLimit === limit
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Top {limit}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 5: Bukti Gambar HD */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="image_check"
                        className="text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer"
                      >
                        5. Bukti Gambar HD Otomatis
                      </label>
                      <input
                        type="checkbox"
                        id="image_check"
                        checked={blocksConfig.showImage}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({ ...p, showImage: e.target.checked }))
                        }
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Menyematkan tangkapan layar monitoring resmi di dalam badan kartu Feishu.
                    </p>
                  </div>

                  {/* Section 6: Action Button */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      6. Action Button Terkelola
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setBlocksConfig((p) => ({ ...p, actionButton: 'none' }))
                        }
                        className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                          blocksConfig.actionButton === 'none'
                            ? 'border-slate-900 bg-white ring-2 ring-slate-900/10 font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Tidak Ada Tombol
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBlocksConfig((p) => ({ ...p, actionButton: 'open_dashboard' }))
                        }
                        className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                          blocksConfig.actionButton === 'open_dashboard'
                            ? 'border-red-600 bg-white ring-2 ring-red-500/10 font-bold text-red-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        🚀 Buka Dashboard LTMS
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      * URL tautan dikelola aman oleh sistem backend (tanpa input URL manual).
                    </p>
                  </div>

                  {/* Section 7: Footer */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="footer_check"
                        className="text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer"
                      >
                        7. Teks Catatan Footer
                      </label>
                      <input
                        type="checkbox"
                        id="footer_check"
                        checked={blocksConfig.showFooter}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({ ...p, showFooter: e.target.checked }))
                        }
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                    </div>

                    {blocksConfig.showFooter && (
                      <input
                        type="text"
                        value={blocksConfig.footerText || ''}
                        onChange={(e) =>
                          setBlocksConfig((p) => ({ ...p, footerText: e.target.value }))
                        }
                        placeholder="Logistics Traceability & Monitoring System (LTMS)"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                      />
                    )}
                  </div>

                  {/* Version Note & Default Switch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Catatan Perubahan (Versi)
                      </label>
                      <input
                        type="text"
                        value={versionNote}
                        onChange={(e) => setVersionNote(e.target.value)}
                        placeholder="Contoh: Ubah Tema ke Dark & 4 Kolom"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-4">
                      <input
                        type="checkbox"
                        id="is_default_card_check"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                      <label
                        htmlFor="is_default_card_check"
                        className="text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        Jadikan Template Kartu Default
                      </label>
                    </div>
                  </div>

                  {/* Submit Bar */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setBuilderOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-5 py-2 bg-[#E2231A] hover:bg-[#c91d15] text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                    >
                      {saving ? 'Menyimpan...' : 'Simpan Desain Kartu'}
                    </button>
                  </div>
                </div>

                {/* Right Interactive Card Mockup (5 cols) */}
                <div className="lg:col-span-5 bg-slate-100/70 p-6 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Eye className="w-4 h-4 text-slate-500" />
                        Feishu Card Mockup (Live)
                      </div>

                      {/* Preview Mode Selector */}
                      <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setPreviewMode('dummy')}
                          className={`px-2.5 py-0.5 rounded font-medium ${
                            previewMode === 'dummy'
                              ? 'bg-slate-800 text-white font-semibold shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Data Dummy
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('real')}
                          className={`px-2.5 py-0.5 rounded font-medium ${
                            previewMode === 'real'
                              ? 'bg-slate-800 text-white font-semibold shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Data Saat Ini
                        </button>
                      </div>
                    </div>

                    {/* FEISHU CARD UI MOCKUP CONTAINER */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-300 shadow-md overflow-hidden flex flex-col font-sans">
                      {/* Card Header Bar with Selected Theme */}
                      <div
                        className={`px-4 py-3.5 text-white flex items-center justify-between ${
                          THEMES.find((t) => t.id === blocksConfig.theme)?.bgClass ||
                          'bg-[#E2231A]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm tracking-tight line-clamp-1">
                            {renderedTitle}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs text-slate-800">
                        {/* Summary Block */}
                        {blocksConfig.showSummary && (
                          <div className="space-y-1">
                            <p className="text-[11px] text-slate-600">
                              📌 <strong>Target Wilayah:</strong> <strong>{normalizedCtx.city}</strong>
                            </p>
                            <p className="text-[11px] text-slate-600">
                              ⏰ <strong>Update:</strong> {normalizedCtx.generated_date} {normalizedCtx.generated_time}
                            </p>
                          </div>
                        )}

                        {/* KPI Grid Block */}
                        {blocksConfig.showKpiGrid && (
                          <>
                            <div className="h-px bg-slate-100 my-2" />
                            {blocksConfig.kpiStyle === '4_column' ? (
                              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                                <div>
                                  <div className="text-[10px] text-slate-400">Total</div>
                                  <div className="font-bold text-xs text-slate-800">
                                    {normalizedCtx.total_package}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">Belum</div>
                                  <div className="font-bold text-xs text-red-600">
                                    {normalizedCtx.pending_package}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">Late</div>
                                  <div className="font-bold text-xs text-red-600">
                                    {normalizedCtx.over_sla}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">SLA</div>
                                  <div className="font-bold text-xs text-slate-900">
                                    {normalizedCtx.progress}%
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <div className="space-y-1">
                                  <div className="text-[11px]">
                                    📦 <strong>Total:</strong> {normalizedCtx.total_package}
                                  </div>
                                  <div className="text-[11px]">
                                    ⏳ <strong>Belum:</strong>{' '}
                                    <span className="text-red-600 font-bold">
                                      {normalizedCtx.pending_package}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[11px]">
                                    🚨 <strong>Late:</strong>{' '}
                                    <span className="text-red-600 font-bold">
                                      {normalizedCtx.over_sla}
                                    </span>
                                  </div>
                                  <div className="text-[11px]">
                                    📈 <strong>SLA:</strong>{' '}
                                    <strong>{normalizedCtx.progress}%</strong>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Top Kecamatan Block */}
                        {blocksConfig.showTopKecamatan && (
                          <>
                            <div className="h-px bg-slate-100 my-2" />
                            <div className="space-y-1">
                              <div className="text-[11px] font-bold text-slate-700">
                                🔥 Top Kecamatan Tertinggi (Max {blocksConfig.topKecamatanLimit || 5}):
                              </div>
                              <div className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100">
                                {normalizedCtx.district_list
                                  .split('\n')
                                  .slice(0, blocksConfig.topKecamatanLimit || 5)
                                  .join('\n')}
                              </div>
                            </div>
                          </>
                        )}

                        {/* HD Proof Image Block */}
                        {blocksConfig.showImage && (
                          <>
                            <div className="h-px bg-slate-100 my-2" />
                            <div className="h-28 bg-slate-200/80 rounded-lg flex flex-col items-center justify-center text-slate-500 border border-slate-300 border-dashed">
                              <ImageIcon className="w-6 h-6 mb-1 text-slate-400" />
                              <span className="text-[11px] font-medium">
                                Bukti Tabel Monitoring HD ({normalizedCtx.city})
                              </span>
                            </div>
                          </>
                        )}

                        {/* Action Button */}
                        {blocksConfig.actionButton === 'open_dashboard' && (
                          <>
                            <div className="h-px bg-slate-100 my-2" />
                            <button
                              type="button"
                              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              🚀 Buka Dashboard LTMS
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </button>
                          </>
                        )}

                        {/* Footer Note */}
                        {blocksConfig.showFooter && (
                          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100">
                            {blocksConfig.footerText || normalizedCtx.footer}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-3 text-center">
                    Visualisasi kartu Feishu 2.0 yang dikirim langsung ke grup target.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Version History Modal */}
      <AnimatePresence>
        {versionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Riwayat Versi Kartu
                  </h2>
                  <p className="text-xs text-slate-500">{selectedTemplateName}</p>
                </div>
                <button
                  onClick={() => setVersionModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {versionLoading ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Memuat riwayat versi kartu...
                </div>
              ) : activeVersions.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Belum ada riwayat versi sebelumnya.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {activeVersions.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {v.version}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(v.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {v.note && (
                        <p className="text-[11px] text-slate-600 font-medium">
                          💬 {v.note}
                        </p>
                      )}
                      <div className="bg-white p-2 rounded border border-slate-100 text-[10px] text-slate-500 font-mono line-clamp-3">
                        {JSON.stringify(v.blocks_config)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
