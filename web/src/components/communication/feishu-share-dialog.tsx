'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Share2,
  Search,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Send,
  Building2,
  ImageIcon,
  LayoutTemplate,
  History,
  Clock,
  AtSign,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  FeishuGroup,
  ReportMetricItem,
} from '@/services/communication/communication.types';
import { FeishuHistoryDialog } from './feishu-history-dialog';
import { FeishuCardPreview } from './feishu-card-preview';
import { STARTER_PRESETS } from '@/services/communication/configuration/template-presets';
import type { VisualCardBlocksConfig } from '@/services/communication/configuration/template.types';
import type { MentionMappingRecord } from '@/lib/data/supabase/mention-mapping';

export type FeishuShareStage =
  | 'idle'
  | 'preparing_data'
  | 'rendering_report'
  | 'generating_caption'
  | 'uploading_image'
  | 'sending_message'
  | 'completed'
  | 'error';

export interface ShareSummaryData {
  total?: number;
  belum?: number;
  late?: number;
  clear?: number;
  percent?: number;
  topKecamatan?: string[];
  subdistricts?: Array<{ name: string; count: number | string; picName?: string; openId?: string }>;
  kurirList?: Array<{ name: string; count: number | string; picName?: string; openId?: string }>;
  metrics?: ReportMetricItem[];
  notes?: string;
}

export interface FeishuShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName?: string; // Default: 'Monitoring INC'
  targetScopeName?: string;
  targetScopeType?: 'all' | 'cabang' | 'kota' | 'drop_point';
  generateTime?: string;
  summaryData?: ShareSummaryData;
  captionPreview?: string;
  imagePreviewUrl?: string | null;
  onExecuteSend: (
    selectedGroup: FeishuGroup,
    updateStage: (stage: FeishuShareStage, progress: number) => void,
    selectedCardTemplateId?: string
  ) => Promise<void>;
  targetKota?: string;
}

const STAGE_CONFIG: Record<
  FeishuShareStage,
  { label: string; description: string; progress: number }
> = {
  idle: {
    label: 'Siap Mengirim',
    description: 'Pilih group Feishu tujuan',
    progress: 0,
  },
  preparing_data: {
    label: 'Preparing Data...',
    description: 'Mengekstrak data ringkasan dan metrik operasional',
    progress: 15,
  },
  rendering_report: {
    label: 'Rendering Report (1200×900)...',
    description: 'Merender visual gambar laporan beresolusi tinggi',
    progress: 35,
  },
  generating_caption: {
    label: 'Generating Card Elements...',
    description: 'Mengompilasi Interactive Card dengan Single Source Engine',
    progress: 55,
  },
  uploading_image: {
    label: 'Uploading Image to Feishu...',
    description: 'Mengunggah image report ke Feishu Open Platform',
    progress: 75,
  },
  sending_message: {
    label: 'Sending Interactive Assignment Card...',
    description: 'Mengirimkan Interactive Card dan Mentions ke Group tujuan',
    progress: 90,
  },
  completed: {
    label: 'Completed!',
    description: 'Laporan berhasil terkirim ke Group Feishu',
    progress: 100,
  },
  error: {
    label: 'Gagal Mengirim',
    description: 'Terjadi kendala saat mengirim ke Feishu',
    progress: 0,
  },
};

const normalizeFeishuGroup = (g: any): FeishuGroup => {
  const cId = g.chatId || g.chat_id || g.id || '';
  const gName = g.groupName || g.group_name || 'Group Tanpa Nama';
  const mCount = g.memberCount ?? g.member_count ?? 0;
  const isDef = Boolean(g.isDefault || g.is_default);

  return {
    id: g.id || cId,
    chatId: cId,
    chat_id: cId,
    groupName: gName,
    group_name: gName,
    memberCount: mCount,
    member_count: mCount,
    isDefault: isDef,
    is_default: isDef,
    status: g.status || 'active',
  } as FeishuGroup;
};

type ActiveTab = 'group' | 'preview_card' | 'preview_image';

