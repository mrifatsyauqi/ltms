'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  Clock,
  ClockAlert,
  Download,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Table2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import { isCityMatch, normalizeCityName } from '@/lib/city-matcher';
import type { CabangRow } from '@/lib/data/cabang';
import type { DropPointRow } from '@/lib/data/drop-points';
import { IncRow, MonitoringIncTable } from './monitoring-inc-table';

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

function parseDateValue(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

  if (typeof raw === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(raw - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const fractionalDay = raw - Math.floor(raw) + 0.0000001;
    let totalSeconds = Math.floor(86400 * fractionalDay);
    const seconds = totalSeconds % 60;
    totalSeconds -= seconds;
    const hours = Math.floor(totalSeconds / (60 * 60));
    const minutes = Math.floor(totalSeconds / 60) % 60;
    return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, seconds);
  }

  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s || s === '-' || s.toLowerCase() === 'null') return null;

    // Format: YYYY-MM-DD HH:mm:ss atau YYYY/MM/DD HH:mm:ss
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      const [, y, m, d, hh = '0', mm = '0', ss = '0'] = isoMatch;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    }

    // Format: DD-MM-YYYY HH:mm:ss atau DD/MM/YYYY HH:mm:ss
    const idMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (idMatch) {
      const [, d, m, y, hh = '0', mm = '0', ss = '0'] = idMatch;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function formatDateFull(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function formatTimeOnly(d: Date | null): string {
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

interface ProcessResult {
  parsedRows: IncRow[];
  totalRaw: number;
  nonTargetCount: number;
}

function processRawJmsRows(rawRows: unknown[][], targetCity: string): ProcessResult {
  if (!rawRows || rawRows.length === 0) {
    return { parsedRows: [], totalRaw: 0, nonTargetCount: 0 };
  }

  // Cari baris header yang memuat kolom-kolom utama
  let headerRowIndex = -1;
  let colAwb = -1;
  let colKotaPenerima = -1;
  let colKecamatanPenerima = -1;
  let colNamaPenerima = -1;
  let colAlamatPenerima = -1;
  let colCod = -1;
  let colWaktuInput = -1;
  let colWaktuUploadTtd = -1;

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    let foundAwb = -1;
    let foundKota = -1;
    let foundKec = -1;
    let foundNama = -1;
    let foundAlamat = -1;
    let foundCod = -1;
    let foundInput = -1;
    let foundTtd = -1;

    row.forEach((cellVal, colIdx) => {
      if (typeof cellVal !== 'string') return;
      const h = cellVal.trim().toLowerCase();

      // AWB
      if (
        h.includes('waybill') ||
        h === 'awb' ||
        h.includes('no. waybill') ||
        h.includes('no waybill') ||
        h.includes('no. awb') ||
        h.includes('nomor resi') ||
        h === 'resi'
      ) {
        if (foundAwb === -1) foundAwb = colIdx;
      }

      // Kota Penerima
      if (
        h.includes('kota penerima') ||
        h.includes('kabupaten penerima') ||
        h.includes('kab. penerima') ||
        h === 'kota tujuan' ||
        h === 'kota'
      ) {
        if (foundKota === -1) foundKota = colIdx;
      }

      // Kecamatan Penerima
      if (
        h.includes('kecamatan penerima') ||
        h.includes('kec penerima') ||
        h.includes('kecamatan') ||
        h.includes('tempat tujuan') ||
        h.includes('area penerima') ||
        h.includes('area tujuan')
      ) {
        if (foundKec === -1) foundKec = colIdx;
      }

      // Nama Penerima
      if (h.includes('nama penerima') || h === 'penerima' || h.includes('consignee')) {
        if (foundNama === -1) foundNama = colIdx;
      }

      // Alamat Penerima
      if (h.includes('alamat penerima') || h.includes('alamat') || h.includes('address')) {
        if (foundAlamat === -1) foundAlamat = colIdx;
      }

      // COD
      if (h.includes('biaya cod') || h.includes('nominal cod') || h.includes('nilai cod') || h === 'cod') {
        if (foundCod === -1) foundCod = colIdx;
      }

      // Waktu Input
      if (
        h.includes('waktu input') ||
        h.includes('waktu upload') ||
        h.includes('waktu buat') ||
        h.includes('waktu order') ||
        h.includes('tanggal input')
      ) {
        if (foundInput === -1) foundInput = colIdx;
      }

      // Waktu Upload TTD
      if (
        h.includes('waktu upload ttd') ||
        h.includes('waktu ttd') ||
        h.includes('waktu tanda terima') ||
        h.includes('waktu pod') ||
        h.includes('tanggal ttd') ||
        h.includes('pod time')
      ) {
        if (foundTtd === -1) foundTtd = colIdx;
      }
    });

    if (foundAwb !== -1 || (foundKota !== -1 && foundInput !== -1)) {
      headerRowIndex = r;
      colAwb = foundAwb;
      colKotaPenerima = foundKota;
      colKecamatanPenerima = foundKec;
      colNamaPenerima = foundNama;
      colAlamatPenerima = foundAlamat;
      colCod = foundCod;
      colWaktuInput = foundInput;
      colWaktuUploadTtd = foundTtd;
      break;
    }
  }

  // Fallback default index jika header standar JMS baris 0
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colAwb = 0;
    colWaktuInput = 1;
    colCod = 8;
    colNamaPenerima = 11;
    colKotaPenerima = 13;
    colAlamatPenerima = 14;
    colWaktuUploadTtd = 15;
  }

  const dataRows = rawRows.slice(headerRowIndex + 1);
  let totalRaw = 0;
  let nonTargetCount = 0;
  const parsedRows: IncRow[] = [];

  for (const r of dataRows) {
    if (!r || !Array.isArray(r) || r.length === 0) continue;

    const rawAwb = colAwb >= 0 && r[colAwb] != null ? String(r[colAwb]).trim() : '';
    if (!rawAwb || rawAwb.toLowerCase().startsWith('total') || rawAwb.toLowerCase().startsWith('jumlah')) {
      continue;
    }

    totalRaw++;

    // Cek Kota Penerima: Gunakan pencocokan kota exact/normalized (bukan substring includes)
    const rawKota = colKotaPenerima >= 0 && r[colKotaPenerima] != null ? String(r[colKotaPenerima]).trim() : '';
    const matchCity = isCityMatch(rawKota, targetCity);

    if (!matchCity) {
      nonTargetCount++;
      continue;
    }

    // Tempat Tujuan = Kecamatan Penerima
    let rawKec = colKecamatanPenerima >= 0 && r[colKecamatanPenerima] != null ? String(r[colKecamatanPenerima]).trim() : '';
    if (!rawKec) {
      rawKec = normalizeCityName(rawKota) || targetCity.toUpperCase();
    }

    const rawNama = colNamaPenerima >= 0 && r[colNamaPenerima] != null ? String(r[colNamaPenerima]).trim() : '';
    const rawAlamat = colAlamatPenerima >= 0 && r[colAlamatPenerima] != null ? String(r[colAlamatPenerima]).trim() : '';
    const rawCod = colCod >= 0 && r[colCod] != null ? Number(r[colCod]) || 0 : 0;

    // Waktu Input
    const inputDate = colWaktuInput >= 0 ? parseDateValue(r[colWaktuInput]) : null;
    const waktuUploadSistem = formatDateFull(inputDate);

    // Maksimal TTD = Waktu Input + 24 Jam
    let maksimalTtdDate: Date | null = null;
    if (inputDate) {
      maksimalTtdDate = new Date(inputDate.getTime() + 24 * 60 * 60 * 1000);
    }
    const maksimalTtd = formatTimeOnly(maksimalTtdDate);
    const maksimalTtdFull = formatDateFull(maksimalTtdDate);

    // Waktu TTD
    const ttdDate = colWaktuUploadTtd >= 0 ? parseDateValue(r[colWaktuUploadTtd]) : null;
    const waktuTtd = formatDateFull(ttdDate);
    const isClearTtd = Boolean(ttdDate && waktuTtd);

    // Cek Keterlambatan TTD (isLate): Terlambat jika sudah TTD tapi waktu TTD > batas maksimal 24 jam
    let isLate = false;
    if (ttdDate && maksimalTtdDate) {
      isLate = ttdDate.getTime() > maksimalTtdDate.getTime();
    }

    parsedRows.push({
      awb: rawAwb,
      tempatTujuan: rawKec,
      namaPenerima: rawNama,
      alamatPenerima: rawAlamat,
      cod: rawCod,
      waktuTtd,
      maksimalTtd,
      maksimalTtdFull,
      waktuUploadSistem,
      isClearTtd,
      isLate,
    });
  }

  return { parsedRows, totalRaw, nonTargetCount };
}

interface MonitoringIncClientProps {
  userDropPoint?: string | null;
  userRole?: string;
  isFullAccess?: boolean;
}

export function MonitoringIncClient({ userDropPoint, userRole, isFullAccess }: MonitoringIncClientProps) {
  // Query data master Cabang & Drop Point untuk relasi multi-kota
  const { data: cabangList } = useQuery({
    queryKey: ['cabang'],
    queryFn: () => api<CabangRow[]>('/api/cabang'),
    staleTime: SLOW_STALE_TIME,
  });

  const { data: dropPointsList } = useQuery({
    queryKey: ['drop-points'],
    queryFn: () => api<DropPointRow[]>('/api/drop-points'),
    staleTime: SLOW_STALE_TIME,
  });

  // Kumpulkan daftar Kota yang tersedia di sistem
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const c of cabangList ?? []) {
      const kota = normalizeCityName(c['Nama Kota'] || c['Kode Kota']);
      if (kota) set.add(kota);
    }
    for (const dp of dropPointsList ?? []) {
      const kota = normalizeCityName(dp['Nama Kota'] || dp['Kode Kota'] || dp['Wilayah/Cabang']);
      if (kota) set.add(kota);
    }
    // Default jika master masih kosong
    if (set.size === 0) {
      set.add('BATANG');
    }
    return Array.from(set).sort();
  }, [cabangList, dropPointsList]);

  // Tentukan kota asal akun pengguna
  const userAssignedCity = useMemo(() => {
    return resolveCityFromDropPoint(userDropPoint, dropPointsList, availableCities[0] || 'BATANG');
  }, [userDropPoint, dropPointsList, availableCities]);

  // Target Kota yang aktif dipantau
  const [selectedCity, setSelectedCity] = useState<string>('BATANG');

  // Sinkronisasi kota awal berdasarkan akun user
  useEffect(() => {
    if (userAssignedCity) {
      setSelectedCity(userAssignedCity);
    }
  }, [userAssignedCity]);

  // Admin DP terkunci ke kota DP-nya, sedangkan Super Admin / Admin Cabang / SPV bisa berganti kota
  const isAdminDp = userRole === 'Admin DP';
  const activeTargetCity = isAdminDp ? userAssignedCity : selectedCity || 'BATANG';

  // State Data File & Parsing
  const [rawSheetRows, setRawSheetRows] = useState<unknown[][] | null>(null);
  const [allRows, setAllRows] = useState<IncRow[]>([]);
  const [rawTotalCount, setRawTotalCount] = useState<number>(0);
  const [nonTargetCityCount, setNonTargetCityCount] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [copying, setCopying] = useState<null | 'img' | 'table'>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLEAR' | 'BELUM' | 'LATE'>('ALL');
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>('ALL');

  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Re-proses data ketika activeTargetCity berubah (misal admin memilih kota lain)
  const handleCityChange = (newCity: string) => {
    setSelectedCity(newCity);
    if (rawSheetRows && rawSheetRows.length > 0) {
      const result = processRawJmsRows(rawSheetRows, newCity);
      setAllRows(result.parsedRows);
      setRawTotalCount(result.totalRaw);
      setNonTargetCityCount(result.nonTargetCount);
      setSelectedKecamatan('ALL');
      toast.info(`Beralih ke Kota ${newCity}: Ditemukan ${result.parsedRows.length} AWB.`);
    }
  };

  const handleFileUpload = (fileList: FileList | File[]) => {
    const file = fileList[0];
    if (!file) return;

    setFileName(file.name);
    setIsGenerated(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawRows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];
        if (!rawRows || rawRows.length === 0) {
          toast.error('File Excel kosong.');
          return;
        }

        setRawSheetRows(rawRows);
        const result = processRawJmsRows(rawRows, activeTargetCity);

        setAllRows(result.parsedRows);
        setRawTotalCount(result.totalRaw);
        setNonTargetCityCount(result.nonTargetCount);
        setIsGenerated(true);

        if (result.parsedRows.length === 0) {
          toast.warning(
            `Tidak ditemukan data penerima Kota ${activeTargetCity} dari ${result.totalRaw} baris file yang diupload.`,
          );
        } else {
          toast.success(
            `Berhasil memproses file! Ditemukan ${result.parsedRows.length} AWB Kota ${activeTargetCity} (${result.nonTargetCount} baris kota lain difilter).`,
          );
        }
      } catch (err) {
        console.error('Error parsing JMS Excel:', err);
        toast.error('Gagal membaca file Excel JMS. Pastikan format file valid.');
      }
    };

    reader.readAsBinaryString(file);
  };

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

      // Tambahkan baris ringkasan footer
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
    <div className="space-y-6">
      {/* 1. Upload Card & City Selector */}
      {!isGenerated ? (
        <Card className="border-dashed border-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="size-5 text-primary" />
                  Upload Tarikan Data JMS (Monitoring INC)
                </CardTitle>
                <CardDescription className="mt-1">
                  Upload file Excel tarikan JMS. Sistem otomatis memfilter penerima tujuan kota, memetakan <strong>Kecamatan Penerima</strong> sebagai Tempat Tujuan, dan menghitung SLA <strong>Maksimal TTD 24 Jam</strong>.
                </CardDescription>
              </div>

              {/* City Selection / Scope Info */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 p-2 rounded-lg border">
                <MapPin className="size-4 text-primary shrink-0" />
                {isAdminDp ? (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Kota Target: </span>
                    <strong className="text-slate-900 font-semibold">{activeTargetCity}</strong>
                    <span className="text-muted-foreground ml-1">({userDropPoint})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Target Kota:</span>
                    <Select value={selectedCity} onValueChange={handleCityChange}>
                      <SelectTrigger className="h-8 text-xs font-semibold bg-white min-w-[120px]">
                        <SelectValue placeholder="Pilih Kota" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCities.map((city) => (
                          <SelectItem key={city} value={city} className="text-xs font-medium">
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-primary bg-primary/5 scale-[0.99]'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-slate-50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
            >
              <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileSpreadsheet className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  Klik untuk memilih file atau seret file ke sini
                </p>
                <p className="text-xs text-muted-foreground">
                  Mendukung file format Excel (.xlsx, .xls) dari JMS untuk tujuan <strong>Kota {activeTargetCity}</strong>
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2">
                Pilih File Excel
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header Bar: File info, Filter Summary, and Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                  Kota {activeTargetCity}
                </Badge>

                {!isAdminDp && availableCities.length > 1 && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-xs text-muted-foreground">Ganti Kota:</span>
                    <Select value={selectedCity} onValueChange={handleCityChange}>
                      <SelectTrigger className="h-7 text-xs font-semibold bg-slate-50 min-w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCities.map((city) => (
                          <SelectItem key={city} value={city} className="text-xs font-medium">
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <span className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                  {fileName}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Memproses <strong>{allRows.length} AWB</strong> {activeTargetCity} ({nonTargetCityCount} AWB kota lain difilter otomatis dari total {rawTotalCount} baris).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleCopyImage}
                disabled={copying !== null}
                className="gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-white"
              >
                <ImageIcon className="size-4" />
                {copying === 'img' ? 'Menyalin Gambar...' : 'Salin Gambar'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyTable}
                disabled={copying !== null}
                className="gap-1.5"
              >
                <Table2 className="size-4 text-emerald-600" />
                {copying === 'table' ? 'Menyalin...' : 'Salin Tabel'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-1.5"
              >
                <Download className="size-4 text-blue-600" />
                Unduh Excel
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsGenerated(false);
                  setAllRows([]);
                  setRawSheetRows(null);
                }}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
                Ganti File
              </Button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card className="bg-slate-50/70 border shadow-none">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total AWB INC</span>
                  <Package className="size-3.5 text-slate-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900">{stats.total}</div>
                <p className="text-[11px] text-muted-foreground">Tujuan {activeTargetCity}</p>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50/60 border border-emerald-100 shadow-none">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                  <span>Clear TTD</span>
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-800">{stats.clear}</div>
                <p className="text-[11px] text-emerald-600 font-medium">
                  {stats.percent}% terselesaikan
                </p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50/60 border border-amber-100 shadow-none">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-amber-700 font-medium">
                  <span>Belum TTD</span>
                  <Clock className="size-3.5 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-800">{stats.belum}</div>
                <p className="text-[11px] text-amber-600 font-medium">
                  {stats.total > 0 ? 100 - stats.percent : 0}% belum selesai
                </p>
              </CardContent>
            </Card>

            <Card className="bg-rose-50/60 border border-rose-100 shadow-none">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-rose-700 font-medium">
                  <span>Telat SLA (24 Jam)</span>
                  <ClockAlert className="size-3.5 text-rose-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-rose-800">{stats.late}</div>
                <p className="text-[11px] text-rose-600 font-medium">
                  Melebihi Waktu Maksimal TTD
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-50/70 border shadow-none col-span-2 sm:col-span-1">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total Nilai COD</span>
                  <span className="text-[10px] font-semibold uppercase">IDR</span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 truncate">
                  Rp {stats.totalCod.toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-muted-foreground">Total tagihan COD</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Search Control Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-lg border">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-white shadow-sm text-slate-900'
                      : 'text-muted-foreground hover:text-slate-900'
                  }`}
                >
                  Semua ({allRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CLEAR')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    statusFilter === 'CLEAR'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-emerald-700'
                  }`}
                >
                  Clear TTD ({stats.clear})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('BELUM')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    statusFilter === 'BELUM'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-amber-700'
                  }`}
                >
                  Belum TTD ({stats.belum})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('LATE')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    statusFilter === 'LATE'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-rose-700'
                  }`}
                >
                  Telat SLA ({stats.late})
                </button>
              </div>

              {uniqueKecamatan.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <select
                    value={selectedKecamatan}
                    onChange={(e) => setSelectedKecamatan(e.target.value)}
                    className="border rounded-md px-2 py-1 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
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
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari AWB / Penerima / Alamat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50/50"
              />
            </div>
          </div>

          {/* Table Container Card */}
          <Card className="overflow-hidden border shadow-sm">
            <CardHeader className="py-3 px-4 bg-slate-50/80 border-b flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Tabel Laporan Monitoring INC {activeTargetCity}
                </CardTitle>
                <CardDescription className="text-xs">
                  Menampilkan {filteredData.length} baris data sesuai template laporan resmi.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 overflow-x-auto">
              <MonitoringIncTable
                ref={tableRef}
                data={filteredData}
                filterKecamatan={selectedKecamatan !== 'ALL' ? selectedKecamatan : undefined}
                kota={activeTargetCity}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
