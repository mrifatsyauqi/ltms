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
  Eye,
  FileText,
  ImageIcon,
  LayoutTemplate,
  History,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FeishuGroup } from '@/services/communication/communication.types';
import { FeishuHistoryDialog } from './feishu-history-dialog';

export type FeishuShareStage =
  | 'idle'
  | 'preparing_data'
  | 'rendering_report'
  | 'generating_caption'
  | 'uploading_image'
  | 'sending_message'
  | 'completed'
  | 'error';

interface PreviewSummaryData {
  total: number;
  belum: number;
  late: number;
  clear: number;
  percent: number;
  topKecamatan?: string[];
}

interface FeishuShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetKota: string;
  generateTime?: string;
  summaryData?: PreviewSummaryData;
  captionPreview?: string;
  imagePreviewUrl?: string | null;
  onExecuteSend: (
    selectedGroup: FeishuGroup,
    updateStage: (stage: FeishuShareStage, progress: number) => void
  ) => Promise<void>;
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
    description: 'Mengekstrak data ringkasan resi dan statistik SLA',
    progress: 15,
  },
  rendering_report: {
    label: 'Rendering Report (1200×900)...',
    description: 'Merender visual gambar laporan beresolusi tinggi',
    progress: 35,
  },
  generating_caption: {
    label: 'Generating Caption...',
    description: 'Menyusun caption WhatsApp & Feishu otomatis',
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

const SAMPLE_FALLBACK_GROUPS: FeishuGroup[] = [
  {
    chatId: 'oc_test_ltms_ujicoba',
    groupName: 'Uji Coba LTMS',
    memberCount: 8,
  },
  {
    chatId: 'oc_batang_all',
    groupName: 'BATANG',
    memberCount: 42,
  },
  {
    chatId: 'oc_batang_barat',
    groupName: 'BATANG BARAT',
    memberCount: 18,
  },
  {
    chatId: 'oc_batang_timur',
    groupName: 'BATANG TIMUR',
    memberCount: 24,
  },
  {
    chatId: 'oc_pekalongan_ops',
    groupName: 'PEKALONGAN OPERATIONAL',
    memberCount: 35,
  },
];

type ActiveTab = 'group' | 'preview_card' | 'preview_image' | 'preview_caption';

export function FeishuShareDialog({
  isOpen,
  onClose,
  targetKota,
  generateTime,
  summaryData,
  captionPreview,
  imagePreviewUrl,
  onExecuteSend,
}: FeishuShareDialogProps) {
  const [groups, setGroups] = useState<FeishuGroup[]>([]);
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

  useEffect(() => {
    if (!isOpen) {
      setStage('idle');
      setProgress(0);
      setErrorMessage(null);
      setActiveTab('group');
      return;
    }

    fetchGroups();
  }, [isOpen]);

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const res = await fetch('/api/communication/feishu/groups');
      const json = await res.json();
      if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
        setGroups(json.data);

        // Ambil waktu sync terakhir dari data terbaru
        const latestUpdate = json.data[0]?.updatedAt;
        if (latestUpdate) {
          const d = new Date(latestUpdate);
          setLastSyncTime(
            new Intl.DateTimeFormat('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(d) + ' WIB'
          );
        } else {
          setLastSyncTime('Hari ini');
        }

        // Auto match target kota
        const matched = json.data.find(
          (g: FeishuGroup) =>
            g.groupName.toLowerCase() === targetKota.toLowerCase() ||
            g.groupName.toLowerCase().includes(targetKota.toLowerCase())
        );
        if (matched) {
          setSelectedChatId(matched.chatId);
        } else if (json.data[0]) {
          setSelectedChatId(json.data[0].chatId);
        }
      } else {
        setGroups(SAMPLE_FALLBACK_GROUPS);
        setSelectedChatId(SAMPLE_FALLBACK_GROUPS[0].chatId);
        setLastSyncTime('Grup Demo');
      }
    } catch (err) {
      console.warn('Gagal memuat group dari API, menggunakan daftar lokal:', err);
      setGroups(SAMPLE_FALLBACK_GROUPS);
      setSelectedChatId(SAMPLE_FALLBACK_GROUPS[0].chatId);
      setLastSyncTime('Lokal');
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
        setGroups(json.data);
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

  const filteredGroups = groups.filter((g) =>
    g.groupName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedGroup = groups.find((g) => g.chatId === selectedChatId);

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

      toast.success(`✓ Monitoring berhasil dikirim ke ${selectedGroup.groupName}`, {
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSending ? undefined : onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-[10px] border border-slate-200 bg-white p-5 shadow-2xl"
          >
            {/* Close button (only when idle/error) */}
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
              /* Smart Progress Loading Pipeline */
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

                {/* Progress Bar */}
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

                {/* Pipeline Step Checklist */}
                <div className="grid grid-cols-2 gap-2 text-left pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2 rounded-full ${
                        progress >= 15 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                      }`}
                    />
                    <span>1. Data Summary</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2 rounded-full ${
                        progress >= 35 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                      }`}
                    />
                    <span>2. Render PNG HD</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2 rounded-full ${
                        progress >= 55 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                      }`}
                    />
                    <span>3. Auto Caption</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2 rounded-full ${
                        progress >= 75 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                      }`}
                    />
                    <span>4. Upload Feishu</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2 rounded-full ${
                        progress >= 90 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                      }`}
                    />
                    <span>5. Send Interactive Card</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2 rounded-full ${
                        progress >= 100 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'
                      }`}
                    />
                    <span>6. Log Activity</span>
                  </div>
                </div>
              </div>
            ) : stage === 'completed' ? (
              /* Completed Feedback */
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Monitoring Berhasil Dikirim!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Interactive Card & Report Image telah terkirim ke{' '}
                    <strong className="text-slate-800">{selectedGroup?.groupName}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              /* Main Interface with Live Preview Tabs */
              <div className="space-y-3.5">
                {/* Header with History Button */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-[8px] bg-red-50 text-[#E2231A] border border-red-100">
                      <Share2 className="size-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        Bagikan Monitoring ke Feishu
                      </h3>
                      <p className="text-xs text-slate-500">
                        Pusat komunikasi pengiriman laporan INC ke Group Feishu
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

                {/* Navigation Tabs */}
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
                    {/* Target City Info Badge */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-[6px] p-2.5 border border-slate-200/80 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Building2 className="size-4 text-[#E2231A]" />
                        <span>Target Kota:</span>
                        <strong className="text-slate-900 font-bold uppercase">
                          {targetKota}
                        </strong>
                      </div>
                      {lastSyncTime && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="size-3 text-slate-400" />
                          Terakhir sinkron: {lastSyncTime}
                        </span>
                      )}
                    </div>

                    {/* Search & Sync Bar */}
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

                    {/* Error Box if any */}
                    {errorMessage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] flex items-start gap-2 text-xs text-rose-800">
                        <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">Pengiriman Gagal:</strong>
                          <p className="mt-0.5">{errorMessage}</p>
                        </div>
                      </div>
                    )}

                    {/* Group Selection List */}
                    <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
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
                        filteredGroups.map((group) => {
                          const isSelected = selectedChatId === group.chatId;
                          return (
                            <label
                              key={group.chatId}
                              onClick={() => setSelectedChatId(group.chatId)}
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
                                  onChange={() => setSelectedChatId(group.chatId)}
                                  className="size-3.5 text-[#E2231A] focus:ring-[#E2231A] accent-[#E2231A]"
                                />
                                <div>
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    {group.groupName}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    ID: {group.chatId}
                                  </p>
                                </div>
                              </div>

                              {group.memberCount ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  <Users className="size-3 text-slate-400" />
                                  {group.memberCount}
                                </span>
                              ) : null}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: PREVIEW CARD (Interactive Card Mockup) */}
                {activeTab === 'preview_card' && (
                  <div className="space-y-3">
                    <div className="p-1 rounded-[8px] bg-slate-100/70 border border-slate-200">
                      {/* Feishu Card Mockup Container */}
                      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-sm overflow-hidden text-xs">
                        {/* Header Banner Merah */}
                        <div className="bg-[#E2231A] text-white p-3 font-semibold text-xs flex items-center justify-between">
                          <span>LTMS • MONITORING INC {targetKota.toUpperCase()}</span>
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                            Interactive Card
                          </span>
                        </div>

                        <div className="p-3.5 space-y-3">
                          {/* Target & Time */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] pb-2 border-b border-slate-100">
                            <div>
                              <p className="text-slate-500">Target Kota:</p>
                              <p className="font-bold text-slate-900">📍 {targetKota.toUpperCase()}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Waktu Generate:</p>
                              <p className="font-semibold text-slate-700">🕒 {generateTime || 'Sekarang'} WIB</p>
                            </div>
                          </div>

                          {/* KPI 4-Card Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-[6px] bg-slate-50 border border-slate-100">
                              <p className="text-[10px] text-slate-500 font-medium">📦 Total Resi</p>
                              <p className="text-sm font-bold text-slate-900 font-mono">
                                {summaryData ? summaryData.total.toLocaleString('id-ID') : '-'}
                              </p>
                            </div>
                            <div className="p-2 rounded-[6px] bg-slate-50 border border-slate-100">
                              <p className="text-[10px] text-slate-500 font-medium">⏳ Belum TTD</p>
                              <p className="text-sm font-bold text-slate-900 font-mono">
                                {summaryData ? summaryData.belum.toLocaleString('id-ID') : '-'}
                              </p>
                            </div>
                            <div className="p-2 rounded-[6px] bg-red-50/50 border border-red-100">
                              <p className="text-[10px] text-red-600 font-medium">🚨 Lewat SLA</p>
                              <p className="text-sm font-bold text-red-600 font-mono">
                                {summaryData ? summaryData.late.toLocaleString('id-ID') : '-'}
                              </p>
                            </div>
                            <div className="p-2 rounded-[6px] bg-emerald-50/50 border border-emerald-100">
                              <p className="text-[10px] text-emerald-600 font-medium">📈 Progress</p>
                              <p className="text-sm font-bold text-emerald-600 font-mono">
                                {summaryData ? `${summaryData.percent}%` : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Top Kecamatan Preview */}
                          {summaryData?.topKecamatan && summaryData.topKecamatan.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                              <p className="font-semibold text-slate-800 mb-1">🏙️ Top Kecamatan:</p>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                {summaryData.topKecamatan.slice(0, 4).map((k, idx) => (
                                  <span key={idx} className="truncate">• {k}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Footer Note */}
                          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Generated by LTMS Enterprise</span>
                            <span>Target Group: {selectedGroup?.groupName || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: PREVIEW GAMBAR HD */}
                {activeTab === 'preview_image' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      Visual laporan HD (1200×900) yang akan dirender dan dilampirkan ke dalam Card:
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
                {activeTab === 'preview_caption' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      Teks ringkasan yang disertakan dalam pengiriman:
                    </p>
                    <pre className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] text-[11px] font-mono text-slate-700 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {captionPreview ||
                        `📊 MONITORING INC\nKota: ${targetKota}\n📦 Total Resi: ${summaryData?.total || 0}\n⏳ Belum TTD: ${summaryData?.belum || 0}\n🚨 Melebihi SLA: ${summaryData?.late || 0}\n📈 Progress: ${summaryData?.percent || 0}%`}
                    </pre>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    {selectedGroup ? (
                      <span>
                        Tujuan:{' '}
                        <strong className="text-slate-800">
                          {selectedGroup.groupName}
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
