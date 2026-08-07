'use client';

import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { IncRow } from './types';

interface MonitoringIncTableProps {
  data: IncRow[];
}

export function MonitoringIncTable({ data }: MonitoringIncTableProps) {
  // Default sort by Tempat Tujuan ascending
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'tempatTujuan', desc: false },
  ]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '0';
    return new Intl.NumberFormat('id-ID').format(val);
  };

  const columns = useMemo<ColumnDef<IncRow>[]>(
    () => [
      {
        accessorKey: 'awb',
        header: 'AWB',
        cell: (info) => (
          <span className="font-mono font-bold text-slate-900">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'tempatTujuan',
        header: 'Tempat Tujuan',
        cell: (info) => (
          <span className="font-medium text-slate-800">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'dpDelivery',
        header: 'DP Delivery',
        cell: (info) => (
          <span className="font-mono text-slate-700">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'namaPenerima',
        header: 'Nama Penerima',
        cell: (info) => (
          <span
            className="text-slate-700 max-w-[140px] truncate block"
            title={(info.getValue() as string) || '-'}
          >
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'alamatPenerima',
        header: 'Alamat Penerima',
        cell: (info) => (
          <span
            className="text-slate-600 max-w-[200px] truncate block"
            title={(info.getValue() as string) || '-'}
          >
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'cod',
        header: () => <div className="text-right">COD</div>,
        cell: (info) => {
          const val = Number(info.getValue()) || 0;
          return (
            <div className="text-right">
              {val > 0 ? (
                <span className="inline-block font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-[4px] border border-amber-200/60 text-[11px] font-medium">
                  Rp {formatCurrency(val)}
                </span>
              ) : (
                <span className="font-mono text-slate-400">0</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'waktuTtd',
        header: 'Waktu TTD',
        cell: (info) => (
          <span className="font-mono text-slate-600">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'maksimalTtd',
        header: 'Maksimal TTD',
        cell: (info) => (
          <span className="font-mono text-slate-700 font-medium">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'waktuUploadSistem',
        header: 'Waktu Upload Sistem',
        cell: (info) => (
          <span className="font-mono text-slate-600">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => <div className="text-center">Status</div>,
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <div className="text-center">
              {status === 'CLEAR' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Clear TTD
                </span>
              ) : status === 'BELUM' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Belum TTD
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  Telat SLA
                </span>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
    },
    enableSortingRemoval: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalRows = data.length;
  const pageIndex = pagination.pageIndex;
  const pageSize = pagination.pageSize;
  const totalPages = table.getPageCount() || 1;

  const startIndex = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endIndex = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="bg-white rounded-[8px] border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all">
      {/* Table Area with Sticky Header & 3-state sort */}
      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="text-slate-600 font-semibold uppercase text-[11px] tracking-wider"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`py-2.5 px-3.5 select-none transition-colors ${
                        canSort ? 'cursor-pointer hover:bg-slate-100/80 hover:text-slate-900' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="inline-flex items-center text-slate-400">
                            {isSorted === 'asc' ? (
                              <ArrowUp className="size-3.5 text-[#E2231A] font-bold" />
                            ) : isSorted === 'desc' ? (
                              <ArrowDown className="size-3.5 text-[#E2231A] font-bold" />
                            ) : (
                              <ArrowUpDown className="size-3 text-slate-300 opacity-70 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400 font-medium">
                  Tidak ada data yang ditemukan
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
        {/* Record count info */}
        <div className="text-xs text-slate-500">
          Menampilkan <span className="font-semibold text-slate-700">{startIndex}</span> sampai{' '}
          <span className="font-semibold text-slate-700">{endIndex}</span> dari{' '}
          <span className="font-semibold text-slate-700">{totalRows}</span> total pengiriman
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center gap-1.5 self-center sm:self-auto">
          <button
            type="button"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            className="size-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const pageNum = i;
            const isActive = pageNum === pageIndex;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => table.setPageIndex(pageNum)}
                className={`size-7 rounded-[6px] text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]'
                }`}
              >
                {pageNum + 1}
              </button>
            );
          })}

          {totalPages > 5 && (
            <>
              <span className="px-1 text-slate-400 text-xs">...</span>
              <button
                type="button"
                onClick={() => table.setPageIndex(totalPages - 1)}
                className={`size-7 rounded-[6px] text-xs font-semibold flex items-center justify-center cursor-pointer ${
                  pageIndex === totalPages - 1
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]'
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            className="size-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Rows Per Page Selector */}
        <div className="flex items-center gap-1.5">
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              table.setPageSize(newSize);
            }}
            className="px-2 py-1 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-2xs cursor-pointer"
          >
            <option value={10}>10 / halaman</option>
            <option value={25}>25 / halaman</option>
            <option value={50}>50 / halaman</option>
            <option value={100}>100 / halaman</option>
          </select>
        </div>
      </div>
    </div>
  );
}