export function FeishuShareDialog({
  isOpen,
  onClose,
  moduleName = 'Monitoring INC',
  targetScopeName,
  targetScopeType,
  targetKota,
  generateTime,
  summaryData,
  imagePreviewUrl,
  onExecuteSend,
}: FeishuShareDialogProps) {
  const [groups, setGroups] = useState<FeishuGroup[]>([]);
  const [cardTemplates, setCardTemplates] = useState<any[]>([]);
  const [selectedCardTemplateId, setSelectedCardTemplateId] = useState<string>('');
  const [mentions, setMentions] = useState<MentionMappingRecord[]>([]);

  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('group');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [stage, setStage] = useState<FeishuShareStage>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveScopeName = targetScopeName || targetKota || 'Cabang';

  useEffect(() => {
    if (!isOpen) {
      setStage('idle');
      setProgress(0);
      setErrorMessage(null);
      setActiveTab('group');
      return;
    }

    fetchGroupsAndTemplates();
  }, [isOpen]);

  const fetchGroupsAndTemplates = async () => {
    setIsLoadingGroups(true);
    try {
      const [grpRes, cardRes, mentionRes] = await Promise.all([
        fetch('/api/communication/groups').then((r) => r.json()),
        fetch('/api/communication/card-templates?status=active').then((r) => r.json()),
        fetch('/api/communication/mentions').then((r) => r.json()),
      ]);

      if (grpRes.success && Array.isArray(grpRes.data) && grpRes.data.length > 0) {
        const normalized = grpRes.data.map(normalizeFeishuGroup);
        setGroups(normalized);
        const defaultGrp = normalized.find((g: any) => g.is_default || g.isDefault);
        if (defaultGrp) {
          setSelectedChatId(defaultGrp.chatId || (defaultGrp as any).chat_id);
        } else if (normalized[0]) {
          setSelectedChatId(normalized[0].chatId || (normalized[0] as any).chat_id);
        }
      }

      if (cardRes.success && Array.isArray(cardRes.data)) {
        setCardTemplates(cardRes.data);
        const modKey = moduleName.toLowerCase().includes('delivery') ? 'monitoring_delivery' : 'monitoring_inc';
        const defCard = cardRes.data.find((t: any) => t.module === modKey && t.is_default) || cardRes.data[0];
        if (defCard) setSelectedCardTemplateId(defCard.id);
      }

      if (mentionRes.success && Array.isArray(mentionRes.data)) {
        setMentions(mentionRes.data);
      }
    } catch (err) {
      console.warn('Gagal memuat konfigurasi:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleSyncGroups = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/communication/groups/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const normalized = json.data.map(normalizeFeishuGroup);
        setGroups(normalized);
        const now = new Date();
        setLastSyncTime(
          new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(now) + ' WIB'
        );
        toast.success(`Berhasil sinkronisasi ${normalized.length} group`);
      }
    } catch {
      toast.error('Gagal sinkronisasi group');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.groupName.toLowerCase().includes(q) ||
        (g.chatId && g.chatId.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  const selectedGroup = groups.find((g) => g.chatId === selectedChatId);

  const handleStartSend = async () => {
    if (!selectedGroup) {
      toast.error('Pilih group Feishu tujuan terlebih dahulu');
      return;
    }

    setStage('preparing_data');
    setProgress(15);
    setErrorMessage(null);

    try {
      await onExecuteSend(
        selectedGroup,
        (newStage, newProgress) => {
          setStage(newStage);
          setProgress(newProgress);
        },
        selectedCardTemplateId
      );
      setStage('completed');
      setProgress(100);
      toast.success('Interactive Card berhasil dikirim!');
    } catch (err: any) {
      setStage('error');
      setErrorMessage(err.message || 'Gagal mengirim Interactive Card ke Feishu');
      toast.error(err.message || 'Gagal mengirim laporan');
    }
  };

  // Compile Active Blocks Config for Live Preview
  const activeBlocksConfig: VisualCardBlocksConfig = useMemo(() => {
    const selectedTpl = cardTemplates.find((t) => t.id === selectedCardTemplateId);
    if (selectedTpl?.blocks_config) return selectedTpl.blocks_config;

    const modKey = moduleName.toLowerCase().includes('delivery') ? 'monitoring_delivery' : 'monitoring_inc';
    const preset = STARTER_PRESETS.find((p) => p.module === modKey) || STARTER_PRESETS[0];
    return preset.blocksConfig;
  }, [cardTemplates, selectedCardTemplateId, moduleName]);

  // Context Variables
  const previewVarContext = useMemo(() => {
    return {
      pickup_dp: effectiveScopeName,
      drop_point: effectiveScopeName,
      target_city: effectiveScopeName,
      city: effectiveScopeName,
      target_kota: effectiveScopeName,
      generated_at: generateTime || new Date().toLocaleString('id-ID'),
      today: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      total_inc: summaryData?.total?.toLocaleString('id-ID') || '0',
      total_package: summaryData?.total?.toLocaleString('id-ID') || '0',
      total_arrived: summaryData?.total?.toLocaleString('id-ID') || '0',
      total_delivery: summaryData?.total?.toLocaleString('id-ID') || '0',
      clear_ttd: summaryData?.clear?.toLocaleString('id-ID') || '0',
      delivered: summaryData?.clear?.toLocaleString('id-ID') || '0',
      pending_ttd: summaryData?.belum?.toLocaleString('id-ID') || '0',
      pending_delivery: summaryData?.belum?.toLocaleString('id-ID') || '0',
      over_sla: summaryData?.late?.toLocaleString('id-ID') || '0',
      sla_percentage: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
      delivery_sla: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
      last_scan_time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      last_scan_awb: 'JT1234567890',
      last_scan_status: 'Delivery',
      destination_subdistricts: summaryData?.topKecamatan?.join('\n') || 'Belum ada data',
      subdistricts: summaryData?.subdistricts || summaryData?.topKecamatan?.map((k) => ({ name: k, count: 'Perlu Follow Up' })),
      kurirList: summaryData?.kurirList,
    };
  }, [effectiveScopeName, generateTime, summaryData]);

  if (!isOpen) return null;

  const isProcessing = stage !== 'idle' && stage !== 'completed' && stage !== 'error';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl text-[#E2231A] border border-red-100">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Bagikan {moduleName} ke Feishu
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Kirim Interactive Assignment Card operasional real-time ke Group Feishu.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Riwayat</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-4 sm:px-6 pt-3 flex items-center gap-2 border-b border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('group')}
              className={`px-3 py-2 font-bold rounded-xl transition-all ${
                activeTab === 'group'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              1. Pilih Group & Desain
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview_card')}
              className={`px-3 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
                activeTab === 'preview_card'
                  ? 'bg-[#E2231A] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>2. Live Preview Card</span>
            </button>
            {imagePreviewUrl && (
              <button
                type="button"
                onClick={() => setActiveTab('preview_image')}
                className={`px-3 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'preview_image'
                    ? 'bg-[#E2231A] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>3. Preview Screenshot</span>
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
            {/* Progress Overlay */}
            {isProcessing ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E2231A] flex items-center justify-center mx-auto animate-pulse">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{STAGE_CONFIG[stage].label}</h4>
                  <p className="text-xs text-slate-500">{STAGE_CONFIG[stage].description}</p>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden max-w-sm mx-auto">
                  <div
                    className="bg-[#E2231A] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : activeTab === 'group' ? (
              <div className="space-y-4">
                {/* Scope & Template Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Cakupan Operasional
                    </span>
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-sm">
                      <Building2 className="w-4 h-4 text-[#E2231A]" />
                      <span>{effectiveScopeName}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Desain Interactive Card
                    </span>
                    <select
                      value={selectedCardTemplateId}
                      onChange={(e) => setSelectedCardTemplateId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    >
                      {cardTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.is_default ? '★ (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Group Search & Sync */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari group Feishu..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncGroups}
                    disabled={isSyncing}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
                  </button>
                </div>

                {/* Group Radio List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {isLoadingGroups ? (
                    <div className="p-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                      <span>Memuat group...</span>
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                      Tidak ada group yang cocok
                    </div>
                  ) : (
                    filteredGroups.map((g) => {
                      const isSelected = selectedChatId === g.chatId;
                      return (
                        <label
                          key={g.chatId}
                          onClick={() => setSelectedChatId(g.chatId)}
                          className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-red-500 bg-red-50/50 shadow-sm ring-1 ring-red-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="feishu_group_select"
                              checked={isSelected}
                              onChange={() => setSelectedChatId(g.chatId)}
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">{g.groupName}</span>
                                {g.isDefault && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    Default
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 block">{g.chatId}</span>
                            </div>
                          </div>

                          {(g.memberCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{g.memberCount}</span>
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : activeTab === 'preview_card' ? (
              <div className="bg-slate-100 p-4 rounded-2xl flex justify-center">
                <div className="w-full max-w-sm">
                  <FeishuCardPreview
                    blocksConfig={activeBlocksConfig}
                    variables={previewVarContext}
                    imagePreviewUrl={imagePreviewUrl}
                  />
                </div>
              </div>
            ) : (
              <div className="p-2 bg-slate-950 rounded-2xl overflow-hidden flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl || ''}
                  alt="Preview Attachment"
                  className="max-h-80 w-auto object-contain rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:px-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="text-xs text-slate-500 font-medium">
              Tujuan:{' '}
              <strong className="text-slate-900">
                {selectedGroup ? selectedGroup.groupName : 'Belum dipilih'}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleStartSend}
                disabled={isProcessing || !selectedGroup}
                className="px-6 py-2 font-bold text-white bg-[#E2231A] hover:bg-[#B81912] rounded-xl transition-colors shadow-sm shadow-red-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Kirim ke Feishu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Dialog */}
      <FeishuHistoryDialog
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        moduleName={moduleName}
      />
    </>
  );
}
