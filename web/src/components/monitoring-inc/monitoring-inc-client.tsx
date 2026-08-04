'use client';

import { useState, useMemo, useEffect } from 'react';
import { MapPin, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { isCityMatch, resolveCityFromDropPoint } from '@/lib/city-matcher';
import { parseExcelDate, formatDisplayDateTime } from '@/lib/excel-date';
import {
  IncRow,
  IncStats,
  UploadedFileInfo,
  RecentUploadHistoryItem,
  AVAILABLE_CITIES,
} from './types';
import { UploadCard } from './upload-card';
import { UploadedFileCard } from './uploaded-file-card';
import { GenerateSection } from './generate-section';
import { RecentHistoryCard } from './recent-history-card';
import { ResultsView } from './results-view';

interface MonitoringIncClientProps {
  userRole?: string;
  userDropPoint?: string;
}

const STORAGE_KEY_RECENT_LIST = 'ltms_recent_inc_upload_list';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function MonitoringIncClient({
  userRole,
  userDropPoint,
}: MonitoringIncClientProps) {
  // 1. Inisialisasi Target Kota
  const initialCity = useMemo(() => {
    const resolved = resolveCityFromDropPoint(userDropPoint);
    return resolved && AVAILABLE_CITIES.includes(resolved as any)
      ? resolved
      : 'BATANG';
  }, [userDropPoint]);

  const isCityLocked = useMemo(() => {
    return userRole === 'Admin DP' || userRole === 'SPV Drop Point';
  }, [userRole]);

  const [targetKota, setTargetKota] = useState<string>(initialCity);
  const [fileInfo, setFileInfo] = useState<UploadedFileInfo | null>(null);
  const [parsedRows, setParsedRows] = useState<IncRow[] | null>(null);
  const [generateTimestamp, setGenerateTimestamp] = useState<string>('');
  const [viewMode, setViewMode] = useState<'workflow' | 'results'>('workflow');
  const [historyList, setHistoryList] = useState<RecentUploadHistoryItem[]>([]);

  // 7-Day Auto Retention: Load & Cleanup expired items
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENT_LIST);
      if (saved) {
        const parsed: RecentUploadHistoryItem[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          const validList = parsed.filter(
            (item) => item.createdAt && now - item.createdAt <= SEVEN_DAYS_MS
          );
          setHistoryList(validList);
          if (validList.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY_RECENT_LIST, JSON.stringify(validList));
          }
          return;
        }
      }

      // Fallback check legacy single key
      const legacy = localStorage.getItem('ltms_recent_inc_upload');
      if (legacy) {
        const single = JSON.parse(legacy);
        const item: RecentUploadHistoryItem = {
          ...single,
          createdAt: single.createdAt || Date.now(),
        };
        setHistoryList([item]);
        localStorage.setItem(STORAGE_KEY_RECENT_LIST, JSON.stringify([item]));
        localStorage.removeItem('ltms_recent_inc_upload');
      }
    } catch {
      // ignore
    }
  }, []);

  // Helper untuk menyimpan history list ke localStorage
  const saveHistoryList = (list: RecentUploadHistoryItem[]) => {
    setHistoryList(list);
    try {
      localStorage.setItem(STORAGE_KEY_RECENT_LIST, JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  // Format ukuran file
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handler proses upload file Excel
  const handleFileSelected = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);

      if (!rawData || rawData.length === 0) {
        toast.error('File Excel kosong atau tidak terbaca.');
        return;
      }

      // Filter Target City untuk menghitung resi terfilter
      let filteredCount = 0;
      for (const row of rawData) {
        const getCol = (...keys: string[]) => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
                return row[rowKey];
              }
            }
          }
          return undefined;
        };

        const awb = String(getCol('No. Waybill', 'AWB', 'Nomor Resi', 'No Resi') || '').trim();
        if (!awb) continue;

        const kotaPenerima = String(getCol('Kota Penerima', 'Kota/Kabupaten', 'Kabupaten Penerima') || '').trim();
        const tempatTujuan = String(getCol('Kecamatan Penerima', 'Kecamatan', 'Tempat Tujuan', 'Tujuan') || '').trim();
        const alamatPenerima = String(getCol('Alamat Penerima', 'Alamat') || '-').trim();

        const isMatchedCity =
          isCityMatch(kotaPenerima, targetKota) ||
          (!kotaPenerima && (isCityMatch(alamatPenerima, targetKota) || isCityMatch(tempatTujuan, targetKota)));

        if (isMatchedCity) {
          filteredCount++;
        }
      }

      const info: UploadedFileInfo = {
        name: file.name,
        sizeFormatted: formatFileSize(file.size),
        totalResi: filteredCount, // Filtered count
        rawTotalResi: rawData.length,
        uploadTimestamp: formatDisplayDateTime(),
        targetKota,
        file,
      };

      setFileInfo(info);
    } catch (err) {
      console.error('Gagal membaca file Excel:', err);
      toast.error('Gagal memproses file Excel.');
    }
  };

  // Eksekusi kalkulasi SLA saat tombol Generate ditekan di Step 3
  const handleExecuteGenerate = async () => {
    if (!fileInfo?.file) return;

    try {
      const buffer = await fileInfo.file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);

      const mappedRows: IncRow[] = [];
      let totalSlaHoursSum = 0;
      let validSlaCount = 0;

      for (const row of rawData) {
        const getCol = (...keys: string[]) => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
                return row[rowKey];
              }
            }
          }
          return undefined;
        };

        const awb = String(getCol('No. Waybill', 'AWB', 'Nomor Resi', 'No Resi') || '').trim();
        if (!awb) continue;

        const kotaPenerima = String(getCol('Kota Penerima', 'Kota/Kabupaten', 'Kabupaten Penerima') || '').trim();
        const tempatTujuan = String(getCol('Kecamatan Penerima', 'Kecamatan', 'Tempat Tujuan', 'Tujuan') || '').trim();
        const namaPenerima = String(getCol('Nama Penerima', 'Penerima') || '-').trim();
        const alamatPenerima = String(getCol('Alamat Penerima', 'Alamat') || '-').trim();
        const codRaw = getCol('Biaya COD', 'COD', 'Nilai COD') || 0;
        const cod = typeof codRaw === 'number' ? codRaw : parseFloat(String(codRaw).replace(/[^\d.-]/g, '')) || 0;

        const rawWaktuTtd = getCol('Waktu Upload TTD', 'Waktu TTD', 'Tanda Terima', 'TTD');
        const rawWaktuInput = getCol('Waktu Input', 'Waktu Buat', 'Waktu Scan In', 'Waktu Kirim', 'Waktu Upload ke Sistem');

        // Filter kota: Hanya proses data yang sesuai Target Kota
        const isMatchedCity =
          isCityMatch(kotaPenerima, targetKota) ||
          (!kotaPenerima && (isCityMatch(alamatPenerima, targetKota) || isCityMatch(tempatTujuan, targetKota)));

        if (!isMatchedCity) {
          continue;
        }

        // Parsing waktu secara presisi
        const parsedInput = parseExcelDate(rawWaktuInput);
        const parsedTtd = parseExcelDate(rawWaktuTtd);

        const waktuUploadSistemStr = parsedInput
          ? parsedInput.formatted
          : typeof rawWaktuInput === 'string' && rawWaktuInput.trim() && rawWaktuInput.trim() !== '-'
          ? rawWaktuInput.trim()
          : '-';

        const waktuTtdStr = parsedTtd
          ? parsedTtd.formatted
          : typeof rawWaktuTtd === 'string' && rawWaktuTtd.trim() && !/^(belum|null|undefined|-)/i.test(rawWaktuTtd.trim())
          ? rawWaktuTtd.trim()
          : 'Belum TTD';

        // Kalkulasi SLA 24 Jam
        let isClear = false;
        let isLate = false;
        let maksimalTtdStr = '-';
        let slaHoursVal: number | null = null;

        if (parsedInput) {
          const deadline = new Date(parsedInput.date.getTime() + 24 * 60 * 60 * 1000);
          const hh = String(deadline.getHours()).padStart(2, '0');
          const mm = String(deadline.getMinutes()).padStart(2, '0');
          const ss = String(deadline.getSeconds()).padStart(2, '0');
          maksimalTtdStr = `${hh}:${mm}:${ss}`;

          if (parsedTtd) {
            const diffHours = (parsedTtd.date.getTime() - parsedInput.date.getTime()) / (1000 * 60 * 60);
            slaHoursVal = parseFloat(diffHours.toFixed(2));
            totalSlaHoursSum += diffHours;
            validSlaCount++;

            if (parsedTtd.date.getTime() <= deadline.getTime()) {
              isClear = true;
            } else {
              isLate = true;
            }
          }
        }

        const status: 'CLEAR' | 'BELUM' | 'LATE' = isClear ? 'CLEAR' : isLate ? 'LATE' : 'BELUM';

        mappedRows.push({
          awb,
          tempatTujuan: tempatTujuan || kotaPenerima || targetKota,
          namaPenerima,
          alamatPenerima,
          cod,
          waktuTtd: waktuTtdStr,
          maksimalTtd: maksimalTtdStr,
          waktuUploadSistem: waktuUploadSistemStr,
          isClearTtd: isClear,
          isLate,
          status,
          slaHours: slaHoursVal,
        });
      }

      setParsedRows(mappedRows);
      const nowStr = formatDisplayDateTime();
      setGenerateTimestamp(nowStr);

      // Simpan ke riwayat (maksimal 7 hari)
      const newHistory: RecentUploadHistoryItem = {
        id: String(Date.now()),
        fileName: fileInfo.name,
        targetKota,
        totalResi: mappedRows.length,
        rawTotalResi: fileInfo.rawTotalResi,
        uploadTimestamp: nowStr,
        createdAt: Date.now(),
        status: 'Success',
      };

      const updatedHistory = [newHistory, ...historyList.filter((h) => h.fileName !== fileInfo.name)].slice(0, 10);
      saveHistoryList(updatedHistory);

      // Berikan jeda halus sebelum beralih ke tampilan hasil
      setTimeout(() => {
        setViewMode('results');
      }, 500);
    } catch (err) {
      console.error('Gagal generate monitoring:', err);
      toast.error('Terjadi kesalahan saat memproses data monitoring.');
    }
  };

  // Kalkulasi statistik ringkasan
  const stats: IncStats = useMemo(() => {
    if (!parsedRows || parsedRows.length === 0) {
      return {
        total: 0,
        clear: 0,
        belum: 0,
        late: 0,
        percent: 0,
        totalCod: 0,
        avgSlaHours: 0,
      };
    }

    const total = parsedRows.length;
    const clear = parsedRows.filter((r) => r.status === 'CLEAR').length;
    const belum = parsedRows.filter((r) => r.status === 'BELUM').length;
    const late = parsedRows.filter((r) => r.status === 'LATE').length;
    const percent = total > 0 ? Math.round((clear / total) * 100) : 0;
    const totalCod = parsedRows.reduce((acc, r) => acc + (r.cod || 0), 0);

    const validSlaRows = parsedRows.filter((r) => typeof r.slaHours === 'number' && !isNaN(r.slaHours));
    const avgSlaHours =
      validSlaRows.length > 0
        ? parseFloat(
            (
              validSlaRows.reduce((sum, r) => sum + (r.slaHours || 0), 0) /
              validSlaRows.length
            ).toFixed(2)
          )
        : 0;

    return {
      total,
      clear,
      belum,
      late,
      percent,
      totalCod,
      avgSlaHours,
    };
  }, [parsedRows]);

  // Actions for Recent History Card
  const handleViewDetail = (item: RecentUploadHistoryItem) => {
    if (parsedRows && parsedRows.length > 0) {
      setViewMode('results');
    } else {
      toast.info(`Memuat data ${item.fileName}... Silakan upload/generate ulang jika data belum tersimpan.`);
    }
  };

  const handleRegenerate = (item: RecentUploadHistoryItem) => {
    if (fileInfo) {
      handleExecuteGenerate();
    } else {
      toast.info(`Silakan upload file ${item.fileName} untuk melakukan generate ulang.`);
    }
  };

  const handleDownloadOriginal = (item: RecentUploadHistoryItem) => {
    if (fileInfo?.file && fileInfo.name === item.fileName) {
      const url = URL.createObjectURL(fileInfo.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('File asli berhasil diunduh.');
    } else {
      toast.info('File asli hanya dapat diunduh pada sesi aktif saat ini.');
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = historyList.filter((h) => h.id !== id);
    saveHistoryList(updated);
    toast.success('Riwayat berhasil dihapus.');
  };

  const handleClearAllHistory = () => {
    saveHistoryList([]);
    toast.success('Semua riwayat upload telah dibersihkan.');
  };

  // Mode Tampilan Laporan Hasil
  if (viewMode === 'results' && parsedRows) {
    return (
      <ResultsView
        data={parsedRows}
        stats={stats}
        targetKota={targetKota}
        generateTime={generateTimestamp}
        userDropPoint={userDropPoint}
        onReset={() => setViewMode('workflow')}
        onTargetKotaChange={(k) => setTargetKota(k)}
        isCityLocked={isCityLocked}
      />
    );
  }

  // Mode Tampilan Alur Kerja (Upload-First Compact Viewport)
  return (
    <div className="space-y-3.5 max-w-7xl mx-auto animate-in fade-in-50 duration-300">
      {/* 1. Header Ringkas + Selector Target Kota */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">
            Monitoring INC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring pengiriman Inter City (INC) dengan batas SLA maksimal 24 jam.
          </p>
        </div>

        {/* Target Kota Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">
            Target Kota
          </span>
          <div className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-[8px] px-2.5 py-1.5 shadow-2xs text-xs font-medium text-slate-800">
            <MapPin className="size-3.5 text-[#E2231A]" />
            {isCityLocked ? (
              <div className="flex items-center gap-1">
                <span>{targetKota}</span>
                <Lock className="size-3 text-slate-400" />
              </div>
            ) : (
              <select
                value={targetKota}
                onChange={(e) => setTargetKota(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 2. 2-Column Responsive Layout: Step 1 (Upload) & Step 2 (Review) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <UploadCard onFileSelected={handleFileSelected} />
        <UploadedFileCard
          fileInfo={fileInfo}
          targetKota={targetKota}
          onReplaceFile={() => {
            setFileInfo(null);
            setParsedRows(null);
          }}
          onDeleteFile={() => {
            setFileInfo(null);
            setParsedRows(null);
          }}
        />
      </div>

      {/* 3. Step 3: Generate Monitoring Card */}
      <GenerateSection
        hasFile={!!fileInfo}
        onGenerate={handleExecuteGenerate}
      />

      {/* 4. Step 4: Riwayat File (Maks 7 Hari) */}
      <RecentHistoryCard
        history={historyList}
        onViewDetail={handleViewDetail}
        onRegenerate={handleRegenerate}
        onDownloadOriginal={handleDownloadOriginal}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearAllHistory}
      />
    </div>
  );
}
