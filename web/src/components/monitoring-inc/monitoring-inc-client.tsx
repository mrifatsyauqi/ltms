'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { isCityMatch, resolveCityFromDropPoint } from '@/lib/city-matcher';
import { parseExcelDate, formatDisplayDateTime } from '@/lib/excel-date';
import { IncRow, IncStats, UploadedFileInfo, AVAILABLE_CITIES } from './types';
import { UploadCard } from './upload-card';
import { UploadedFileCard } from './uploaded-file-card';
import { GenerateSection } from './generate-section';
import { ResultsView } from './results-view';
import type { DropPointRow } from '@/lib/data/drop-points';

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data as T;
}

interface MonitoringIncClientProps {
  userRole?: string;
  userDropPoint?: string;
}

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

  // Dipakai utk disambiguasi "DP Delivery"/Kecamatan -> DP (lihat resolveDp
  // di results-view.tsx) - jarang berubah (data master), staleTime panjang.
  const { data: dropPoints = [] } = useQuery({
    queryKey: ['drop-points'],
    queryFn: () => api<DropPointRow[]>('/api/drop-points'),
    staleTime: 5 * 60 * 1000,
  });

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
        const dpDelivery = String(getCol('DP Delivery') || '').trim();
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

        // Kalkulasi SLA Monitoring INC: 23 jam 55 menit (1435 menit) dari
        // Waktu Upload ke Sistem - BUKAN 24 jam genap. Ini KHUSUS Monitoring
        // INC (parser client-side ini), tidak memengaruhi SLA Monitoring
        // Delivery / freeze aging Long Tail yang punya logic terpisah.
        let isClear = false;
        let isLate = false;
        let maksimalTtdStr = '-';
        let slaHoursVal: number | null = null;

        if (parsedInput) {
          const deadline = new Date(parsedInput.date.getTime() + (23 * 60 + 55) * 60 * 1000);
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
          dpDelivery: dpDelivery || undefined,
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
        dropPoints={dropPoints}
      />
    );
  }

  // Mode Tampilan Alur Kerja (Upload-First Compact Viewport)
  return (
    <div className="space-y-3.5 max-w-7xl mx-auto animate-in fade-in-50 duration-300">
      {/* 1. Header Ringkas + Selector Target Kota */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
            Monitoring INC
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoring pengiriman Inter City (INC) dengan batas SLA maksimal 24 jam.
          </p>
        </div>

        {/* Target Kota Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
            Target Kota
          </span>
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-[8px] px-2.5 py-1.5 shadow-2xs text-xs font-medium text-foreground">
            <MapPin className="size-3.5 text-[#E2231A]" />
            {isCityLocked ? (
              <div className="flex items-center gap-1">
                <span>{targetKota}</span>
                <Lock className="size-3 text-muted-foreground" />
              </div>
            ) : (
              <select
                value={targetKota}
                onChange={(e) => setTargetKota(e.target.value)}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
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
    </div>
  );
}
