'use client';

import React, { useState, useEffect } from 'react';
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
  FileText,
  ImageIcon,
  LayoutTemplate,
  History,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  FeishuGroup,
  ReportMetricItem,
} from '@/services/communication/communication.types';
import { FeishuHistoryDialog } from './feishu-history-dialog';
import { MessageTemplateEngine } from '@/services/communication/configuration/message-template.engine';
import type { VisualCardBlocksConfig } from '@/services/communication/configuration/template.types';

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
    updateStage: (stage: FeishuShareStage, progress: number) => void
  ) => Promise<void>;
  /** Backward compatibility */
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
    label: 'Generating Caption...',
    description: 'Menyusun caption ringkasan laporan otomatis',
    progress: 55,
  },
  uploading_image: {
    label: 'Uploading Image to Feishu...',
    description: 'Mengunggah image report ke Feishu Open Platform',
    progress: 75,
  },
  sending_message: {
    label: 'Sending Interactive Card...',
    description: 'Mengirimkan Interactive Card ke Group tujuan',
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

const SAMPLE_FALLBACK_GROUPS: FeishuGroup[] = [
  normalizeFeishuGroup({
    chat_id: 'oc_test_ltms_ujicoba',
    group_name: 'Uji Coba LTMS',
    member_count: 8,
  }),
  normalizeFeishuGroup({
    chat_id: 'oc_batang_all',
    group_name: 'BATANG',
    member_count: 42,
  }),
  normalizeFeishuGroup({
    chat_id: 'oc_batang_barat',
    group_name: 'BATANG BARAT',
    member_count: 18,
  }),
];

type ActiveTab = 'group' | 'preview_card' | 'preview_image' | 'preview_caption';

export function FeishuShareDialog({
  isOpen,
  onClose,
  moduleName = 'Monitoring INC',
  targetScopeName,
  targetScopeType,
  targetKota,
  generateTime,
  summaryData,
  captionPreview,
  imagePreviewUrl,
  onExecuteSend,
}: FeishuShareDialogProps) {
  const [groups, setGroups] = useState<FeishuGroup[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const [cardTemplates, setCardTemplates] = useState<any[]>([]);
  const [selectedMessageTemplateId, setSelectedMessageTemplateId] = useState<string>('');
  const [selectedCardTemplateId, setSelectedCardTemplateId] = useState<string>('');

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
      const [grpRes, msgRes, cardRes] = await Promise.all([
        fetch('/api/communication/groups').then((r) => r.json()),
        fetch('/api/communication/templates/message?status=active').then((r) => r.json()),
        fetch('/api/communication/templates/card?status=active').then((r) => r.json()),
      ]);

      if (grpRes.ok && Array.isArray(grpRes.data) && grpRes.data.length > 0) {
        const normalized = grpRes.data.map(normalizeFeishuGroup);
        setGroups(normalized);
        const defaultGrp = normalized.find((g: any) => g.is_default || g.isDefault);
        if (defaultGrp) {
          setSelectedChatId(defaultGrp.chatId || (defaultGrp as any).chat_id);
        } else if (normalized[0]) {
          setSelectedChatId(normalized[0].chatId || (normalized[0] as any).chat_id);
        }
      } else {
        setGroups(SAMPLE_FALLBACK_GROUPS);
        setSelectedChatId(SAMPLE_FALLBACK_GROUPS[0].chatId);
      }

      if (msgRes.ok && Array.isArray(msgRes.data)) {
        setMessageTemplates(msgRes.data);
        const defMsg = msgRes.data.find((t: any) => t.is_default) || msgRes.data[0];
        if (defMsg) setSelectedMessageTemplateId(defMsg.id);
      }

      if (cardRes.ok && Array.isArray(cardRes.data)) {
        setCardTemplates(cardRes.data);
        const defCard = cardRes.data.find((t: any) => t.is_default) || cardRes.data[0];
        if (defCard) setSelectedCardTemplateId(defCard.id);
      }
    } catch (err) {
      console.warn('Gagal memuat konfigurasi komunikasi:', err);
      setGroups(SAMPLE_FALLBACK_GROUPS);
      setSelectedChatId(SAMPLE_FALLBACK_GROUPS[0].chatId);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleSyncGroups = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/communication/feishu/groups/sync', {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
        const normalized = json.data.map(normalizeFeishuGroup);
        setGroups(normalized);
        const now = new Date();
        setLastSyncTime(
          new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(now) + ' WIB'
        );
        toast.success(`✔ Berhasil menyinkronkan ${json.data.length} Group Feishu!`);
      } else {
        toast.info(
          json.error ||
            'Sinkronisasi selesai (Gunakan data grup yang tersedia atau konfigurasikan Feishu Bot).'
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyinkronkan group dari Feishu API.');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredGroups = groups.filter((g: any) => {
    const name = g.groupName || g.group_name || '';
    return name.toLowerCase().includes((searchQuery || '').toLowerCase());
  });

  const selectedGroup = groups.find(
    (g: any) => (g.chatId || g.chat_id) === selectedChatId
  );

  const isSending = stage !== 'idle' && stage !== 'completed' && stage !== 'error';

  const handleStartSend = async () => {
    if (!selectedGroup || isSending) return;

    setErrorMessage(null);
    try {
      await onExecuteSend(selectedGroup, (newStage, newProgress) => {
        setStage(newStage);
        setProgress(newProgress);
      });

      setStage('completed');
      setProgress(100);

      const displayGroupName = selectedGroup.groupName || (selectedGroup as any).group_name || 'Group Feishu';
      toast.success(`✓ Laporan berhasil dikirim ke ${displayGroupName}`, {
        description: 'Interactive Card & Report Image telah terkirim.',
        position: 'bottom-right',
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Send error:', err);
      setStage('error');
      setErrorMessage(err?.message || 'Gagal mengirim pesan ke Group Feishu.');
      toast.error('Gagal mengirim ke Feishu: ' + (err?.message || 'Unknown error'));
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <FeishuHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />

      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSending ? undefined : onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-[10px] border border-slate-200 bg-white p-5 shadow-2xl"
          >
            {!isSending && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 rounded-[6px] p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}

            {isSending ? (
              <div className="py-6 text-center space-y-5">
                <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 text-[#E2231A] ring-8 ring-red-50/50">
                  <Loader2 className="size-8 animate-spin" />
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-slate-900 p-1 text-white shadow-xs">
                    <Sparkles className="size-3" />
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {STAGE_CONFIG[stage]?.label || 'Memproses Pengiriman...'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {STAGE_CONFIG[stage]?.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#E2231A] rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut', duration: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Feishu Delivery Pipeline</span>
                    <span className="font-bold text-slate-700">{progress}%</span>
                  </div>
                </div>
              </div>
            ) : stage === 'completed' ? (
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Laporan Berhasil Dikirim!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Interactive Card & Report Image telah terkirim ke{' '}
                    <strong className="text-slate-800">
                      {selectedGroup?.groupName || (selectedGroup as any)?.group_name || 'Group Feishu'}
                    </strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-[8px] bg-red-50 text-[#E2231A] border border-red-100">
                      <Share2 className="size-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        Bagikan {moduleName} ke Feishu
                      </h3>
                      <p className="text-xs text-slate-500">
                        Pusat komunikasi resmi pengiriman laporan LTMS Enterprise
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-[#E2231A] transition-colors p-1.5 rounded-[6px] hover:bg-slate-50 border border-slate-200/80 mr-6 cursor-pointer"
                  >
                    <History className="size-3.5" />
                    <span>Riwayat</span>
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-slate-200/80 pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('group')}
                    className={`px-3 py-1.5 rounded-[6px] font-medium transition-all cursor-pointer ${
                      activeTab === 'group'
                        ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    1. Pilih Group Tujuan
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('preview_card')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] font-medium transition-all cursor-pointer ${
                      activeTab === 'preview_card'
                        ? 'bg-[#E2231A] text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutTemplate className="size-3.5" />
                    Preview Card
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('preview_image')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] font-medium transition-all cursor-pointer ${
                      activeTab === 'preview_image'
                        ? 'bg-[#E2231A] text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon className="size-3.5" />
                    Preview Gambar
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('preview_caption')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] font-medium transition-all cursor-pointer ${
                      activeTab === 'preview_caption'
                        ? 'bg-[#E2231A] text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="size-3.5" />
                    Preview Caption
                  </button>
                </div>

                {/* TAB 1: GROUP SELECTION */}
                {activeTab === 'group' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 rounded-[6px] p-2.5 border border-slate-200/80 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Building2 className="size-4 text-[#E2231A]" />
                        <span>Cakupan Data:</span>
                        <strong className="text-slate-900 font-bold uppercase">
                          {effectiveScopeName}
                        </strong>
                      </div>
                      {lastSyncTime && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="size-3 text-slate-400" />
                          Terakhir sinkron: {lastSyncTime}
                        </span>
                      )}
                    </div>

                    {/* Template Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-slate-50 rounded-[6px] border border-slate-200/80">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Template Pesan (Caption)
                        </label>
                        <select
                          value={selectedMessageTemplateId}
                          onChange={(e) => setSelectedMessageTemplateId(e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-[5px] text-xs font-medium text-slate-800 focus:outline-none focus:border-[#E2231A]"
                        >
                          {messageTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.template_name} {t.is_default ? '★ (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Desain Kartu (Card Template)
                        </label>
                        <select
                          value={selectedCardTemplateId}
                          onChange={(e) => setSelectedCardTemplateId(e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-[5px] text-xs font-medium text-slate-800 focus:outline-none focus:border-[#E2231A]"
                        >
                          {cardTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.template_name} {t.is_default ? '★ (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari group Feishu..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-[6px] border border-slate-200 text-xs focus:border-[#E2231A] focus:ring-1 focus:ring-[#E2231A] focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSyncGroups}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        title="Sinkronkan daftar Group dari Feishu API"
                      >
                        <RefreshCw
                          className={`size-3 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`}
                        />
                        <span>{isSyncing ? 'Sinkron...' : 'Sinkronkan Ulang'}</span>
                      </button>
                    </div>

                    {errorMessage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] flex items-start gap-2 text-xs text-rose-800">
                        <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">Pengiriman Gagal:</strong>
                          <p className="mt-0.5">{errorMessage}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                      {isLoadingGroups ? (
                        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="size-4 animate-spin text-[#E2231A]" />
                          <span>Memuat daftar group Feishu...</span>
                        </div>
                      ) : filteredGroups.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-[6px]">
                          Tidak ada group Feishu yang cocok dengan pencarian.
                        </div>
                      ) : (
                        filteredGroups.map((group: any) => {
                          const cId = group.chat_id || group.chatId;
                          const gName = group.group_name || group.groupName;
                          const isSelected = selectedChatId === cId;
                          return (
                            <label
                              key={cId}
                              onClick={() => setSelectedChatId(cId)}
                              className={`flex items-center justify-between p-2.5 rounded-[6px] border transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-[#E2231A] bg-red-50/40 shadow-2xs ring-1 ring-[#E2231A]'
                                  : 'border-slate-200 bg-white hover:bg-slate-50/80'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="feishu_group"
                                  checked={isSelected}
                                  onChange={() => setSelectedChatId(cId)}
                                  className="size-3.5 text-[#E2231A] focus:ring-[#E2231A] accent-[#E2231A]"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-slate-900 leading-tight">
                                      {gName}
                                    </p>
                                    {group.is_default && (
                                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    ID: {cId}
                                  </p>
                                </div>
                              </div>

                              {group.member_count || group.memberCount ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  <Users className="size-3 text-slate-400" />
                                  {group.member_count || group.memberCount}
                                </span>
                              ) : null}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: PREVIEW CARD */}
                {/* TAB 2: PREVIEW CARD */}
                {activeTab === 'preview_card' && (() => {
                  const currentCardTpl = cardTemplates.find((t) => t.id === selectedCardTemplateId);
                  const blocksConfig: VisualCardBlocksConfig | undefined = currentCardTpl?.blocks_config;
                  const headerBg =
                    blocksConfig?.theme === 'dark'
                      ? 'bg-slate-800'
                      : blocksConfig?.theme === 'blue'
                      ? 'bg-blue-600'
                      : blocksConfig?.theme === 'green'
                      ? 'bg-emerald-600'
                      : 'bg-[#E2231A]';

                  const previewVarContext = {
                    pickup_dp: effectiveScopeName,
                    drop_point: effectiveScopeName,
                    target_city: effectiveScopeName,
                    city: effectiveScopeName,
                    target_kota: effectiveScopeName,
                    generated_at: generateTime || '05 Agustus 2026 08.30 WIB',
                    today: '05 Agu 2026',
                    time: '08:30 WIB',
                    total_inc: summaryData?.total?.toLocaleString('id-ID') || '0',
                    total_package: summaryData?.total?.toLocaleString('id-ID') || '0',
                    total_arrived: summaryData?.total?.toLocaleString('id-ID') || '0',
                    total_delivery: summaryData?.total?.toLocaleString('id-ID') || '0',
                    clear_ttd: summaryData?.clear?.toLocaleString('id-ID') || '0',
                    pending_ttd: summaryData?.belum?.toLocaleString('id-ID') || '0',
                    pending_package: summaryData?.belum?.toLocaleString('id-ID') || '0',
                    over_sla: summaryData?.late?.toLocaleString('id-ID') || '0',
                    sla_percentage: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
                    delivery_percentage: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
                    progress: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
                    last_scan_time: '05 Agustus 2026 08:26 WIB',
                    last_scan_awb: 'JT1234567890',
                    last_scan_status: 'Delivery',
                    destination_subdistricts: summaryData?.topKecamatan?.join('\n') || 'Belum ada data',
                    district_list: summaryData?.topKecamatan?.join('\n') || '',
                    footer: blocksConfig?.footer?.description || 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
                  };

                  return (
                    <div className="space-y-3">
                      <div className="p-1 rounded-[8px] bg-slate-100/70 border border-slate-200">
                        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-sm overflow-hidden text-xs">
                          {/* Banner Header */}
                          <div className={`${headerBg} text-white p-3 font-semibold text-xs flex items-center justify-between`}>
                            <div>
                              <div className="font-bold text-xs">
                                {MessageTemplateEngine.render(
                                  blocksConfig?.header?.title || blocksConfig?.title || `LTMS | ${moduleName.toUpperCase()}`,
                                  previewVarContext
                                )}
                              </div>
                              {blocksConfig?.header?.subtitle && (
                                <div className="text-[10px] text-white/80 font-normal mt-0.5">
                                  {MessageTemplateEngine.render(blocksConfig.header.subtitle, previewVarContext)}
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                              Feishu Card
                            </span>
                          </div>

                          <div className="p-3.5 space-y-3">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] pb-2 border-b border-slate-100">
                              {blocksConfig?.header?.showPickupDp && (
                                <div>
                                  <p className="text-slate-400 font-semibold">{blocksConfig.header.pickupDpLabel || 'Pickup DP'}:</p>
                                  <p className="font-bold text-slate-800">
                                    {MessageTemplateEngine.render(blocksConfig.header.pickupDpValue || '{{pickup_dp}}', previewVarContext)}
                                  </p>
                                </div>
                              )}
                              {blocksConfig?.header?.showTargetCity && (
                                <div>
                                  <p className="text-slate-400 font-semibold">{blocksConfig.header.targetCityLabel || 'Tujuan'}:</p>
                                  <p className="font-bold text-slate-800">
                                    {MessageTemplateEngine.render(blocksConfig.header.targetCityValue || '{{target_city}}', previewVarContext)}
                                  </p>
                                </div>
                              )}
                              {blocksConfig?.header?.showUpdate && (
                                <div className="col-span-2 pt-0.5">
                                  <p className="text-slate-400 font-semibold">{blocksConfig.header.updateLabel || 'Update'}:</p>
                                  <p className="font-medium text-slate-700">
                                    {MessageTemplateEngine.render(blocksConfig.header.updateValue || '{{generated_at}}', previewVarContext)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Last Scan Block */}
                            {blocksConfig?.lastScan?.show && (
                              <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-0.5">
                                <div className="font-bold text-slate-800">{blocksConfig.lastScan.title || 'Last Scan'}</div>
                                <div className="text-slate-600 text-[10px]">
                                  • Waktu: <strong className="text-slate-800">{MessageTemplateEngine.render(blocksConfig.lastScan.scanTimeValue || '{{last_scan_time}}', previewVarContext)}</strong>
                                </div>
                                <div className="text-slate-600 text-[10px]">
                                  • AWB: <strong className="text-slate-800">{MessageTemplateEngine.render(blocksConfig.lastScan.awbValue || '{{last_scan_awb}}', previewVarContext)}</strong>
                                </div>
                                <div className="text-slate-600 text-[10px]">
                                  • Status: <strong className="text-slate-800">{MessageTemplateEngine.render(blocksConfig.lastScan.statusValue || '{{last_scan_status}}', previewVarContext)}</strong>
                                </div>
                              </div>
                            )}

                            {/* KPI Grid */}
                            {blocksConfig?.kpiGrid ? (
                              <div className="space-y-1">
                                <div className="text-[11px] font-bold text-slate-800">
                                  📊 {blocksConfig.kpiGrid.title || 'Ringkasan Monitoring'}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                  {(blocksConfig.kpiGrid.items || []).map((kpi, idx) => (
                                    <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-100">
                                      <p className="text-[10px] text-slate-500 font-medium truncate">{kpi.label}</p>
                                      <p
                                        className={`text-xs font-bold font-mono mt-0.5 ${
                                          kpi.color === 'red'
                                            ? 'text-[#E2231A]'
                                            : kpi.color === 'green'
                                            ? 'text-emerald-600'
                                            : kpi.color === 'blue'
                                            ? 'text-blue-600'
                                            : 'text-slate-900'
                                        }`}
                                      >
                                        {MessageTemplateEngine.render(kpi.valueTemplate || '', previewVarContext)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : summaryData?.metrics && summaryData.metrics.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {summaryData.metrics.map((m, idx) => (
                                  <div key={idx} className="p-2 rounded-[6px] bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] text-slate-500 font-medium">{m.label}</p>
                                    <p className="text-sm font-bold text-slate-900 font-mono">{String(m.value)}</p>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {/* Kecamatan List */}
                            {blocksConfig?.subdistricts?.show && (
                              <div className="pt-1 border-t border-slate-100 text-[10px] space-y-1">
                                <div className="font-bold text-slate-800">{blocksConfig.subdistricts.title || '📍 Kecamatan Tujuan'}</div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-600 whitespace-pre-line leading-relaxed">
                                  {summaryData?.topKecamatan?.join('\n') || 'BATANG (31 AWB)\nWARUNGASEM (26 AWB)\nLIMPUNG (23 AWB)'}
                                </div>
                              </div>
                            )}

                            {/* Action Button */}
                            {blocksConfig?.actionButton?.enabled && (
                              <div className="pt-1">
                                <div className="w-full py-1.5 bg-[#E2231A] text-white text-center rounded font-bold text-[11px] shadow-xs">
                                  {blocksConfig.actionButton.label || '🚀 Buka Dashboard LTMS'}
                                </div>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="pt-2 border-t border-slate-100 text-[9px] text-slate-400 text-center leading-tight whitespace-pre-line">
                              {blocksConfig?.footer?.description || blocksConfig?.footerText || 'Logistics Traceability & Monitoring System (LTMS)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 3: PREVIEW GAMBAR */}
                {activeTab === 'preview_image' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      Visual laporan HD (1200×900) yang akan dilampirkan ke dalam Card:
                    </p>
                    <div className="p-2 rounded-[8px] bg-slate-100 border border-slate-200 max-h-[220px] overflow-y-auto flex items-center justify-center">
                      {imagePreviewUrl ? (
                        <img
                          src={imagePreviewUrl}
                          alt="Preview Laporan"
                          className="max-h-[190px] w-auto rounded-[4px] shadow-sm object-contain"
                        />
                      ) : (
                        <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
                          <ImageIcon className="size-8 stroke-[1.2] text-slate-300" />
                          <span>Gambar laporan otomatis dirender saat pengiriman.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: PREVIEW CAPTION */}
                {activeTab === 'preview_caption' && (() => {
                  const currentMsgTpl = messageTemplates.find((t) => t.id === selectedMessageTemplateId);
                  const previewVarContext = {
                    pickup_dp: effectiveScopeName,
                    drop_point: effectiveScopeName,
                    target_city: effectiveScopeName,
                    city: effectiveScopeName,
                    target_kota: effectiveScopeName,
                    generated_at: generateTime || '05 Agustus 2026 08.30 WIB',
                    today: '05 Agu 2026',
                    time: '08:30 WIB',
                    total_inc: summaryData?.total?.toLocaleString('id-ID') || '0',
                    total_package: summaryData?.total?.toLocaleString('id-ID') || '0',
                    total_arrived: summaryData?.total?.toLocaleString('id-ID') || '0',
                    total_delivery: summaryData?.total?.toLocaleString('id-ID') || '0',
                    clear_ttd: summaryData?.clear?.toLocaleString('id-ID') || '0',
                    pending_ttd: summaryData?.belum?.toLocaleString('id-ID') || '0',
                    pending_package: summaryData?.belum?.toLocaleString('id-ID') || '0',
                    over_sla: summaryData?.late?.toLocaleString('id-ID') || '0',
                    sla_percentage: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
                    delivery_percentage: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
                    progress: summaryData?.percent !== undefined ? String(summaryData.percent) : '0',
                    last_scan_time: '05 Agustus 2026 08:26 WIB',
                    last_scan_awb: 'JT1234567890',
                    last_scan_status: 'Delivery',
                    destination_subdistricts: summaryData?.topKecamatan?.join('\n') || 'Belum ada data',
                    district_list: summaryData?.topKecamatan?.join('\n') || '',
                    footer: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
                  };

                  const renderedText = currentMsgTpl
                    ? MessageTemplateEngine.render(currentMsgTpl.content, previewVarContext)
                    : captionPreview ||
                      `📊 ${moduleName.toUpperCase()}\nCakupan: ${effectiveScopeName}\nTotal Resi: ${
                        summaryData?.total || 0
                      }`;

                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">
                        Teks ringkasan yang disertakan dalam pengiriman:
                      </p>
                      <pre className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] text-[11px] font-mono text-slate-700 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {renderedText}
                      </pre>
                    </div>
                  );
                })()}

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    {selectedGroup ? (
                      <span>
                        Tujuan:{' '}
                        <strong className="text-slate-800">
                          {selectedGroup.groupName || (selectedGroup as any).group_name || 'Group Feishu'}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-amber-600">Pilih group tujuan</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                    >
                      Batal
                    </button>

                    <button
                      type="button"
                      onClick={handleStartSend}
                      disabled={!selectedGroup || isSending}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[#E2231A] hover:bg-[#C91C15] active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="size-3.5" />
                      Kirim ke Feishu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>
    </>
  );
}
