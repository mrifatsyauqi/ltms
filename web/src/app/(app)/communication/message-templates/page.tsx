'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
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
  AlertCircle,
  HelpCircle,
  X,
  Star,
  RefreshCw,
} from 'lucide-react';
import type { MessageTemplateRecord, MessageTemplateVersionRecord } from '@/lib/data/supabase/communication-config';
import type { StarterPreset, VariableDefinition } from '@/services/communication/configuration/template-presets';
import { MessageTemplateEngine } from '@/services/communication/configuration/message-template.engine';

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [presets, setPresets] = useState<StarterPreset[]>([]);
  const [variables, setVariables] = useState<VariableDefinition[]>([]);
  const [dummyContext, setDummyContext] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'archived'>('active');

  // Modals
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [activeVersions, setActiveVersions] = useState<MessageTemplateVersionRecord[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');

  // Editor Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    module: 'monitoring_inc',
    template_name: '',
    content: '',
    is_default: false,
    version_note: '',
  });
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'dummy' | 'real'>('dummy');
  const [activeCategory, setActiveCategory] = useState<'all' | 'metrics' | 'general' | 'meta'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load Presets & Templates
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [presetRes, tplRes] = await Promise.all([
          fetch('/api/communication/templates/presets').then((r) => r.json()),
          fetch('/api/communication/templates/message').then((r) => r.json()),
        ]);

        if (presetRes.ok) {
          setPresets(presetRes.presets || []);
          setVariables(presetRes.variables || []);
          setDummyContext(presetRes.dummyContext || {});
        }
        if (tplRes.ok) {
          setTemplates(tplRes.data || []);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  const refreshTemplates = async () => {
    try {
      const res = await fetch(`/api/communication/templates/message?status=${selectedStatus}`);
      const json = await res.json();
      if (json.ok) setTemplates(json.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshTemplates();
  }, [selectedStatus]);

  // Insert Variable at Cursor Position
  const handleInsertVariable = (varKey: string) => {
    const textarea = textareaRef.current;
    const tag = `{{${varKey}}}`;
    if (!textarea) {
      setFormData((prev) => ({ ...prev, content: prev.content + tag }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = formData.content;
    const updated = current.substring(0, start) + tag + current.substring(end);

    setFormData((prev) => ({ ...prev, content: updated }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Open Create from Preset
  const handleSelectPreset = (preset: StarterPreset | null) => {
    setPresetModalOpen(false);
    setEditingId(null);
    if (preset) {
      setFormData({
        module: preset.module,
        template_name: `Standar ${preset.name}`,
        content: preset.messageContent,
        is_default: false,
        version_note: 'Template awal dari preset',
      });
    } else {
      setFormData({
        module: 'monitoring_inc',
        template_name: 'Template Baru',
        content: '',
        is_default: false,
        version_note: 'Initial version',
      });
    }
    setEditorOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (tpl: MessageTemplateRecord) => {
    setEditingId(tpl.id);
    setFormData({
      module: tpl.module,
      template_name: tpl.template_name,
      content: tpl.content,
      is_default: tpl.is_default,
      version_note: '',
    });
    setEditorOpen(true);
  };

  // Save Template
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.template_name.trim() || !formData.content.trim()) return;

    try {
      setSaving(true);
      const url = '/api/communication/templates/message';
      const method = editingId ? 'PUT' : 'POST';
      const payload = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.ok) {
        setEditorOpen(false);
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
  const handleToggleArchive = async (tpl: MessageTemplateRecord) => {
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
      const res = await fetch(`/api/communication/templates/message/${tpl.id}/${action}`, {
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
      const res = await fetch(`/api/communication/templates/message/${id}/duplicate`, {
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
      const res = await fetch(`/api/communication/templates/message/${id}/set-default`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) refreshTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  // View Versions
  const handleViewVersions = async (tpl: MessageTemplateRecord) => {
    setSelectedTemplateName(tpl.template_name);
    setVersionModalOpen(true);
    setVersionLoading(true);
    try {
      const res = await fetch(`/api/communication/templates/message/${tpl.id}/versions`);
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
    const matchSearch =
      tpl.template_name.toLowerCase().includes(search.toLowerCase()) ||
      tpl.content.toLowerCase().includes(search.toLowerCase());
    const matchModule = selectedModule === 'all' || tpl.module === selectedModule;
    return matchSearch && matchModule;
  });

  const filteredVariables = variables.filter((v) => {
    if (activeCategory === 'all') return true;
    return v.category === activeCategory;
  });

  const renderedPreview = MessageTemplateEngine.render(formData.content, dummyContext);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            Communication Center
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Message Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola format teks caption laporan operasional dengan variable helper 1-klik dan live preview real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setPresetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E2231A] hover:bg-[#c91d15] text-white text-sm font-semibold rounded-lg shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Buat Template
          </button>
        </div>
      </div>

      {/* Control Bar: Search, Module Tabs, Status Toggle */}
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
              placeholder="Cari template..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">Memuat template pesan...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Belum ada template</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Mulai buat template baru menggunakan Starter Preset siap pakai untuk modul Anda.
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
          {filteredTemplates.map((tpl) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {tpl.module.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        {tpl.version}
                      </span>
                      {tpl.is_default && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          Default
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mt-1.5 line-clamp-1">
                      {tpl.template_name}
                    </h3>
                  </div>

                  {!tpl.is_default && tpl.status === 'active' && (
                    <button
                      onClick={() => handleSetDefault(tpl.id)}
                      title="Jadikan template default"
                      className="text-xs text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-slate-50"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Preview Box */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-slate-600 font-mono text-[11px] leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {tpl.content}
                </div>

                {tpl.version_note && (
                  <p className="text-[11px] text-slate-400 italic line-clamp-1">
                    💬 {tpl.version_note}
                  </p>
                )}
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
                    Edit
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
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
                    Pilih Starter Preset
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gunakan template standar operasional agar tidak perlu menyusun dari nol.
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
                  <FileText className="w-5 h-5 text-slate-400 mb-1" />
                  <h4 className="font-bold text-slate-700 text-sm">
                    Mulai dari Template Kosong
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Buat struktur format sendiri
                  </p>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Full Editor & Variable Helper Drawer / Modal */}
      <AnimatePresence>
        {editorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Editor Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingId ? 'Edit Message Template' : 'Buat Message Template'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Klik variabel di helper bawah untuk menyisipkan tag otomatis ke teks caption.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Editor Body: Left Editor + Variable Helper, Right Live Preview */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                {/* Left Form (7 cols) */}
                <div className="lg:col-span-7 p-6 overflow-y-auto border-r border-slate-200 space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Top Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Nama Template <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.template_name}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, template_name: e.target.value }))
                          }
                          placeholder="Contoh: Monitoring INC Batang"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Modul Terkait
                        </label>
                        <select
                          value={formData.module}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, module: e.target.value }))
                          }
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

                    {/* Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Isi Template Caption <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Mendukung Markdown & Tag &#123;&#123;variable&#125;&#125;
                        </span>
                      </div>
                      <textarea
                        ref={textareaRef}
                        required
                        rows={10}
                        value={formData.content}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, content: e.target.value }))
                        }
                        placeholder="Ketik isi laporan atau klik variable di bawah..."
                        className="w-full p-3 font-mono text-xs bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none leading-relaxed"
                      />
                    </div>

                    {/* Variable Helper Panel */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Variable Helper (Klik untuk menyisipkan)
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          {(['all', 'metrics', 'general', 'meta'] as const).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setActiveCategory(cat)}
                              className={`px-2 py-0.5 rounded capitalize ${
                                activeCategory === cat
                                  ? 'bg-slate-800 text-white font-semibold'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {filteredVariables.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => handleInsertVariable(v.key)}
                            title={`${v.label} • ${v.description}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 text-slate-700 hover:text-red-700 text-xs font-mono rounded-md shadow-2xs transition-all active:scale-95 group"
                          >
                            <span className="text-red-500 font-bold group-hover:scale-110 transition-transform">
                              +
                            </span>
                            &#123;&#123;{v.key}&#125;&#125;
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Version Change Note & Default Switch */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Catatan Perubahan (Versi)
                        </label>
                        <input
                          type="text"
                          value={formData.version_note}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, version_note: e.target.value }))
                          }
                          placeholder="Contoh: Menambah Footer & Metrik Clear"
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-4">
                        <input
                          type="checkbox"
                          id="is_default_check"
                          checked={formData.is_default}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, is_default: e.target.checked }))
                          }
                          className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                        />
                        <label
                          htmlFor="is_default_check"
                          className="text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          Jadikan Template Default Modul Ini
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Submit Bar */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
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
                      {saving ? 'Menyimpan...' : 'Simpan Template'}
                    </button>
                  </div>
                </div>

                {/* Right Live Preview (5 cols) */}
                <div className="lg:col-span-5 bg-slate-100/70 p-6 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Eye className="w-4 h-4 text-slate-500" />
                        Live Preview (Real-time)
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

                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {renderedPreview || (
                        <span className="text-slate-300 italic">
                          Preview teks laporan akan muncul di sini...
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-3 text-center">
                    Simulasi tampilan caption saat dikirim ke group Feishu.
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
                    Riwayat Versi
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
                  Memuat riwayat versi...
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
                        {v.content}
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
