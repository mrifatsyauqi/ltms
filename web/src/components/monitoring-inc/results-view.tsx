'use client';

import { useMemo, useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ClockAlert,
  Download,
  Filter,
  Image as ImageIcon,
  Package,
  Search,
  Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IncRow, MonitoringIncTable } from './monitoring-inc-table';

interface ResultsViewProps {
  allRows: IncRow[];
  activeTargetCity: string;
  fileName: string;
  onBack: () => void;
}

export function ResultsView({ allRows, activeTargetCity, fileName, onBack }: ResultsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLEAR' | 'BELUM' | 'LATE'>('ALL');
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>('ALL');
  const [copying, setCopying] = useState<null | 'img' | 'table'>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  // Daftar Kecamatan unik untuk dropdown filter
  const uniqueKecamatan = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      if (r.tempatTujuan) set.add(r.tempatTujuan);
    });
    return Array.from(set).sort();
  }, [allRows]);

  // Filtered Rows
  const filteredData = useMemo(() => {
    return allRows.filter((row) => {
      // Filter Kecamatan
      if (selectedKecamatan !== 'ALL' && row.tempatTujuan !== selectedKecamatan) {
        return false;
      }

      // Filter Status
      if (statusFilter === 'CLEAR' && !row.isClearTtd) return false;
      if (statusFilter === 'BELUM' && row.isClearTtd) return false;
      if (statusFilter === 'LATE' && !row.isLate) return false;

      // Filter Pencarian Teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchAwb = row.awb.toLowerCase().includes(q);
        const matchNama = row.namaPenerima.toLowerCase().includes(q);
        const matchAlamat = row.alamatPenerima.toLowerCase().includes(q);
        const matchKec = row.tempatTujuan.toLowerCase().includes(q);
        if (!matchAwb && !matchNama && !matchAlamat && !matchKec) return false;
      }

      return true;
    });
  }, [allRows, selectedKecamatan, statusFilter, searchQuery]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = allRows.length;
    const clear = allRows.filter((r) => r.isClearTtd).length;
    const belum = total - clear;
    const late = allRows.filter((r) => r.isLate).length;
    const percent = total > 0 ? Math.round((clear / total) * 100) : 0;
    const totalCod = allRows.reduce((sum, r) => sum + r.cod, 0);

    return { total, clear, belum, late, percent, totalCod };
  }, [allRows]);

  /**
   * Salin GAMBAR (image/png) ke clipboard
   */
  const handleCopyImage = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      setCopying('img');
      const imagePromise = (async () => {
        await new Promise((r) => setTimeout(r, 30));
        const fullWidth = el.scrollWidth;
        const dataUrl = await toPng(el, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          width: fullWidth,
          height: el.scrollHeight,
          style: { width: `${fullWidth}px`, overflow: 'visible' },
        });
        return (await fetch(dataUrl)).blob();
      })();

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': imagePromise })]);
      toast.success('Gambar tabel Monitoring INC disalin ke clipboard! Siap dipaste ke WA/Feishu.');
    } catch (err) {
      console.error('Gagal menyalin gambar:', err);
      toast.error('Gagal menyalin gambar. Pastikan browser mendukung Clipboard Image API.');
    } finally {
      setCopying(null);
    }
  };

  /**
   * Salin TABEL (HTML & TSV) untuk Excel/Sheets
   */
  const handleCopyTable = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      setCopying('table');
      const htmlBlob = new Blob([el.outerHTML], { type: 'text/html' });
      const textBlob = new Blob([el.innerText], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
      toast.success('Tabel berhasil disalin! Siap ditempel di Excel atau Spreadsheet.');
    } catch (err) {
      console.error('Gagal menyalin tabel:', err);
      toast.error('Gagal menyalin tabel.');
    } finally {
      setCopying(null);
    }
  };

  /**
   * Export ke file Excel (.xlsx)
   */
  const handleExportExcel = () => {
    if (allRows.length === 0) {
      toast.warning('Tidak ada data untuk diekspor.');
      return;
    }

    try {
      const exportData = filteredData.map((r) => ({
        'AWB': r.awb,
        'Tempat Tujuan': r.tempatTujuan,
        'Nama Penerima': r.namaPenerima,
        'Alamat Penerima': r.alamatPenerima,
        'COD': r.cod,
        'Waktu TTD': r.waktuTtd || '',
        'MAKSIMAL TTD': r.maksimalTtd,
        'Waktu Upload ke Sistem': r.waktuUploadSistem,
      }));

      const totalAwb = filteredData.length;
      const clearTtd = filteredData.filter((r) => r.isClearTtd).length;
      const percent = totalAwb > 0 ? `${Math.round((clearTtd / totalAwb) * 100)}%` : '0%';

      const ws = xlsx.utils.json_to_sheet(exportData);

      // Tambahkan 3 baris ringkasan di bawah
      xlsx.utils.sheet_add_aoa(
        ws,
        [
          [`JUMLAH AWB OUTGOING INC (${activeTargetCity})`, '', '', '', '', '', totalAwb, ''],
          ['CLEAR TTD', '', '', '', '', '', clearTtd, ''],
          ['PRESENTASE', '', '', '', '', '', percent, ''],
        ],
        { origin: -1 },
      );

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, `INC ${activeTargetCity}`);

      const dateStr = new Date().toISOString().slice(0, 10);
      xlsx.writeFile(wb, `Monitoring_INC_${activeTargetCity.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      toast.success('File Excel berhasil diunduh.');
    } catch (err) {
      console.error('Gagal mengekspor Excel:', err);
      toast.error('Gagal mengekspor Excel.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header Bar: Actions & Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-[18px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              Kembali ke Upload
            </Button>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-xs">
              Kota {activeTargetCity}
            </Badge>
            <span className="text-xs text-slate-400 font-mono truncate max-w-[240px]" title={fileName}>
              {fileName}
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-1">
            Total <strong>{allRows.length} AWB</strong> berhasil digenerate untuk target kota {activeTargetCity}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleCopyImage}
            disabled={copying !== null}
            className="h-9 rounded-xl gap-1.5 shadow-sm bg-[#E30613] hover:bg-[#C60010] text-white font-semibold text-xs transition-all hover:scale-105"
          >
            <ImageIcon className="size-3.5" />
            {copying === 'img' ? 'Menyalin Gambar...' : 'Salin Gambar'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTable}
            disabled={copying !== null}
            className="h-9 rounded-xl gap-1.5 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Table2 className="size-3.5 text-emerald-600" />
            {copying === 'table' ? 'Menyalin...' : 'Salin Tabel'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-9 rounded-xl gap-1.5 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Download className="size-3.5 text-blue-600" />
            Unduh Excel
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-none">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Total AWB INC</span>
              <Package className="size-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{stats.total}</div>
            <p className="text-[11px] text-slate-500 font-medium">Tujuan {activeTargetCity}</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/50 border border-emerald-100 rounded-[16px] shadow-none">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Clear TTD</span>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-800">{stats.clear}</div>
            <p className="text-[11px] text-emerald-600 font-semibold">{stats.percent}% terselesaikan</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/50 border border-amber-100 rounded-[16px] shadow-none">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
              <span>Belum TTD</span>
              <Clock className="size-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-800">{stats.belum}</div>
            <p className="text-[11px] text-amber-600 font-semibold">{stats.total > 0 ? 100 - stats.percent : 0}% belum selesai</p>
          </CardContent>
        </Card>

        <Card className="bg-rose-50/50 border border-rose-100 rounded-[16px] shadow-none">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
              <span>Telat SLA (24 Jam)</span>
              <ClockAlert className="size-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-800">{stats.late}</div>
            <p className="text-[11px] text-rose-600 font-semibold">Melebihi Waktu Maksimal</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-none col-span-2 sm:col-span-1">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Total Nilai COD</span>
              <span className="text-[10px] font-bold uppercase">IDR</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-800 truncate">
              Rp {stats.totalCod.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Total tagihan COD</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-[16px] border border-[#E5E7EB]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Semua ({allRows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CLEAR')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'CLEAR'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Clear TTD ({stats.clear})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('BELUM')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'BELUM'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-amber-700'
              }`}
            >
              Belum TTD ({stats.belum})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('LATE')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'LATE'
                  ? 'bg-[#E30613] text-white shadow-sm'
                  : 'text-slate-500 hover:text-rose-700'
              }`}
            >
              Telat SLA ({stats.late})
            </button>
          </div>

          {uniqueKecamatan.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs ml-1">
              <Filter className="size-3.5 text-slate-400" />
              <select
                value={selectedKecamatan}
                onChange={(e) => setSelectedKecamatan(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="ALL">Semua Kecamatan ({uniqueKecamatan.length})</option>
                {uniqueKecamatan.map((kec) => (
                  <option key={kec} value={kec}>
                    {kec}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari AWB / Penerima / Alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-slate-50/60 rounded-lg border-slate-200 focus-visible:ring-red-500"
          />
        </div>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden border border-[#E5E7EB] rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] bg-white">
        <CardHeader className="py-3 px-5 bg-slate-50/60 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold text-slate-800">
              Tabel Laporan Monitoring INC {activeTargetCity}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Menampilkan {filteredData.length} baris data terfilter.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-5 overflow-x-auto">
          <MonitoringIncTable
            ref={tableRef}
            data={filteredData}
            filterKecamatan={selectedKecamatan !== 'ALL' ? selectedKecamatan : undefined}
            kota={activeTargetCity}
          />
        </CardContent>
      </Card>
    </div>
  );
}
