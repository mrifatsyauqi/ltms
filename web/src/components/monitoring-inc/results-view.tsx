'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Send,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  Percent,
  MapPin,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { IncRow, IncStats, AVAILABLE_CITIES } from './types';
import { MonitoringIncTable } from './monitoring-inc-table';
import { ReportImageCanvas } from './report-image-canvas';
import { FeishuShareDialog, FeishuShareStage } from './feishu-share-dialog';
import { FeishuGroup } from '@/services/communication/communication.types';
import type { DropPointRow } from '@/lib/data/drop-points';
import { normalizeKecamatan } from '@/lib/kecamatan';

interface ResultsViewProps {
  data: IncRow[];
  stats: IncStats;
  targetKota: string;
  generateTime: string;
  onReset: () => void;
  onTargetKotaChange: (city: string) => void;
  isCityLocked?: boolean;
  userDropPoint?: string;
  dropPoints?: DropPointRow[];
}

type DpMatch = { kodeDp: string; namaDp: string };

export function ResultsView({
  data,
  stats,
  targetKota,
  generateTime,
  onReset,
  onTargetKotaChange,
  isCityLocked,
  userDropPoint,
  dropPoints = [],
}: ResultsViewProps) {
  const hiddenCanvasRef = useRef<HTMLDivElement>(null);

  // Feishu Communication Share Dialog state
  const [isFeishuShareOpen, setIsFeishuShareOpen] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Disambiguasi "Drop Point Tujuan": dp_delivery (dari kolom "DP Delivery"
  // di file JMS) sbg penentu UTAMA, cocokkan thd Kode DP ATAU Nama DP -
  // fallback ke pemetaan Kecamatan -> DP (drop_point_kecamatan, lihat Master
  // Drop Point) kalau dp_delivery kosong. Kalau keduanya tak cocok, baris
  // tetap dikelompokkan per Kecamatan mentah spt sekarang (TIDAK digabung ke
  // grup DP manapun yg sudah teridentifikasi).
  const { dpByCode, dpByKecamatan } = useMemo(() => {
    const byCode = new Map<string, DpMatch>();
    const byKec = new Map<string, DpMatch>();
    for (const dp of dropPoints) {
      const match: DpMatch = { kodeDp: dp['Kode DP'], namaDp: dp['Nama DP'] };
      byCode.set(normalizeKecamatan(dp['Kode DP']), match);
      byCode.set(normalizeKecamatan(dp['Nama DP']), match);
      for (const kec of dp['Kecamatan']) byKec.set(normalizeKecamatan(kec), match);
    }
    return { dpByCode: byCode, dpByKecamatan: byKec };
  }, [dropPoints]);

  function resolveDpForRow(row: IncRow): DpMatch | null {
    if (row.dpDelivery) {
      const match = dpByCode.get(normalizeKecamatan(row.dpDelivery));
      if (match) return match;
    }
    return dpByKecamatan.get(normalizeKecamatan(row.tempatTujuan)) ?? null;
  }

  /** Satu fungsi dipakai baik oleh Send sungguhan maupun Preview Share Dialog,
   *  supaya keduanya TIDAK PERNAH berbeda (Single Source of Truth, sama spt
   *  render pipeline kartu). Label baris = Nama DP kalau ter-resolve, kalau
   *  tidak fallback ke nama Kecamatan mentah. `kodeDp` ikut disertakan per
   *  baris (kalau ter-resolve) supaya pipeline mention di server TIDAK perlu
   *  menebak ulang DP dari label yang ambigu (Nama DP vs Kecamatan mentah,
   *  keduanya sama-sama string biasa dari sudut pandang server). */
  function buildSubdistrictBreakdown(
    rows: IncRow[],
    limit: number
  ): Array<{ name: string; count: string; kodeDp?: string }> {
    const countMap = new Map<string, { count: number; kodeDp?: string }>();
    for (const r of rows) {
      const match = resolveDpForRow(r);
      const label = match ? match.namaDp : (r.tempatTujuan?.trim() || 'Lainnya');
      const existing = countMap.get(label);
      countMap.set(label, { count: (existing?.count || 0) + 1, kodeDp: match?.kodeDp });
    }
    return Array.from(countMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([name, v]) => ({ name, count: `${v.count} AWB`, kodeDp: v.kodeDp }));
  }

  // Auto Caption Generator (Clean format, WhatsApp/Feishu ready, NO dashboard links)
  const buildSmartCaption = () => {
    // Format tanggal & jam
    const now = new Date();
    const formattedDate = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);

    const formattedTime = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // Ambil list unik kecamatan dengan jumlah paketnya
    const kecCountMap = new Map<string, number>();
    data.forEach((r) => {
      const kec = r.tempatTujuan?.trim() || 'Lainnya';
      kecCountMap.set(kec, (kecCountMap.get(kec) || 0) + 1);
    });

    const topKecStrings = Array.from(kecCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kec, count]) => `• ${kec}: ${count} resi`)
      .join('\n');

    return `📊 MONITORING INC
Kota: ${targetKota}
Tanggal: ${formattedDate}
Jam: ${formattedTime} WIB
━━━━━━━━━━━━━━
📦 Total Resi: ${stats.total.toLocaleString('id-ID')}
⏳ Belum TTD: ${stats.belum.toLocaleString('id-ID')}
🚨 Melebihi SLA: ${stats.late.toLocaleString('id-ID')}
📈 Progress: ${stats.percent}%
━━━━━━━━━━━━━━
Tujuan Kecamatan:
${topKecStrings || '• Sesuai data terlampir'}
━━━━━━━━━━━━━━
Mohon seluruh DP segera melakukan follow up terhadap seluruh paket yang belum TTD terutama paket yang telah melewati SLA.

Terima kasih.`;
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportRows = data.map((row) => ({
        'AWB': row.awb,
        'Tempat Tujuan': row.tempatTujuan,
        'DP Delivery': row.dpDelivery || '-',
        'Nama Penerima': row.namaPenerima,
        'Alamat Penerima': row.alamatPenerima,
        'COD': row.cod,
        'Waktu TTD': row.waktuTtd || '-',
        'Maksimal TTD': row.maksimalTtd || '-',
        'Waktu Upload ke Sistem': row.waktuUploadSistem || '-',
        'Status':
          row.status === 'CLEAR'
            ? 'Clear TTD'
            : row.status === 'BELUM'
            ? 'Belum TTD'
            : 'Telat SLA',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);

      // Tambahkan ringkasan di bawah sheet
      const summaryStartRow = exportRows.length + 3;
      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ['RINGKASAN MONITORING INC'],
          ['Total AWB Outgoing INC', stats.total],
          ['Clear TTD', stats.clear],
          ['Belum TTD / Telat SLA', stats.belum + stats.late],
          ['Presentase TTD', `${stats.percent}%`],
        ],
        { origin: `A${summaryStartRow}` }
      );

      XLSX.utils.book_append_sheet(wb, ws, `INC_${targetKota}`);
      XLSX.writeFile(wb, `MONITORING_INC_${targetKota}_${Date.now()}.xlsx`);

      toast.success('File Excel berhasil diunduh!');
    } catch (err) {
      console.error('Gagal export excel:', err);
      toast.error('Gagal mengekspor data Excel.');
    }
  };

  // Handler Pengiriman Laporan ke Feishu Group
  const handleExecuteFeishuSend = async (
    selectedGroup: FeishuGroup,
    updateStage: (stage: FeishuShareStage, progress: number) => void,
    selectedCardTemplateId?: string
  ) => {
    if (!hiddenCanvasRef.current) {
      throw new Error('Canvas visual report belum siap dirender.');
    }

    // 1. Preparing Data
    updateStage('preparing_data', 15);
    await new Promise((r) => setTimeout(r, 200));

    // 2. Rendering HD PNG Report (1200x900)
    updateStage('rendering_report', 35);
    const node = hiddenCanvasRef.current;
    const dataUrl = await toPng(node, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#FFFFFF',
    });
    setGeneratedImageUrl(dataUrl);
    await new Promise((r) => setTimeout(r, 200));

    // 3. Generating Caption & Subdistricts
    updateStage('generating_caption', 55);
    const caption = buildSmartCaption();
    await new Promise((r) => setTimeout(r, 200));

    // Ekstrak Drop Point Tujuan breakdown (dp_delivery > Kecamatan->DP > Kecamatan mentah)
    const subdistricts = buildSubdistrictBreakdown(data, 10);
    const topKecamatan = subdistricts.map((s) => s.name);

    // 4. Uploading Image to Feishu
    updateStage('uploading_image', 75);
    await new Promise((r) => setTimeout(r, 250));

    // 5. Sending Interactive Card Message
    updateStage('sending_message', 90);
    const res = await fetch('/api/communication/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'feishu',
        chatId: selectedGroup.chatId || (selectedGroup as any).chat_id,
        messageType: 'interactive_card',
        cardTemplateId: selectedCardTemplateId,
        data: {
          module: 'monitoring_inc',
          targetScope: {
            type: 'kota',
            name: targetKota,
          },
          targetKota,
          pickup_dp: userDropPoint || 'BATANG01',
          target_city: targetKota,
          total_inc: stats.total,
          clear_ttd: stats.clear,
          pending_ttd: stats.belum,
          over_sla: stats.late,
          sla_percentage: stats.percent,
          subdistricts,
          topKecamatan,
          generateTime,
          generated_at: generateTime,
          imageBase64: dataUrl,
          caption,
        },
      }),
    });

    // Respons non-2xx dari platform (mis. 413 Request Entity Too Large saat
    // body kegedean) berupa teks biasa, bukan JSON - res.json() akan lempar
    // SyntaxError kriptik ("Unexpected token...") kalau langsung dipanggil.
    const rawBody = await res.text();
    let json: any = null;
    try {
      json = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // bukan JSON - kemungkinan besar respons platform (413/502/dst)
    }
    if (!res.ok || !json || (!json.ok && !json.success)) {
      throw new Error(
        json?.error ||
          (!json
            ? `Gagal mengirim (${res.status} ${res.statusText || ''}). Kemungkinan gambar lampiran terlalu besar - coba lagi dengan data lebih sedikit.`
            : 'Gagal mengirim pesan ke API Feishu.')
      );
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Hidden Offscreen Canvas for Generating Crisp Formal Image */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
        <ReportImageCanvas
          ref={hiddenCanvasRef}
          data={data}
          stats={stats}
          targetKota={targetKota}
          generateTime={generateTime}
          userDropPoint={userDropPoint}
        />
      </div>

      {/* Feishu Communication Share Dialog */}
      <FeishuShareDialog
        isOpen={isFeishuShareOpen}
        onClose={() => setIsFeishuShareOpen(false)}
        targetKota={targetKota}
        generateTime={generateTime}
        summaryData={{
          total: stats.total,
          belum: stats.belum,
          late: stats.late,
          clear: stats.clear,
          percent: stats.percent,
          subdistricts: buildSubdistrictBreakdown(data, 10),
          topKecamatan: buildSubdistrictBreakdown(data, 5).map((s) => s.name),
        }}
        captionPreview={buildSmartCaption()}
        imagePreviewUrl={generatedImageUrl}
        onExecuteSend={handleExecuteFeishuSend}
      />

      {/* 1. Header Bar with Integrated Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">
            Monitoring INC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring pengiriman Inter City (INC) SLA maksimal 24 jam • Terakhir digenerate:{' '}
            <span className="font-medium text-slate-700">{generateTime}</span>
          </p>
        </div>

        {/* Action Controls Top Right */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Upload File Baru Button */}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-medium shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="size-3.5 text-slate-500" />
            Upload File Baru
          </button>

          {/* Target Kota Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5 shadow-2xs text-xs font-medium text-slate-800">
            <MapPin className="size-3.5 text-[#E2231A]" />
            {isCityLocked ? (
              <div className="flex items-center gap-1">
                <span>{targetKota}</span>
                <Lock className="size-3 text-slate-400" />
              </div>
            ) : (
              <select
                value={targetKota}
                onChange={(e) => onTargetKotaChange(e.target.value)}
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

          {/* KIRIM KE FEISHU Button (Primary Outbound Action, Feishu brand blue) */}
          <button
            type="button"
            onClick={() => setIsFeishuShareOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#3370FF] hover:bg-[#2B5CD9] active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Send className="size-3.5" />
            Kirim ke Feishu
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-medium shadow-2xs transition-all cursor-pointer"
          >
            <Download className="size-3.5 text-emerald-600" />
            Ekspor Excel
          </button>
        </div>
      </div>

      {/* 2. 4 KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total AWB INC */}
        <div className="bg-white rounded-[8px] border border-slate-200 p-3.5 shadow-xs flex items-center gap-3 transition-all hover:border-slate-300">
          <div className="size-9 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <FileText className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Total AWB INC</p>
            <p className="text-xl font-bold text-slate-900 leading-tight font-mono">{stats.total.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-slate-400">Total Pengiriman</p>
          </div>
        </div>

        {/* Card 2: Clear TTD */}
        <div className="bg-white rounded-[8px] border border-slate-200 p-3.5 shadow-xs flex items-center gap-3 transition-all hover:border-slate-300">
          <div className="size-9 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Clear TTD (≤24 Jam)</p>
            <p className="text-xl font-bold text-slate-900 leading-tight font-mono">{stats.clear.toLocaleString('id-ID')}</p>
            <p className="text-[11px] font-medium text-emerald-600">{stats.percent}% Tepat Waktu</p>
          </div>
        </div>

        {/* Card 3: Belum TTD / Telat */}
        <div className="bg-white rounded-[8px] border border-slate-200 p-3.5 shadow-xs flex items-center gap-3 transition-all hover:border-slate-300">
          <div className="size-9 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Belum TTD / Telat</p>
            <p className="text-xl font-bold text-slate-900 leading-tight font-mono">{(stats.belum + stats.late).toLocaleString('id-ID')}</p>
            <p className="text-[11px] font-medium text-amber-600">
              {stats.total > 0 ? Math.round(((stats.belum + stats.late) / stats.total) * 100) : 0}% Belum Selesai
            </p>
          </div>
        </div>

        {/* Card 4: Presentase (Paling Kanan) */}
        <div className="bg-white rounded-[8px] border border-slate-200 p-3.5 shadow-xs flex items-center gap-3 transition-all hover:border-slate-300">
          <div className="size-9 rounded-[6px] bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Percent className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">Presentase</p>
            <p className="text-xl font-bold text-indigo-900 leading-tight font-mono">{stats.percent}%</p>
            <p className="text-[11px] font-medium text-indigo-600">Pencapaian SLA</p>
          </div>
        </div>
      </div>

      {/* 3. Modern Data Table with TanStack Table Sorting */}
      <MonitoringIncTable data={data} />
    </div>
  );
}
