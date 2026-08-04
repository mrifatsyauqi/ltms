'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  MoreVertical,
  Eye,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
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

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getStatusBadge = (status: RecentUploadHistoryItem['status']) => {
    switch (status) {
      case 'Success':
      case 'Berhasil':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Selesai
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            Proses
          </span>
        );
      case 'Failed':
      case 'Gagal':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Gagal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <div className="bg-white rounded-[8px] border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
              4
            </span>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Riwayat Upload File
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <Clock className="size-3 text-slate-400" />
            Retensi 7 Hari
          </span>
        </div>

        {/* List Content */}
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {history && history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-2.5 rounded-[6px] border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all shadow-2xs"
              >
                {/* Left: Icon + Metadata */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-8 rounded-[6px] bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                    <FileSpreadsheet className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-xs font-semibold text-slate-800 truncate"
                        title={item.fileName}
                      >
                        {item.fileName}
                      </p>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-medium mt-0.5">
                      <span className="text-slate-700 font-semibold font-mono">
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition-all cursor-pointer"
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
                      className="p-1 rounded-[6px] hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Menu Aksi"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>

                    {/* Dropdown Popover */}
                    {activeMenuId === item.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-44 bg-white rounded-[8px] border border-slate-200 shadow-lg py-1 z-30 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onViewDetail(item);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
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
                            className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
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
                            className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Download className="size-3.5 text-slate-500" />
                            Download File Asli
                          </button>
                        )}

                        <div className="h-px bg-slate-100 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            setItemToDelete(item);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
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
          <span>{history ? history.length : 0} file tersimpan</span>
          {history && history.length > 0 && onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-medium hover:underline cursor-pointer"
            >
              Bersihkan Semua
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Deleting History Item */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150 p-4">
          <div className="bg-white rounded-[10px] border border-slate-200 shadow-xl p-5 max-w-sm w-full animate-in zoom-in-95 duration-200">
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
                className="px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-medium transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteHistoryItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-3 py-1.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
