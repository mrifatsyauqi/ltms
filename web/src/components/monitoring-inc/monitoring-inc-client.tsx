'use client';

import { useEffect, useMemo, useState } from 'react';
import * as xlsx from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, ChevronDown, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import { isCityMatch, normalizeCityName, resolveCityFromDropPoint } from '@/lib/city-matcher';
import type { CabangRow } from '@/lib/data/cabang';
import type { DropPointRow } from '@/lib/data/drop-points';
import { IncRow } from './monitoring-inc-table';
import { UploadCard } from './upload-card';
import { UploadedFileCard } from './uploaded-file-card';
import { GenerateSection, ProgressStepItem } from './generate-section';
import { RecentHistoryCard, HistoryItem } from './recent-history-card';
import { ResultsView } from './results-view';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      const [, y, m, d, hh = '0', mm = '0', ss = '0'] = isoMatch;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    }

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

      if (
        h.includes('kota penerima') ||
        h.includes('kabupaten penerima') ||
        h.includes('kab. penerima') ||
        h === 'kota tujuan' ||
        h === 'kota'
      ) {
        if (foundKota === -1) foundKota = colIdx;
      }

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

      if (h.includes('nama penerima') || h === 'penerima' || h.includes('consignee')) {
        if (foundNama === -1) foundNama = colIdx;
      }

      if (h.includes('alamat penerima') || h.includes('alamat') || h.includes('address')) {
        if (foundAlamat === -1) foundAlamat = colIdx;
      }

      if (h.includes('biaya cod') || h.includes('nominal cod') || h.includes('nilai cod') || h === 'cod') {
        if (foundCod === -1) foundCod = colIdx;
      }

      if (
        h.includes('waktu input') ||
        h.includes('waktu upload') ||
        h.includes('waktu buat') ||
        h.includes('waktu order') ||
        h.includes('tanggal input')
      ) {
        if (foundInput === -1) foundInput = colIdx;
      }

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

    const rawKota = colKotaPenerima >= 0 && r[colKotaPenerima] != null ? String(r[colKotaPenerima]).trim() : '';
    const matchCity = isCityMatch(rawKota, targetCity);

    if (!matchCity) {
      nonTargetCount++;
      continue;
    }

    let rawKec = colKecamatanPenerima >= 0 && r[colKecamatanPenerima] != null ? String(r[colKecamatanPenerima]).trim() : '';
    if (!rawKec) {
      rawKec = normalizeCityName(rawKota) || targetCity.toUpperCase();
    }

    const rawNama = colNamaPenerima >= 0 && r[colNamaPenerima] != null ? String(r[colNamaPenerima]).trim() : '';
    const rawAlamat = colAlamatPenerima >= 0 && r[colAlamatPenerima] != null ? String(r[colAlamatPenerima]).trim() : '';
    const rawCod = colCod >= 0 && r[colCod] != null ? Number(r[colCod]) || 0 : 0;

    const inputDate = colWaktuInput >= 0 ? parseDateValue(r[colWaktuInput]) : null;
    const waktuUploadSistem = formatDateFull(inputDate);

    let maksimalTtdDate: Date | null = null;
    if (inputDate) {
      maksimalTtdDate = new Date(inputDate.getTime() + 24 * 60 * 60 * 1000);
    }
    const maksimalTtd = formatTimeOnly(maksimalTtdDate);
    const maksimalTtdFull = formatDateFull(maksimalTtdDate);

    const ttdDate = colWaktuUploadTtd >= 0 ? parseDateValue(r[colWaktuUploadTtd]) : null;
    const waktuTtd = formatDateFull(ttdDate);
    const isClearTtd = Boolean(ttdDate && waktuTtd);

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

const DEFAULT_STEPS: ProgressStepItem[] = [
  { id: '1', label: 'Membaca File', status: 'pending' },
  { id: '2', label: 'Memfilter Kota', status: 'pending' },
  { id: '3', label: 'Mapping Kecamatan', status: 'pending' },
  { id: '4', label: 'Menghitung SLA', status: 'pending' },
  { id: '5', label: 'Menyimpan Monitoring', status: 'pending' },
];

interface MonitoringIncClientProps {
  userDropPoint?: string | null;
  userRole?: string;
  isFullAccess?: boolean;
}

