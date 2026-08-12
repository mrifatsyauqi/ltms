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
  /** Judul title bar excel-style di atas tabel, mis. "BATANG01". */
  title: string;
}

export function MonitoringIncTable({ data, title }: MonitoringIncTableProps) {
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
          <span className="font-mono font-bold text-foreground">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'tempatTujuan',
        header: 'Tempat Tujuan',
        cell: (info) => (
          <span className="font-medium text-foreground">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'dpDelivery',
        header: 'DP Delivery',
        cell: (info) => (
          <span className="font-mono text-muted-foreground">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'namaPenerima',
        header: 'Nama Penerima',
        cell: (info) => (
          <span className="text-muted-foreground">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'alamatPenerima',
        header: 'Alamat Penerima',
        cell: (info) => (
          <span className="text-muted-foreground">
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
                <span className="font-mono text-muted-foreground">0</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'waktuTtd',
        header: 'Waktu TTD',
        cell: (info) => (
          <span className="font-mono text-muted-foreground">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'maksimalTtd',
        header: 'Maksimal TTD',
        cell: (info) => (
          <span className="font-mono text-foreground font-medium">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'waktuUploadSistem',
        header: 'Waktu Upload Sistem',
        cell: (info) => (
          <span className="font-mono text-muted-foreground">
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

  // Warna title bar excel-style - REUSE persis dari MonitoringTable
  // (Monitoring Delivery), jangan definisikan warna baru.
  return (
    <div className="bg-card rounded-[8px] border border-border shadow-xs overflow-hidden flex flex-col transition-all">
      <div className="bg-[#4f6272] text-white px-3 py-2.5 text-center text-sm font-bold uppercase tracking-wide">
        MONITORING INC {title}
      </div>
      {/* Table Area with Sticky Header & 3-state sort - whitespace-nowrap di
          setiap sel supaya kolom melebar sesuai isi konten (tidak ada teks
          yang terpotong jadi 2 baris); overflow-x-auto di wrapper menangani
          scroll horizontal kalau total lebar tabel > lebar container. */}
      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <table className="w-full text-left text-xs border-collapse border border-border">
          <thead className="sticky top-0 z-10 bg-card border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="text-foreground font-bold uppercase text-[11px] tracking-wider"
              >
                <th className="py-2.5 px-3.5 border border-border text-center whitespace-nowrap">No</th>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`py-2.5 px-3.5 border border-border whitespace-nowrap select-none transition-colors ${
                        canSort ? 'cursor-pointer hover:bg-accent/80' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="inline-flex items-center text-muted-foreground">
                            {isSorted === 'asc' ? (
                              <ArrowUp className="size-3.5 text-[#E2231A] font-bold" />
                            ) : isSorted === 'desc' ? (
                              <ArrowDown className="size-3.5 text-[#E2231A] font-bold" />
                            ) : (
                              <ArrowUpDown className="size-3 text-muted-foreground opacity-70 hover:opacity-100" />
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
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground font-medium border border-border">
                  Tidak ada data yang ditemukan
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/70 transition-colors"
                >
                  <td className="py-2.5 px-3.5 border border-border whitespace-nowrap text-center text-muted-foreground font-medium">
                    {startIndex + idx}
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-3.5 border border-border whitespace-nowrap">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-muted/50">
        {/* Record count info */}
        <div className="text-xs text-muted-foreground">
          Menampilkan <span className="font-semibold text-foreground">{startIndex}</span> sampai{' '}
          <span className="font-semibold text-foreground">{endIndex}</span> dari{' '}
          <span className="font-semibold text-foreground">{totalRows}</span> total pengiriman
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center gap-1.5 self-center sm:self-auto">
          <button
            type="button"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            className="size-7 rounded-[6px] border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-muted-foreground shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
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
                    : 'border border-border bg-card text-foreground hover:bg-muted active:scale-[0.98]'
                }`}
              >
                {pageNum + 1}
              </button>
            );
          })}

          {totalPages > 5 && (
            <>
              <span className="px-1 text-muted-foreground text-xs">...</span>
              <button
                type="button"
                onClick={() => table.setPageIndex(totalPages - 1)}
                className={`size-7 rounded-[6px] text-xs font-semibold flex items-center justify-center cursor-pointer ${
                  pageIndex === totalPages - 1
                    ? 'bg-slate-900 text-white'
                    : 'border border-border bg-card text-foreground hover:bg-muted active:scale-[0.98]'
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
            className="size-7 rounded-[6px] border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-muted-foreground shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
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
            className="px-2 py-1 rounded-[6px] border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs cursor-pointer"
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
