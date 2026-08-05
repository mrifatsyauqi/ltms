'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  History,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface CommunicationLogItem {
  id: string;
  channel: string;
  chat_id: string;
  message_type: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string | null;
  response_time_ms?: number | null;
  sender_email?: string | null;
  payload_summary?: {
    targetKota?: string;
    total?: number;
    belum?: number;
    late?: number;
    percent?: number;
    endpoint?: string;
    statusCode?: number;
    messageId?: string;
    requestId?: string;
  } | null;
  created_at: string;
}

export interface FeishuHistoryDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  moduleName?: string;
}

export function FeishuHistoryDialog(props: FeishuHistoryDialogProps) {
  const open = props.open ?? props.isOpen ?? false;
  const handleOpenChange = (val: boolean) => {
    if (props.onOpenChange) props.onOpenChange(val);
    if (!val && props.onClose) props.onClose();
  };
  const [logs, setLogs] = useState<CommunicationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/communication/logs?limit=30');
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setLogs(data.data);
      } else {
        setError(data.error || 'Gagal mengambil riwayat komunikasi.');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-[10px]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Riwayat Pengiriman Laporan
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Audit log komunikasi pengiriman laporan ke Feishu Open Platform
              </DialogDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="h-8 px-3 text-xs gap-1.5 rounded-[6px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && logs.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-7 h-7 text-[#E2231A] animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Memuat riwayat pengiriman...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-[8px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold">Gagal memuat log</p>
                <p>{error}</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400">
              <Send className="w-10 h-10 stroke-[1.2] mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Belum ada riwayat pengiriman
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Laporan yang berhasil atau gagal dikirim ke Feishu akan tercatat di sini.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-[8px] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Waktu (WIB)</th>
                    <th className="py-2.5 px-3">Target Scope</th>
                    <th className="py-2.5 px-3">Grup / Chat ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">Pengirim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const targetKota =
                      log.payload_summary?.targetKota || 'Laporan Umum';

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                          {targetKota}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[140px]" title={log.chat_id}>
                          {log.chat_id}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Berhasil
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                              title={log.error_message || 'Pengiriman gagal'}
                            >
                              <XCircle className="w-3 h-3" /> Gagal
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px] truncate max-w-[120px]" title={log.sender_email || ''}>
                          {log.sender_email?.split('@')[0] || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="rounded-[6px] h-8 px-4 text-xs"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
