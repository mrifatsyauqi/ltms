'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IncRow } from './types';

interface MonitoringIncTableProps {
  data: IncRow[];
}

export function MonitoringIncTable({ data }: MonitoringIncTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const totalRows = data.length;
  const effectivePageSize = pageSize === -1 ? totalRows || 1 : pageSize;
  const totalPages = Math.ceil(totalRows / effectivePageSize) || 1;

  const paginatedData = useMemo(() => {
    if (pageSize === -1) return data;
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const endIndex = Math.min(currentPage * effectivePageSize, totalRows);

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '0';
    return new Intl.NumberFormat('id-ID').format(val);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Table Area with Sticky Header */}
      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-slate-200">
            <tr className="text-slate-600 font-bold uppercase text-[11px] tracking-wider">
              <th className="py-3 px-3.5 font-bold">AWB</th>
              <th className="py-3 px-3.5 font-bold">Tempat Tujuan</th>
              <th className="py-3 px-3.5 font-bold">Nama Penerima</th>
              <th className="py-3 px-3.5 font-bold">Alamat Penerima</th>
              <th className="py-3 px-3.5 font-bold text-right">COD</th>
              <th className="py-3 px-3.5 font-bold">Waktu TTD</th>
              <th className="py-3 px-3.5 font-bold">Maksimal TTD</th>
              <th className="py-3 px-3.5 font-bold">Waktu Upload ke Sistem</th>
              <th className="py-3 px-3.5 font-bold text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                  Tidak ada data yang ditemukan
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                return (
                  <tr
                    key={`${row.awb}-${idx}`}
                    className="even:bg-slate-50/40 hover:bg-slate-50 transition-colors"
                  >
                    {/* 1. AWB */}
                    <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                      {row.awb}
                    </td>

                    {/* 2. Tempat Tujuan */}
                    <td className="py-2.5 px-3.5 font-medium text-slate-800">
                      {row.tempatTujuan}
                    </td>

                    {/* 3. Nama Penerima */}
                    <td className="py-2.5 px-3.5 text-slate-700">
                      {row.namaPenerima}
                    </td>

                    {/* 4. Alamat Penerima */}
                    <td className="py-2.5 px-3.5 text-slate-600 max-w-[240px] truncate" title={row.alamatPenerima}>
                      {row.alamatPenerima}
                    </td>

                    {/* 5. COD */}
                    <td className="py-2.5 px-3.5 font-mono text-right text-slate-800">
                      {formatCurrency(row.cod)}
                    </td>

                    {/* 6. Waktu TTD */}
                    <td className="py-2.5 px-3.5 font-mono text-slate-600">
                      {row.waktuTtd || '-'}
                    </td>

                    {/* 7. Maksimal TTD */}
                    <td className="py-2.5 px-3.5 font-mono text-slate-600">
                      {row.maksimalTtd || '-'}
                    </td>

                    {/* 8. Waktu Upload ke Sistem */}
                    <td className="py-2.5 px-3.5 font-mono text-slate-600">
                      {row.waktuUploadSistem || '-'}
                    </td>

                    {/* 9. Status */}
                    <td className="py-2.5 px-3.5 text-center">
                      {row.status === 'CLEAR' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Clear TTD
                        </span>
                      )}
                      {row.status === 'BELUM' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Belum TTD
                        </span>
                      )}
                      {row.status === 'LATE' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Telat SLA
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-white text-xs text-slate-600">
        <div>
          Menampilkan <span className="font-semibold text-slate-900">{startIndex}</span> -{' '}
          <span className="font-semibold text-slate-900">{endIndex}</span> dari{' '}
          <span className="font-semibold text-slate-900">{totalRows}</span> data
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="size-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs"
          >
            <ChevronLeft className="size-4" />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const pageNum = i + 1;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`size-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {totalPages > 5 && (
            <>
              <span className="px-1 text-slate-400">...</span>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                className={`size-7 rounded-lg text-xs font-semibold flex items-center justify-center ${
                  currentPage === totalPages
                    ? 'bg-red-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="size-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Rows Per Page Selector */}
        <div className="flex items-center gap-1.5">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-2xs"
          >
            <option value={10}>10 / halaman</option>
            <option value={25}>25 / halaman</option>
            <option value={50}>50 / halaman</option>
            <option value={100}>100 / halaman</option>
            <option value={-1}>Semua</option>
          </select>
        </div>
      </div>
    </div>
  );
}
