'use client';

import { useState, useRef, useEffect } from 'react';
import {
  History,
  Eye,
  MoreVertical,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { RecentUploadHistoryItem } from './types';

interface RecentHistoryCardProps {
  history: RecentUploadHistoryItem[];
  onViewDetail: (item: RecentUploadHistoryItem) => void;
  onRegenerate?: (item: RecentUploadHistoryItem) => void;
  onDownloadOriginal?: (item: RecentUploadHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory?: () => void;
}

export function RecentHistoryCard({
  history,
  onViewDetail,
  onRegenerate,
  onDownloadOriginal,
  onDeleteHistoryItem,
  onClearHistory,
}: RecentHistoryCardProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RecentUploadHistoryItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusBadge = (status: RecentUploadHistoryItem['status']) => {
    switch (status) {
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="size-2.5 animate-spin" /> Processing
          </span>
        );
      case 'Success':
      case 'Berhasil':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="size-2.5 text-emerald-600" /> Success
          </span>
        );
      case 'Failed':
      case 'Gagal':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="size-2.5 text-rose-600" /> Failed
          </span>
        );
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between h-[230px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-5 rounded-[6px] bg-slate-100 text-slate-700">
              <History className="size-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Riwayat Upload
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Maks. 7 Hari Terakhir
          </span>
        </div>

        {/* History List */}
        <div className="overflow-y-auto max-h-[140px] pr-1 space-y-1.5 my-1 flex-1 no-scrollbar">
          {history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.id}
                className="group relative flex items-center justify-between p-2 rounded-lg border border-[#E5E7EB] bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
              >
                {/* Left Info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="size-7 rounded-[6px] bg-white border border-[#E5E7EB] text-slate-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        className="text-xs font-semibold text-slate-900 truncate max-w-[150px]"
                        title={item.fileName}
                      >
                        {item.fileName}
                      </p>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-medium mt-0.5">
                      <span className="text-slate-700 font-semibold">
                        {item.totalResi.toLocaleString('id-ID')} Resi
                      </span>
                      <span>•</span>
                      <span className="text-[#E2231A] font-semibold">{item.targetKota}</span>
                      <span>•</span>
                      <span className="text-slate-400">{item.uploadTimestamp}</span>
                    </div>
                  </div>
                </div>

                {/* Right Actions: Lihat (Eye) + Dropdown (...) */}
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => onViewDetail(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-white hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-medium border border-[#E5E7EB] shadow-2xs transition-all duration-150"
                    title="Lihat Data Monitoring"
                  >
                    <Eye className="size-3 text-slate-600" />
                    <span>Lihat</span>
                  </button>

                  {/* Dropdown Menu Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                      }}
                      className="p-1 rounded-[6px] hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                      title="Menu Aksi"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>

                    {/* Dropdown Popover */}
                    {activeMenuId === item.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg border border-[#E5E7EB] shadow-lg py-1 z-30 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onViewDetail(item);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                        >
                          <Eye className="size-3.5 text-slate-500" />
                          Lihat Detail
                        </button>

                        {onRegenerate && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onRegenerate(item);
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                          >
                            <RefreshCw className="size-3.5 text-slate-500" />
                            Generate Ulang
                          </button>
                        )}

                        {onDownloadOriginal && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onDownloadOriginal(item);
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                          >
                            <Download className="size-3.5 text-slate-500" />
                            Download File Asli
                          </button>
                        )}

                        <div className="h-px bg-[#E5E7EB] my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            setItemToDelete(item);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                        >
                          <Trash2 className="size-3.5 text-rose-500" />
                          Hapus Riwayat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <p className="text-xs font-medium text-slate-400">
                Belum ada riwayat upload file
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Riwayat upload dalam 7 hari terakhir akan otomatis dicatat di sini
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
          <span>{history.length} file tersimpan</span>
          {history.length > 0 && onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-medium hover:underline"
            >
              Bersihkan Semua
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Deleting History Item */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150 p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl p-5 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-[8px] bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="size-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900">
                  Hapus Riwayat Upload?
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus data riwayat{' '}
                  <span className="font-semibold text-slate-800">
                    &quot;{itemToDelete.fileName}&quot;
                  </span>
                  ? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-[8px] border border-[#E5E7EB] bg-white hover:bg-slate-50 active:scale-98 text-slate-700 text-xs font-medium transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteHistoryItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-3 py-1.5 rounded-[8px] bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-semibold shadow-xs transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
