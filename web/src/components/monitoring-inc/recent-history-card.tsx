'use client';

import { FileSpreadsheet, Download, MoreVertical } from 'lucide-react';
import { RecentUploadHistoryItem } from './types';

interface RecentHistoryCardProps {
  historyItem: RecentUploadHistoryItem | null;
  onDownloadHistory?: (item: RecentUploadHistoryItem) => void;
}

export function RecentHistoryCard({
  historyItem,
  onDownloadHistory,
}: RecentHistoryCardProps) {
  if (!historyItem) {
    return (
      <div className="bg-white rounded-[8px] border border-slate-200 p-3.5 shadow-xs">
        <h4 className="text-xs font-semibold text-slate-900 tracking-tight mb-2">
          Riwayat File Terakhir
        </h4>
        <div className="py-2.5 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-[6px]">
          Belum ada riwayat generate monitoring sebelumnya.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[8px] border border-slate-200 p-3.5 shadow-xs space-y-2 max-h-[140px]">
      <h4 className="text-xs font-semibold text-slate-900 tracking-tight">
        Riwayat File Terakhir
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-100 pb-1">
              <th className="pb-1.5 font-semibold">Nama File</th>
              <th className="pb-1.5 font-semibold">Target Kota</th>
              <th className="pb-1.5 font-semibold">Jumlah Resi</th>
              <th className="pb-1.5 font-semibold">Upload</th>
              <th className="pb-1.5 font-semibold">Status</th>
              <th className="pb-1.5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  <div className="size-5 rounded-[4px] bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="size-3.5" />
                  </div>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={historyItem.fileName}>
                    {historyItem.fileName}
                  </span>
                </div>
              </td>
              <td className="py-2 pr-2 font-medium text-slate-700">
                {historyItem.targetKota}
              </td>
              <td className="py-2 pr-2 font-medium text-slate-700 font-mono">
                {historyItem.totalResi.toLocaleString('id-ID')} Resi
              </td>
              <td className="py-2 pr-2 text-slate-500">
                {historyItem.uploadTimestamp}
              </td>
              <td className="py-2 pr-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {historyItem.status}
                </span>
              </td>
              <td className="py-2 text-right">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDownloadHistory?.(historyItem)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-blue-600 font-medium text-[11px] shadow-2xs transition-all cursor-pointer"
                  >
                    <Download className="size-3" />
                    Lihat
                  </button>
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-100 cursor-pointer"
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
