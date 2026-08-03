'use client';

import { FileSpreadsheet, Download, MoreVertical, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface HistoryItem {
  id: string;
  fileName: string;
  targetCity: string;
  totalResi: number;
  uploadDate: string;
  status: 'Berhasil' | 'Gagal';
  downloadData?: unknown;
}

interface RecentHistoryCardProps {
  history: HistoryItem[];
  onDownloadHistory?: (item: HistoryItem) => void;
}

export function RecentHistoryCard({ history, onDownloadHistory }: RecentHistoryCardProps) {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Clock className="size-4 text-slate-400" />
          Riwayat File Terakhir
        </h3>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama File</th>
                <th className="py-3 px-4">Target Kota</th>
                <th className="py-3 px-4">Jumlah Data</th>
                <th className="py-3 px-4">Upload</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <FileSpreadsheet className="size-4" />
                    </div>
                    <span className="truncate max-w-[220px]" title={item.fileName}>
                      {item.fileName}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                      {item.targetCity}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {item.totalResi.toLocaleString('id-ID')} Resi
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{item.uploadDate}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onDownloadHistory?.(item)}
                        className="h-7 px-2.5 rounded-lg text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 gap-1"
                      >
                        <Download className="size-3" />
                        Download
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