export function MonitoringIncClient({ userDropPoint, userRole, isFullAccess }: MonitoringIncClientProps) {
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
    if (set.size === 0) {
      set.add('BATANG');
    }
    return Array.from(set).sort();
  }, [cabangList, dropPointsList]);

  const userAssignedCity = useMemo(() => {
    return resolveCityFromDropPoint(userDropPoint, dropPointsList, availableCities[0] || 'BATANG');
  }, [userDropPoint, dropPointsList, availableCities]);

  const [selectedCity, setSelectedCity] = useState<string>('BATANG');

  useEffect(() => {
    if (userAssignedCity) {
      setSelectedCity(userAssignedCity);
    }
  }, [userAssignedCity]);

  const isAdminDp = userRole === 'Admin DP';
  const activeTargetCity = isAdminDp ? userAssignedCity : selectedCity || 'BATANG';

  // State File & Upload
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [rawSheetRows, setRawSheetRows] = useState<unknown[][] | null>(null);
  const [allRows, setAllRows] = useState<IncRow[]>([]);
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>('');
  const [uploadDateFormatted, setUploadDateFormatted] = useState<string>('');

  // Generation & View State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [steps, setSteps] = useState<ProgressStepItem[]>(DEFAULT_STEPS);
  const [viewMode, setViewMode] = useState<'upload' | 'results'>('upload');

  // Riwayat Upload Terakhir (LocalStorage)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ltms_inc_recent_history');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [
      {
        id: 'hist-demo-1',
        fileName: 'TARIKAN_JMS_02082026.xlsx',
        targetCity: 'BATANG',
        totalResi: 2891,
        uploadDate: '02 Agu 2026 14:32',
        status: 'Berhasil',
      },
    ];
  });

  const saveHistoryItem = (item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.fileName !== item.fileName)].slice(0, 5);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ltms_inc_recent_history', JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleCityChange = (newCity: string) => {
    if (!newCity || newCity === activeTargetCity) return;
    setSelectedCity(newCity);
    if (rawSheetRows && rawSheetRows.length > 0) {
      const result = processRawJmsRows(rawSheetRows, newCity);
      setAllRows(result.parsedRows);
      setIsSuccess(false);
      setSteps(DEFAULT_STEPS);
      toast.info(`Beralih ke Kota ${newCity}: Ditemukan ${result.parsedRows.length} AWB.`);
    }
  };

  const handleFileSelected = (file: File) => {
    setCurrentFile(file);
    setIsSuccess(false);
    setSteps(DEFAULT_STEPS);

    // Format file size
    const sizeMb = file.size / (1024 * 1024);
    setFileSizeFormatted(sizeMb >= 1 ? `${sizeMb.toFixed(2)} MB` : `${(file.size / 1024).toFixed(0)} KB`);

    // Format tanggal upload
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const m = months[now.getMonth()];
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setUploadDateFormatted(`${d} ${m} ${y} ${hh}:${mm}`);

    // Parse Excel
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawRows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];
        if (!rawRows || rawRows.length === 0) {
          toast.error('File Excel kosong atau tidak terbaca.');
          return;
        }

        setRawSheetRows(rawRows);
        const result = processRawJmsRows(rawRows, activeTargetCity);
        setAllRows(result.parsedRows);
      } catch (err) {
        console.error('Gagal membaca Excel:', err);
        toast.error('Gagal membaca struktur file Excel JMS.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleRemoveFile = () => {
    setCurrentFile(null);
    setRawSheetRows(null);
    setAllRows([]);
    setIsSuccess(false);
    setIsGenerating(false);
    setSteps(DEFAULT_STEPS);
    toast.info('File telah dihapus.');
  };

  // Generate Monitoring dengan Step-by-Step Progress Animation (500–700ms tiap step)
  const handleGenerate = async () => {
    if (!currentFile || allRows.length === 0) {
      toast.error('Belum ada data resi yang valid untuk kota target.');
      return;
    }

    setIsGenerating(true);
    setIsSuccess(false);

    // Helper untuk update status step
    const updateStep = (index: number, status: 'pending' | 'loading' | 'completed') => {
      setSteps((prev) =>
        prev.map((step, idx) => (idx === index ? { ...step, status } : step)),
      );
    };

    // Step 1: Membaca File
    updateStep(0, 'loading');
    await new Promise((r) => setTimeout(r, 600));
    updateStep(0, 'completed');

    // Step 2: Memfilter Kota
    updateStep(1, 'loading');
    await new Promise((r) => setTimeout(r, 550));
    updateStep(1, 'completed');

    // Step 3: Mapping Kecamatan
    updateStep(2, 'loading');
    await new Promise((r) => setTimeout(r, 600));
    updateStep(2, 'completed');

    // Step 4: Menghitung SLA
    updateStep(3, 'loading');
    await new Promise((r) => setTimeout(r, 550));
    updateStep(3, 'completed');

    // Step 5: Menyimpan Monitoring
    updateStep(4, 'loading');
    await new Promise((r) => setTimeout(r, 650));
    updateStep(4, 'completed');

    setIsGenerating(false);
    setIsSuccess(true);

    // Simpan ke Riwayat File Terakhir
    saveHistoryItem({
      id: `hist-${Date.now()}`,
      fileName: currentFile.name,
      targetCity: activeTargetCity,
      totalResi: allRows.length,
      uploadDate: uploadDateFormatted,
      status: 'Berhasil',
    });

    toast.success('Monitoring berhasil dibuat!', {
      duration: 3000,
    });
  };

  const handleDownloadHistoryItem = (item: HistoryItem) => {
    toast.info(`Mengunduh riwayat ${item.fileName}...`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Section 1: Header + Target Kota Selector */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-tight">
              Monitoring INC
            </h1>
            <p className="text-[15px] font-normal text-slate-500 max-w-2xl">
              Monitoring pengiriman Inter City (INC) dengan batas SLA maksimal TTD 24 Jam.
            </p>
          </div>

          {/* Right: Target Kota Selector */}
          <div className="self-start sm:self-center">
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-2.5 px-3.5 shadow-sm space-y-0.5 min-w-[150px]">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                Target Kota
              </span>

              {isAdminDp ? (
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <MapPin className="size-4 text-[#E30613] shrink-0 fill-red-50" />
                  <span>{activeTargetCity}</span>
                  <Lock className="size-3 text-slate-400 ml-1" />
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-between w-full gap-2 text-sm font-bold text-slate-900 hover:text-[#E30613] transition-colors focus:outline-none">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="size-4 text-[#E30613] shrink-0 fill-red-50" />
                      {activeTargetCity}
                    </span>
                    <ChevronDown className="size-3.5 text-slate-400 shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border border-slate-200 p-1 min-w-[160px]">
                    {availableCities.map((city) => (
                      <DropdownMenuItem
                        key={city}
                        onClick={() => handleCityChange(city)}
                        className={`text-xs font-semibold cursor-pointer rounded-lg px-2.5 py-1.5 ${
                          city === activeTargetCity
                            ? 'bg-red-50 text-[#E30613]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <MapPin className="size-3.5 mr-2 text-[#E30613]" />
                        {city}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic View: Upload Workflow vs Results View */}
        <AnimatePresence mode="wait">
          {viewMode === 'results' && allRows.length > 0 ? (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <ResultsView
                allRows={allRows}
                activeTargetCity={activeTargetCity}
                fileName={currentFile?.name || 'TARIKAN_JMS.xlsx'}
                onBack={() => setViewMode('upload')}
              />
            </motion.div>
          ) : (
            <motion.div
              key="upload-workflow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Section 1: Upload Card */}
              <UploadCard
                onFileSelected={handleFileSelected}
                activeTargetCity={activeTargetCity}
                disabled={isGenerating}
              />

              {/* Section 2: File Berhasil Diupload (Muncul saat file ada) */}
              <AnimatePresence>
                {currentFile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <UploadedFileCard
                      fileName={currentFile.name}
                      fileSizeFormatted={fileSizeFormatted}
                      totalResi={allRows.length}
                      uploadDateFormatted={uploadDateFormatted}
                      targetCity={activeTargetCity}
                      onChangeFile={() => {
                        const input = document.querySelector<HTMLInputElement>('input[type="file"]');
                        input?.click();
                      }}
                      onRemoveFile={handleRemoveFile}
                      disabled={isGenerating}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Section 3: Generate Monitoring */}
              <GenerateSection
                hasValidFile={Boolean(currentFile && allRows.length > 0)}
                isGenerating={isGenerating}
                isSuccess={isSuccess}
                steps={steps}
                onGenerate={handleGenerate}
                onViewResults={() => setViewMode('results')}
              />

              {/* Section 4: Riwayat File Terakhir */}
              <RecentHistoryCard
                history={history}
                onDownloadHistory={handleDownloadHistoryItem}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
