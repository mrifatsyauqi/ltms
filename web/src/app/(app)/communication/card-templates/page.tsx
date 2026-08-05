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
  Clock,
  Package,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Truck,
  Trash2,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import type { CardTemplateRecord, CardTemplateVersionRecord } from '@/lib/data/supabase/communication-config';
import type { StarterPreset } from '@/services/communication/configuration/template-presets';
import type {
  VisualCardBlocksConfig,
  CardTheme,
  KpiGridStyle,
  CardKpiItem,
} from '@/services/communication/configuration/template.types';
import { MessageTemplateEngine } from '@/services/communication/configuration/message-template.engine';

const THEMES: Array<{ id: CardTheme; name: string; bgClass: string; hex: string }> = [
  { id: 'red', name: 'J&T Red', bgClass: 'bg-[#E2231A]', hex: '#E2231A' },
  { id: 'blue', name: 'Royal Blue', bgClass: 'bg-blue-600', hex: '#2563EB' },
  { id: 'dark', name: 'Dark Slate', bgClass: 'bg-slate-800', hex: '#1E293B' },
  { id: 'green', name: 'Emerald Green', bgClass: 'bg-emerald-600', hex: '#059669' },
];

const DEFAULT_INC_CONFIG: VisualCardBlocksConfig = {
  theme: 'red',
  header: {
    title: 'LTMS | Monitoring INC',
    subtitle: 'Intercity Outgoing Monitoring',
    pickupDpLabel: 'Pickup DP',
    pickupDpValue: '{{pickup_dp}}',
    targetCityLabel: 'Tujuan',
    targetCityValue: '{{target_city}}',
    updateLabel: 'Update',
    updateValue: '{{generated_at}}',
    showPickupDp: true,
    showTargetCity: true,
    showUpdate: true,
  },
  kpiGrid: {
    title: 'Ringkasan Monitoring INC',
    layout: 'horizontal_5',
    items: [
      { id: '1', label: 'Total AWB INC', valueTemplate: '{{total_inc}}', color: 'default', icon: 'package' },
      { id: '2', label: 'Clear TTD', valueTemplate: '{{clear_ttd}}', color: 'green', icon: 'check' },
      { id: '3', label: 'Belum TTD', valueTemplate: '{{pending_ttd}}', color: 'red', icon: 'clock' },
      { id: '4', label: 'AWB Melebihi SLA', valueTemplate: '{{over_sla}}', color: 'red', icon: 'alert' },
      { id: '5', label: 'Persentase SLA', valueTemplate: '{{sla_percentage}}%', color: 'default', icon: 'trend' },
    ],
  },
  subdistricts: {
    title: '📍 Kecamatan Tujuan',
    maxItems: '5',
    sortOrder: 'desc',
    show: true,
  },
  screenshot: {
    show: true,
    hdQuality: true,
  },
  footer: {
    title: 'LTMS',
    description: 'Long Tail Monitoring System\nGenerated Automatically',
    show: true,
  },
  actionButton: {
    label: '🚀 Buka Dashboard LTMS',
    url: 'https://ltms.jt-express.id',
    enabled: true,
  },
  // Compatibility fields
  title: 'LTMS | Monitoring INC',
  showLogo: true,
  showSummary: true,
  showKpiGrid: true,
  kpiStyle: 'horizontal_5',
  showTopKecamatan: true,
  topKecamatanLimit: 5,
  showImage: true,
  showFooter: true,
  footerText: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
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
  const [blocksConfig, setBlocksConfig] = useState<VisualCardBlocksConfig>(DEFAULT_INC_CONFIG);
  const [activeSection, setActiveSection] = useState<'header' | 'lastScan' | 'kpi' | 'subdistricts' | 'media' | 'footer' | 'action'>('header');

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

  // Normalize blocks config if loaded from legacy
  const normalizeConfig = (raw: any): VisualCardBlocksConfig => {
    if (!raw) return DEFAULT_INC_CONFIG;
    return {
      theme: raw.theme || 'red',
      header: raw.header || {
        title: raw.title || 'LTMS | Monitoring INC',
        subtitle: raw.subtitle || 'Intercity Outgoing Monitoring',
        pickupDpLabel: 'Pickup DP',
        pickupDpValue: '{{pickup_dp}}',
        targetCityLabel: 'Tujuan',
        targetCityValue: '{{target_city}}',
        updateLabel: 'Update',
        updateValue: '{{generated_at}}',
        showPickupDp: raw.showSummary ?? true,
        showTargetCity: raw.showSummary ?? true,
        showUpdate: raw.showSummary ?? true,
      },
      lastScan: raw.lastScan || {
        title: 'Last Scan',
        scanTimeLabel: 'Waktu Scan',
        scanTimeValue: '{{last_scan_time}}',
        awbLabel: 'AWB',
        awbValue: '{{last_scan_awb}}',
        statusLabel: 'Status',
        statusValue: '{{last_scan_status}}',
        fallbackText: 'Belum ada aktivitas scan hari ini.',
        show: false,
      },
      kpiGrid: raw.kpiGrid || {
        title: 'Ringkasan Monitoring INC',
        layout: (raw.kpiStyle as any) || 'horizontal_5',
        items: [
          { id: '1', label: 'Total AWB INC', valueTemplate: '{{total_inc}}', color: 'default', icon: 'package' },
          { id: '2', label: 'Clear TTD', valueTemplate: '{{clear_ttd}}', color: 'green', icon: 'check' },
          { id: '3', label: 'Belum TTD', valueTemplate: '{{pending_ttd}}', color: 'red', icon: 'clock' },
          { id: '4', label: 'AWB Melebihi SLA', valueTemplate: '{{over_sla}}', color: 'red', icon: 'alert' },
          { id: '5', label: 'Persentase SLA', valueTemplate: '{{sla_percentage}}%', color: 'default', icon: 'trend' },
        ],
      },
      subdistricts: raw.subdistricts || {
        title: '📍 Kecamatan Tujuan',
        maxItems: raw.topKecamatanLimit ? String(raw.topKecamatanLimit) : '5',
        sortOrder: 'desc',
        show: raw.showTopKecamatan ?? true,
      },
      screenshot: raw.screenshot || {
        show: raw.showImage ?? true,
        hdQuality: true,
      },
      footer: raw.footer || {
        title: 'LTMS',
        description: raw.footerText || 'Long Tail Monitoring System\nGenerated Automatically',
        show: raw.showFooter ?? true,
      },
      actionButton: raw.actionButton?.label
        ? raw.actionButton
        : {
            label: '🚀 Buka Dashboard LTMS',
            url: 'https://ltms.jt-express.id',
            enabled: raw.actionButton !== 'none',
          },
      title: raw.title || 'LTMS | Monitoring Report',
      showLogo: true,
      showSummary: raw.showSummary ?? true,
      showKpiGrid: raw.showKpiGrid ?? true,
      kpiStyle: raw.kpiStyle || 'horizontal_5',
      showTopKecamatan: raw.showTopKecamatan ?? true,
      topKecamatanLimit: raw.topKecamatanLimit || 5,
      showImage: raw.showImage ?? true,
      showFooter: raw.showFooter ?? true,
    };
  };

  // Open Builder from Preset
  const handleSelectPreset = (preset: StarterPreset | null) => {
    setPresetModalOpen(false);
    setEditingId(null);
    if (preset) {
      setModuleVal(preset.module);
      setTemplateName(`Kartu ${preset.name}`);
      setBlocksConfig(normalizeConfig(preset.blocksConfig));
      setIsDefault(false);
      setVersionNote('Template awal dari preset');
    } else {
      setModuleVal('monitoring_inc');
      setTemplateName('Kartu Interaktif Baru');
      setBlocksConfig(DEFAULT_INC_CONFIG);
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
    setBlocksConfig(normalizeConfig(tpl.blocks_config));
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
      const body = {
        id: editingId,
        module: moduleVal,
        template_name: templateName,
        blocks_config: blocksConfig,
        is_default: isDefault,
        version_note: versionNote || (editingId ? 'Pembaruan desain kartu' : 'Inisialisasi kartu'),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Gagal menyimpan template kartu');
      }

      setBuilderOpen(false);
      await refreshTemplates();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Archive / Restore
  const handleToggleArchive = async (tpl: CardTemplateRecord) => {
    const nextStatus = tpl.status === 'active' ? 'archived' : 'active';
    const confirmMsg =
      nextStatus === 'archived'
        ? `Arsipkan template "${tpl.template_name}"? Template tidak akan muncul di dialog pengiriman.`
        : `Pulihkan template "${tpl.template_name}" kembali ke status aktif?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/communication/templates/card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tpl.id,
          status: nextStatus,
          version_note: nextStatus === 'archived' ? 'Arsipkan template' : 'Pulihkan template',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error);
      await refreshTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Duplicate
  const handleDuplicate = async (tpl: CardTemplateRecord) => {
    try {
      const res = await fetch('/api/communication/templates/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: tpl.module,
          template_name: `${tpl.template_name} (Salinan)`,
          blocks_config: tpl.blocks_config,
          is_default: false,
          version_note: `Duplikasi dari ${tpl.template_name}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error);
      await refreshTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Version History
  const handleOpenVersions = async (tpl: CardTemplateRecord) => {
    setSelectedTemplateName(tpl.template_name);
    setVersionModalOpen(true);
    setVersionLoading(true);
    try {
      const res = await fetch(`/api/communication/templates/card/versions?id=${tpl.id}`);
      const json = await res.json();
      if (json.ok) {
        setActiveVersions(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVersionLoading(false);
    }
  };

  // Restore Version
  const handleRestoreVersion = async (v: CardTemplateVersionRecord) => {
    if (!confirm(`Pulihkan versi ${v.version}? Desain saat ini akan digantikan oleh versi ini.`)) return;

    try {
      setBlocksConfig(normalizeConfig(v.blocks_config));
      setVersionNote(`Rollback ke versi ${v.version}`);
      setVersionModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // KPI items helper
  const handleAddKpiItem = () => {
    const nextId = String(Date.now());
    const newItems = [
      ...(blocksConfig.kpiGrid?.items || []),
      { id: nextId, label: 'Metrik Baru', valueTemplate: '{{total_inc}}', color: 'default' as const, icon: 'package' },
    ];
    setBlocksConfig({
      ...blocksConfig,
      kpiGrid: {
        ...blocksConfig.kpiGrid,
        items: newItems,
      },
    });
  };

  const handleRemoveKpiItem = (idx: number) => {
    const updated = [...(blocksConfig.kpiGrid?.items || [])];
    updated.splice(idx, 1);
    setBlocksConfig({
      ...blocksConfig,
      kpiGrid: {
        ...blocksConfig.kpiGrid,
        items: updated,
      },
    });
  };

  const handleUpdateKpiItem = (idx: number, field: keyof CardKpiItem, val: any) => {
    const updated = [...(blocksConfig.kpiGrid?.items || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    setBlocksConfig({
      ...blocksConfig,
      kpiGrid: {
        ...blocksConfig.kpiGrid,
        items: updated,
      },
    });
  };

  // Active Context for Live Preview
  const activePreviewContext = previewMode === 'dummy' ? dummyContext : {};

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    const matchSearch =
      tpl.template_name.toLowerCase().includes(search.toLowerCase()) ||
      tpl.module.toLowerCase().includes(search.toLowerCase());
    const matchModule = selectedModule === 'all' || tpl.module === selectedModule;
    return matchSearch && matchModule;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E2231A] tracking-wider uppercase">
            <PanelsTopLeft className="w-4 h-4" />
            Communication Center
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Card Templates (Visual Builder)</h1>
          <p className="text-sm text-slate-500">
            Desain tata letak Feishu Interactive Card dengan Content Builder modular tanpa coding JSON.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPresetModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E2231A] hover:bg-[#c91d15] text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Buat Desain Kartu
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Module Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl overflow-x-auto w-full md:w-auto">
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedModule === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-slate-200/60 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Aktif
            </button>
            <button
              onClick={() => setSelectedStatus('archived')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'archived' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Diarsipkan
            </button>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari template kartu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#E2231A]/20 focus:border-[#E2231A]"
            />
          </div>
        </div>
      </div>

      {/* Grid Templates */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Memuat konfigurasi template kartu...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-4">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-800">Belum ada template kartu</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Mulai buat desain Feishu Interactive Card dengan Visual Builder atau pilih preset standar.
            </p>
          </div>
          <button
            onClick={() => setPresetModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#E2231A] text-white rounded-xl text-xs font-medium hover:bg-[#c91d15] transition-all"
          >
            <Plus className="w-4 h-4" />
            Buat Dari Preset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tpl) => {
            const config = normalizeConfig(tpl.blocks_config);
            const themeObj = THEMES.find((t) => t.id === config.theme) || THEMES[0];

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Top Bar Banner Theme */}
                  <div className={`h-2.5 w-full ${themeObj.bgClass}`} />

                  <div className="p-5 space-y-4">
                    {/* Header Info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px] tracking-wide uppercase">
                          {tpl.module.replace('_', ' ')}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                          {tpl.version}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 border border-slate-200">
                          <span className={`w-2 h-2 rounded-full ${themeObj.bgClass}`} />
                          {themeObj.name}
                        </span>
                        {tpl.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-medium">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            Default
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 line-clamp-1">{tpl.template_name}</h3>
                      {config.header?.subtitle && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{config.header.subtitle}</p>
                      )}
                    </div>

                    {/* Feature Badges */}
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                      {config.header?.showPickupDp && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded">Pickup DP</span>
                      )}
                      {config.lastScan?.show && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          Last Scan
                        </span>
                      )}
                      {config.kpiGrid && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded">
                          {config.kpiGrid.items?.length || 5} KPI ({config.kpiGrid.layout})
                        </span>
                      )}
                      {config.subdistricts?.show && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded">
                          Kecamatan ({config.subdistricts.maxItems})
                        </span>
                      )}
                      {config.screenshot?.show && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded">Lampiran HD</span>
                      )}
                      {config.actionButton?.enabled && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded">Tombol Dashboard</span>
                      )}
                    </div>

                    {/* Version note */}
                    {tpl.version_note && (
                      <div className="text-[11px] text-slate-400 italic line-clamp-1 border-t border-slate-100 pt-2">
                        💬 {tpl.version_note}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenVersions(tpl)}
                      title="Riwayat Versi"
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-all text-xs flex items-center gap-1 font-medium"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Riwayat</span>
                    </button>
                    <button
                      onClick={() => handleDuplicate(tpl)}
                      title="Duplikat Template"
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleArchive(tpl)}
                      title={tpl.status === 'active' ? 'Arsipkan' : 'Pulihkan'}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-all"
                    >
                      {tpl.status === 'active' ? (
                        <Archive className="w-3.5 h-3.5" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(tpl)}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-800 hover:text-slate-900 rounded-lg font-medium text-xs shadow-sm transition-all flex items-center gap-1.5"
                  >
                    Buka Builder
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Preset Picker */}
      <AnimatePresence>
        {presetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Pilih Preset Template Kartu</h3>
                  <p className="text-xs text-slate-500">
                    Gunakan template standar rekomendasi operasional atau mulai dengan template kosong.
                  </p>
                </div>
                <button
                  onClick={() => setPresetModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-[#E2231A] hover:bg-[#E2231A]/[0.02] cursor-pointer transition-all space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold uppercase">
                        {preset.module.replace('_', ' ')}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#E2231A] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#E2231A] transition-colors">
                        {preset.name}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{preset.description}</p>
                    </div>
                  </div>
                ))}

                {/* Custom Blank */}
                <div
                  onClick={() => handleSelectPreset(null)}
                  className="p-4 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-all flex flex-col items-center justify-center text-center space-y-2"
                >
                  <Sparkles className="w-6 h-6 text-slate-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Desain Dari Awal</h4>
                    <p className="text-xs text-slate-500">Mulai dengan template kosong modular</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Full Content Builder (Drawer Mode) */}
      <AnimatePresence>
        {builderOpen && (
          <div className="fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-sm justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-5xl h-full shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Builder Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E2231A]/10 text-[#E2231A] flex items-center justify-center font-bold">
                    <PanelsTopLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingId ? 'Edit Content Card Builder' : 'Content Card Builder Baru'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Ubah seluruh isi, label, judul, metrik KPI, dan urutan kartu tanpa coding JSON.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBuilderOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !templateName.trim()}
                    className="px-5 py-2 bg-[#E2231A] hover:bg-[#c91d15] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Simpan Template
                  </button>
                </div>
              </div>

              {/* Builder Body (2 Columns: Controls vs Live Feishu Mockup) */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                {/* Left: Configuration Sections (7 cols) */}
                <div className="lg:col-span-7 border-r border-slate-200 overflow-y-auto p-6 space-y-6">
                  {/* General Config */}
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Template</label>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="cth: Standar Monitoring INC Batang"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#E2231A]/20 focus:border-[#E2231A]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Modul Terkait</label>
                        <select
                          value={moduleVal}
                          onChange={(e) => setModuleVal(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#E2231A]/20 focus:border-[#E2231A]"
                        >
                          <option value="monitoring_inc">Monitoring INC</option>
                          <option value="monitoring_delivery">Monitoring Delivery</option>
                          <option value="longtail">Long Tail Alert</option>
                          <option value="dashboard">Dashboard Report</option>
                          <option value="custom">Custom Modul</option>
                        </select>
                      </div>
                    </div>

                    {/* Color Theme Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">Tema Banner Kartu</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {THEMES.map((theme) => (
                          <button
                            type="button"
                            key={theme.id}
                            onClick={() => setBlocksConfig({ ...blocksConfig, theme: theme.id })}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all ${
                              blocksConfig.theme === theme.id
                                ? 'border-[#E2231A] bg-[#E2231A]/5 shadow-sm font-semibold'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${theme.bgClass}`} />
                            <span className="truncate">{theme.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDefault}
                          onChange={(e) => setIsDefault(e.target.checked)}
                          className="rounded text-[#E2231A] focus:ring-[#E2231A]"
                        />
                        Jadikan Default untuk Modul {moduleVal}
                      </label>
                    </div>
                  </div>

                  {/* Section Tabs */}
                  <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-medium">
                    {[
                      { id: 'header', label: '🏷️ Header & Info' },
                      { id: 'lastScan', label: '⏱️ Last Scan' },
                      { id: 'kpi', label: '📊 Ringkasan KPI' },
                      { id: 'subdistricts', label: '📍 Kecamatan' },
                      { id: 'media', label: '🖼️ Screenshot' },
                      { id: 'action', label: '🚀 Tombol' },
                      { id: 'footer', label: '📝 Footer' },
                    ].map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setActiveSection(sec.id as any)}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                          activeSection === sec.id
                            ? 'bg-slate-900 text-white font-semibold shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>

                  {/* SECTION 1: Header & Info */}
                  {activeSection === 'header' && (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Judul Utama (Mendukung Variabel)
                          </label>
                          <input
                            type="text"
                            value={blocksConfig.header?.title || ''}
                            onChange={(e) =>
                              setBlocksConfig({
                                ...blocksConfig,
                                header: { ...blocksConfig.header, title: e.target.value },
                                title: e.target.value,
                              })
                            }
                            placeholder="cth: LTMS | Monitoring INC"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#E2231A]/20 focus:border-[#E2231A]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Sub Judul (Header Subtitle)
                          </label>
                          <input
                            type="text"
                            value={blocksConfig.header?.subtitle || ''}
                            onChange={(e) =>
                              setBlocksConfig({
                                ...blocksConfig,
                                header: { ...blocksConfig.header, subtitle: e.target.value },
                              })
                            }
                            placeholder="cth: Intercity Outgoing Monitoring"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#E2231A]/20 focus:border-[#E2231A]"
                          />
                        </div>
                      </div>

                      {/* Header Info Fields */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800">Informasi Sub Header</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-slate-700">Pickup DP</label>
                              <input
                                type="checkbox"
                                checked={blocksConfig.header?.showPickupDp ?? true}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    header: { ...blocksConfig.header, showPickupDp: e.target.checked },
                                  })
                                }
                                className="rounded text-[#E2231A]"
                              />
                            </div>
                            <input
                              type="text"
                              value={blocksConfig.header?.pickupDpLabel || 'Pickup DP'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  header: { ...blocksConfig.header, pickupDpLabel: e.target.value },
                                })
                              }
                              placeholder="Label: Pickup DP"
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-slate-700">Kota Tujuan / Drop Point</label>
                              <input
                                type="checkbox"
                                checked={blocksConfig.header?.showTargetCity ?? true}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    header: { ...blocksConfig.header, showTargetCity: e.target.checked },
                                  })
                                }
                                className="rounded text-[#E2231A]"
                              />
                            </div>
                            <input
                              type="text"
                              value={blocksConfig.header?.targetCityLabel || 'Tujuan'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  header: { ...blocksConfig.header, targetCityLabel: e.target.value },
                                })
                              }
                              placeholder="Label: Tujuan / Drop Point"
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-slate-700">Waktu Generate</label>
                              <input
                                type="checkbox"
                                checked={blocksConfig.header?.showUpdate ?? true}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    header: { ...blocksConfig.header, showUpdate: e.target.checked },
                                  })
                                }
                                className="rounded text-[#E2231A]"
                              />
                            </div>
                            <input
                              type="text"
                              value={blocksConfig.header?.updateLabel || 'Update'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  header: { ...blocksConfig.header, updateLabel: e.target.value },
                                })
                              }
                              placeholder="Label: Update / Waktu Generate"
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: Last Scan (Delivery) */}
                  {activeSection === 'lastScan' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Aktifkan Blok Last Scan</h4>
                          <p className="text-[11px] text-slate-500">
                            Menampilkan informasi aktivitas scan terakhir (Waktu, No AWB, dan Status).
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={blocksConfig.lastScan?.show ?? false}
                          onChange={(e) =>
                            setBlocksConfig({
                              ...blocksConfig,
                              lastScan: {
                                ...(blocksConfig.lastScan || {
                                  title: 'Last Scan',
                                  scanTimeLabel: 'Waktu Scan',
                                  scanTimeValue: '{{last_scan_time}}',
                                  awbLabel: 'AWB',
                                  awbValue: '{{last_scan_awb}}',
                                  statusLabel: 'Status',
                                  statusValue: '{{last_scan_status}}',
                                  fallbackText: 'Belum ada aktivitas scan hari ini.',
                                  show: true,
                                }),
                                show: e.target.checked,
                              },
                            })
                          }
                          className="rounded text-[#E2231A] w-4 h-4"
                        />
                      </div>

                      {blocksConfig.lastScan?.show && (
                        <div className="space-y-3 p-4 bg-white rounded-2xl border border-slate-200">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Blok</label>
                            <input
                              type="text"
                              value={blocksConfig.lastScan?.title || 'Last Scan'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  lastScan: { ...blocksConfig.lastScan!, title: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Label Waktu</label>
                              <input
                                type="text"
                                value={blocksConfig.lastScan?.scanTimeLabel || 'Waktu Scan'}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    lastScan: { ...blocksConfig.lastScan!, scanTimeLabel: e.target.value },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Label AWB</label>
                              <input
                                type="text"
                                value={blocksConfig.lastScan?.awbLabel || 'AWB'}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    lastScan: { ...blocksConfig.lastScan!, awbLabel: e.target.value },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Label Status</label>
                              <input
                                type="text"
                                value={blocksConfig.lastScan?.statusLabel || 'Status'}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    lastScan: { ...blocksConfig.lastScan!, statusLabel: e.target.value },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Teks Fallback Jika Belum Ada Scan
                            </label>
                            <input
                              type="text"
                              value={blocksConfig.lastScan?.fallbackText || 'Belum ada aktivitas scan hari ini.'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  lastScan: { ...blocksConfig.lastScan!, fallbackText: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 3: Ringkasan Grid KPI */}
                  {activeSection === 'kpi' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Grid KPI</label>
                          <input
                            type="text"
                            value={blocksConfig.kpiGrid?.title || 'Ringkasan Monitoring INC'}
                            onChange={(e) =>
                              setBlocksConfig({
                                ...blocksConfig,
                                kpiGrid: { ...blocksConfig.kpiGrid, title: e.target.value },
                              })
                            }
                            placeholder="cth: Ringkasan Monitoring INC"
                            className="w-72 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Tata Letak (Layout)</label>
                          <select
                            value={blocksConfig.kpiGrid?.layout || 'horizontal_5'}
                            onChange={(e) =>
                              setBlocksConfig({
                                ...blocksConfig,
                                kpiGrid: { ...blocksConfig.kpiGrid, layout: e.target.value as any },
                                kpiStyle: e.target.value as any,
                              })
                            }
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="horizontal_5">5 Kolom / Horizontal Grid</option>
                            <option value="4_column">4 Kolom Grid</option>
                            <option value="2_column">2 Kolom Ringkas</option>
                          </select>
                        </div>
                      </div>

                      {/* KPI Items List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Daftar Indikator KPI</span>
                          <button
                            type="button"
                            onClick={handleAddKpiItem}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E2231A] hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Tambah KPI
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(blocksConfig.kpiGrid?.items || []).map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs"
                            >
                              <div className="flex-1 grid grid-cols-2 gap-2 w-full">
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={(e) => handleUpdateKpiItem(idx, 'label', e.target.value)}
                                  placeholder="Label KPI"
                                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                                />
                                <input
                                  type="text"
                                  value={item.valueTemplate}
                                  onChange={(e) => handleUpdateKpiItem(idx, 'valueTemplate', e.target.value)}
                                  placeholder="Variabel cth: {{total_inc}}"
                                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
                                />
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
                                <select
                                  value={item.color || 'default'}
                                  onChange={(e) => handleUpdateKpiItem(idx, 'color', e.target.value)}
                                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                                >
                                  <option value="default">Default</option>
                                  <option value="red">Merah (Alert)</option>
                                  <option value="green">Hijau (Success)</option>
                                  <option value="blue">Biru (Info)</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveKpiItem(idx)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-200 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: 📍 Kecamatan Tujuan */}
                  {activeSection === 'subdistricts' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Aktifkan Blok Kecamatan Tujuan</h4>
                          <p className="text-[11px] text-slate-500">
                            Menampilkan daftar kecamatan tujuan pengiriman beserta jumlah sisa AWB.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={blocksConfig.subdistricts?.show ?? true}
                          onChange={(e) =>
                            setBlocksConfig({
                              ...blocksConfig,
                              subdistricts: {
                                ...(blocksConfig.subdistricts || {
                                  title: '📍 Kecamatan Tujuan',
                                  maxItems: '5',
                                  sortOrder: 'desc',
                                  show: true,
                                }),
                                show: e.target.checked,
                              },
                              showTopKecamatan: e.target.checked,
                            })
                          }
                          className="rounded text-[#E2231A] w-4 h-4"
                        />
                      </div>

                      {blocksConfig.subdistricts?.show && (
                        <div className="space-y-3 p-4 bg-white rounded-2xl border border-slate-200">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Blok</label>
                            <input
                              type="text"
                              value={blocksConfig.subdistricts?.title || '📍 Kecamatan Tujuan'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  subdistricts: { ...blocksConfig.subdistricts!, title: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Jumlah Data</label>
                              <select
                                value={blocksConfig.subdistricts?.maxItems || '5'}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    subdistricts: { ...blocksConfig.subdistricts!, maxItems: e.target.value as any },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              >
                                <option value="5">Top 5 Kecamatan</option>
                                <option value="10">Top 10 Kecamatan</option>
                                <option value="all">Semua Kecamatan</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">Urutan (Sorting)</label>
                              <select
                                value={blocksConfig.subdistricts?.sortOrder || 'desc'}
                                onChange={(e) =>
                                  setBlocksConfig({
                                    ...blocksConfig,
                                    subdistricts: { ...blocksConfig.subdistricts!, sortOrder: e.target.value as any },
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              >
                                <option value="desc">Terbanyak ke Terkecil (Descending)</option>
                                <option value="asc">Terkecil ke Terbanyak (Ascending)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 5: Screenshot Media */}
                  {activeSection === 'media' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Lampirkan Screenshot Tabel HD</h4>
                          <p className="text-[11px] text-slate-500">
                            Menyisipkan bukti visual screenshot monitoring otomatis di bawah ringkasan.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={blocksConfig.screenshot?.show ?? true}
                          onChange={(e) =>
                            setBlocksConfig({
                              ...blocksConfig,
                              screenshot: { ...blocksConfig.screenshot, show: e.target.checked },
                              showImage: e.target.checked,
                            })
                          }
                          className="rounded text-[#E2231A] w-4 h-4"
                        />
                      </div>
                    </div>
                  )}

                  {/* SECTION 6: Action Button */}
                  {activeSection === 'action' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Tombol Aksi Dashboard</h4>
                          <p className="text-[11px] text-slate-500">
                            Tombol interaktif di Feishu untuk membuka halaman monitoring LTMS terkait.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={blocksConfig.actionButton?.enabled ?? true}
                          onChange={(e) =>
                            setBlocksConfig({
                              ...blocksConfig,
                              actionButton: { ...blocksConfig.actionButton, enabled: e.target.checked },
                            })
                          }
                          className="rounded text-[#E2231A] w-4 h-4"
                        />
                      </div>

                      {blocksConfig.actionButton?.enabled && (
                        <div className="space-y-3 p-4 bg-white rounded-2xl border border-slate-200">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Label Tombol</label>
                            <input
                              type="text"
                              value={blocksConfig.actionButton?.label || '🚀 Buka Dashboard LTMS'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  actionButton: { ...blocksConfig.actionButton, label: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Target URL</label>
                            <input
                              type="text"
                              value={blocksConfig.actionButton?.url || 'https://ltms.jt-express.id'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  actionButton: { ...blocksConfig.actionButton, url: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 7: Footer */}
                  {activeSection === 'footer' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Catatan Kaki (Footer)</h4>
                          <p className="text-[11px] text-slate-500">
                            Identitas sistem otomatis pada bagian bawah kartu.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={blocksConfig.footer?.show ?? true}
                          onChange={(e) =>
                            setBlocksConfig({
                              ...blocksConfig,
                              footer: { ...blocksConfig.footer, show: e.target.checked },
                              showFooter: e.target.checked,
                            })
                          }
                          className="rounded text-[#E2231A] w-4 h-4"
                        />
                      </div>

                      {blocksConfig.footer?.show && (
                        <div className="space-y-3 p-4 bg-white rounded-2xl border border-slate-200">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Footer</label>
                            <input
                              type="text"
                              value={blocksConfig.footer?.title || 'LTMS'}
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  footer: { ...blocksConfig.footer, title: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Footer</label>
                            <textarea
                              rows={2}
                              value={
                                blocksConfig.footer?.description ||
                                'Long Tail Monitoring System\nGenerated Automatically'
                              }
                              onChange={(e) =>
                                setBlocksConfig({
                                  ...blocksConfig,
                                  footer: { ...blocksConfig.footer, description: e.target.value },
                                  footerText: e.target.value,
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Version Note */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Catatan Perubahan Versi (Opsional)
                    </label>
                    <input
                      type="text"
                      value={versionNote}
                      onChange={(e) => setVersionNote(e.target.value)}
                      placeholder="cth: Mengubah indikator KPI dan label tujuan"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Right: Real-time Live Preview Feishu Card (5 cols) */}
                <div className="lg:col-span-5 bg-slate-100/70 p-6 flex flex-col items-center justify-start overflow-y-auto">
                  <div className="w-full max-w-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                        <Eye className="w-4 h-4 text-slate-500" />
                        Live Feishu Preview
                      </div>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-medium">
                        <button
                          type="button"
                          onClick={() => setPreviewMode('dummy')}
                          className={`px-2 py-0.5 rounded ${
                            previewMode === 'dummy' ? 'bg-[#E2231A] text-white font-semibold' : 'text-slate-600'
                          }`}
                        >
                          Data Dummy
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('real')}
                          className={`px-2 py-0.5 rounded ${
                            previewMode === 'real' ? 'bg-[#E2231A] text-white font-semibold' : 'text-slate-600'
                          }`}
                        >
                          Data Riil
                        </button>
                      </div>
                    </div>

                    {/* MOCK FEISHU CARD CONTAINER */}
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-xs">
                      {/* Feishu Header Banner */}
                      <div
                        className={`p-3.5 text-white ${
                          THEMES.find((t) => t.id === blocksConfig.theme)?.bgClass || 'bg-[#E2231A]'
                        }`}
                      >
                        <div className="font-bold text-sm leading-tight">
                          {MessageTemplateEngine.render(
                            blocksConfig.header?.title || blocksConfig.title || 'LTMS | Monitoring Report',
                            activePreviewContext
                          )}
                        </div>
                        {blocksConfig.header?.subtitle && (
                          <div className="text-[11px] text-white/80 font-medium mt-0.5">
                            {MessageTemplateEngine.render(blocksConfig.header.subtitle, activePreviewContext)}
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-3.5">
                        {/* Sub Header Info */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pb-2 border-b border-slate-100">
                          {blocksConfig.header?.showPickupDp && (
                            <div>
                              <span className="text-slate-400 font-semibold block">
                                {blocksConfig.header?.pickupDpLabel || 'Pickup DP'}:
                              </span>
                              <span className="font-bold text-slate-800">
                                {MessageTemplateEngine.render(
                                  blocksConfig.header?.pickupDpValue || '{{pickup_dp}}',
                                  activePreviewContext
                                )}
                              </span>
                            </div>
                          )}

                          {blocksConfig.header?.showTargetCity && (
                            <div>
                              <span className="text-slate-400 font-semibold block">
                                {blocksConfig.header?.targetCityLabel || 'Tujuan'}:
                              </span>
                              <span className="font-bold text-slate-800">
                                {MessageTemplateEngine.render(
                                  blocksConfig.header?.targetCityValue || '{{target_city}}',
                                  activePreviewContext
                                )}
                              </span>
                            </div>
                          )}

                          {blocksConfig.header?.showUpdate && (
                            <div className="col-span-2 pt-1">
                              <span className="text-slate-400 font-semibold block">
                                {blocksConfig.header?.updateLabel || 'Update'}:
                              </span>
                              <span className="font-medium text-slate-700">
                                {MessageTemplateEngine.render(
                                  blocksConfig.header?.updateValue || '{{generated_at}}',
                                  activePreviewContext
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Last Scan Block */}
                        {blocksConfig.lastScan?.show && (
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-600" />
                              {blocksConfig.lastScan.title || 'Last Scan'}
                            </div>
                            <div className="text-slate-600 space-y-0.5 pt-0.5">
                              <div>
                                • {blocksConfig.lastScan.scanTimeLabel || 'Waktu'}:{' '}
                                <span className="font-semibold text-slate-800">
                                  {MessageTemplateEngine.render(
                                    blocksConfig.lastScan.scanTimeValue || '{{last_scan_time}}',
                                    activePreviewContext
                                  )}
                                </span>
                              </div>
                              <div>
                                • {blocksConfig.lastScan.awbLabel || 'AWB'}:{' '}
                                <span className="font-semibold text-slate-800">
                                  {MessageTemplateEngine.render(
                                    blocksConfig.lastScan.awbValue || '{{last_scan_awb}}',
                                    activePreviewContext
                                  )}
                                </span>
                              </div>
                              <div>
                                • {blocksConfig.lastScan.statusLabel || 'Status'}:{' '}
                                <span className="font-semibold text-slate-800">
                                  {MessageTemplateEngine.render(
                                    blocksConfig.lastScan.statusValue || '{{last_scan_status}}',
                                    activePreviewContext
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* KPI Grid */}
                        <div className="space-y-2">
                          <div className="font-bold text-slate-800 text-[11px]">
                            📊 {blocksConfig.kpiGrid?.title || 'Ringkasan Monitoring'}
                          </div>

                          <div
                            className={`grid gap-1.5 ${
                              blocksConfig.kpiGrid?.layout === '2_column' ? 'grid-cols-2' : 'grid-cols-2'
                            }`}
                          >
                            {(blocksConfig.kpiGrid?.items || []).map((kpi, idx) => {
                              const renderedVal = MessageTemplateEngine.render(
                                kpi.valueTemplate,
                                activePreviewContext
                              );
                              return (
                                <div
                                  key={kpi.id || idx}
                                  className="p-2 bg-slate-50/80 rounded border border-slate-200/80"
                                >
                                  <div className="text-[10px] text-slate-500 font-medium truncate">{kpi.label}</div>
                                  <div
                                    className={`text-xs font-bold mt-0.5 ${
                                      kpi.color === 'red'
                                        ? 'text-[#E2231A]'
                                        : kpi.color === 'green'
                                        ? 'text-emerald-600'
                                        : kpi.color === 'blue'
                                        ? 'text-blue-600'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {renderedVal}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Kecamatan Tujuan Block */}
                        {blocksConfig.subdistricts?.show && (
                          <div className="space-y-1.5 pt-1 border-t border-slate-100">
                            <div className="font-bold text-slate-800 text-[11px]">
                              {blocksConfig.subdistricts.title || '📍 Kecamatan Tujuan'}
                            </div>
                            <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 whitespace-pre-line leading-relaxed">
                              {MessageTemplateEngine.render(
                                '{{destination_subdistricts}}',
                                activePreviewContext
                              )}
                            </div>
                          </div>
                        )}

                        {/* Screenshot Mock */}
                        {blocksConfig.screenshot?.show && (
                          <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center bg-slate-50 space-y-1">
                            <ImageIcon className="w-5 h-5 text-slate-400 mx-auto" />
                            <div className="text-[10px] font-semibold text-slate-600">
                              [Bukti Screenshot HD Monitoring]
                            </div>
                          </div>
                        )}

                        {/* Action Button */}
                        {blocksConfig.actionButton?.enabled && (
                          <div>
                            <button
                              type="button"
                              className={`w-full py-2 rounded-lg text-white font-bold text-xs shadow-sm transition-all ${
                                blocksConfig.theme === 'red'
                                  ? 'bg-[#E2231A]'
                                  : blocksConfig.theme === 'blue'
                                  ? 'bg-blue-600'
                                  : 'bg-slate-800'
                              }`}
                            >
                              {blocksConfig.actionButton.label || '🚀 Buka Dashboard LTMS'}
                            </button>
                          </div>
                        )}

                        {/* Footer */}
                        {blocksConfig.footer?.show && (
                          <div className="text-[9px] text-slate-400 text-center leading-tight pt-1 border-t border-slate-100 whitespace-pre-line">
                            {blocksConfig.footer.title && <strong>{blocksConfig.footer.title} • </strong>}
                            {blocksConfig.footer.description ||
                              'Long Tail Monitoring System\nGenerated Automatically'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Version History */}
      <AnimatePresence>
        {versionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">Riwayat Versi Desain Kartu</h3>
                  <p className="text-xs text-slate-500">{selectedTemplateName}</p>
                </div>
                <button
                  onClick={() => setVersionModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 max-h-96 overflow-y-auto space-y-3">
                {versionLoading ? (
                  <div className="py-8 text-center text-xs text-slate-500">Memuat riwayat...</div>
                ) : activeVersions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">Belum ada riwayat versi sebelumnya.</div>
                ) : (
                  activeVersions.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-200 font-mono font-bold rounded text-[10px]">
                            {v.version}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(v.created_at).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] italic">{v.note || 'Pembaruan desain'}</p>
                      </div>

                      <button
                        onClick={() => handleRestoreVersion(v)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#E2231A] text-slate-700 hover:text-[#E2231A] rounded-lg text-xs font-medium shadow-sm transition-all"
                      >
                        Rollback
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
