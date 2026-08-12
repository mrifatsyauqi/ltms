'use client';

import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Image as ImageIcon, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SLOW_STALE_TIME } from '@/lib/query-config';
import type { DropPointRow } from '@/lib/data/drop-points';
import { MonitoringRefineTable, RefineRow } from './monitoring-refine-table';

async function fetchDropPoints(): Promise<DropPointRow[]> {
  const res = await fetch('/api/drop-points');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

// Underscore & spasi disamakan (mis. "GRINGSING_LAMA" vs "Gringsing Lama")
// supaya pencocokan tetap kena walau ejaan sumbernya tak seragam.
const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '_');

export function MonitoringRefineClient() {
  const { data: dropPoints, isLoading: dropPointsLoading } = useQuery({
    queryKey: ['drop-points'],
    queryFn: fetchDropPoints,
    staleTime: SLOW_STALE_TIME,
  });

  const [stagedData, setStagedData] = useState<RefineRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [namaKota, setNamaKota] = useState('');
  const [copying, setCopying] = useState<null | 'img' | 'table'>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = (fileList: FileList | File[]) => {
    const file = fileList[0];
    if (!file) return;

    // Master Drop Point (dipakai lookup Kode DP di bawah) diambil lewat React
    // Query - kalau file di-upload SEBELUM query itu selesai (mis. langsung
    // setelah halaman dibuka), dropPoints masih undefined -> SEMUA baris bakal
    // gagal cocok. Tolak upload dulu & minta coba lagi drpd diam-diam
    // menghasilkan Kode DP kosong semua.
    if (dropPointsLoading) {
      toast.error('Data Master Drop Point masih dimuat, coba lagi sesaat lagi.');
      return;
    }

    setFileName(file.name);
    setIsGenerated(false);

    // Kode DP ("BGG09", dst) TIDAK sama dgn teks "DP Delivery" di file JMS
    // ("GRINGSING_LAMA", dst) - itu cocok dgn "Nama DP" master. Cocokkan ke
    // Nama DP dulu (kasus utama), "Kode DP" jadi fallback kalau kebetulan
    // teksnya memang sudah berupa kode.
    const kodeDpByNamaDp = new Map<string, string>();
    const kodeDpByKodeDp = new Map<string, string>();
    // Nama Kota utk judul tabel - diambil dari DP yang cocok (lihat di
    // bawah), BUKAN diketik manual, supaya otomatis benar siapa pun yang
    // upload & DP apa pun yang muncul di file.
    const namaKotaByNamaDp = new Map<string, string>();
    for (const dp of dropPoints ?? []) {
      kodeDpByNamaDp.set(normalize(dp['Nama DP']), dp['Kode DP']);
      kodeDpByKodeDp.set(normalize(dp['Kode DP']), dp['Kode DP']);
      if (dp['Nama Kota']) namaKotaByNamaDp.set(normalize(dp['Nama DP']), dp['Nama Kota']);
    }
    const lookupKodeDp = (dpDelivery: string) =>
      kodeDpByNamaDp.get(normalize(dpDelivery)) ?? kodeDpByKodeDp.get(normalize(dpDelivery)) ?? '';
    const lookupNamaKota = (dpDelivery: string) => namaKotaByNamaDp.get(normalize(dpDelivery)) ?? '';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const dataRows = rows.slice(2); // 2 baris header (grup + sub-kolom) format Refine Total

        const groupMap = new Map<string, RefineRow>();
        const unmatched = new Set<string>();
        const namaKotaCount = new Map<string, number>();

        for (const row of dataRows) {
          if (!row || row.length < 15) continue;
          const rawDp = row[2];
          if (typeof rawDp !== 'string' || !rawDp.trim()) continue;
          const dpDelivery = rawDp.trim();
          if (dpDelivery.toLowerCase().startsWith('total')) continue; // lewati baris ringkasan kalau ada

          const num = (i: number) => Number(row[i]) || 0;
          const parsed = {
            totalDelivery: num(3),
            ttdNormalTotal: num(4),
            ttdNormalAdaFoto: num(5),
            ttdNormalTidakAdaFoto: num(6),
            scanRetorTotal: num(7),
            scanRetorAdaFoto: num(8),
            scanRetorTidakAdaFoto: num(9),
            belumJumlahAwb: num(10),
            belumJumlahInventory: num(11),
            belumTinggalGudang: num(12),
            belumPaketBermasalah: num(13),
            belumInputAwb: num(14),
          };

          const existing = groupMap.get(dpDelivery);
          if (existing) {
            groupMap.set(dpDelivery, {
              ...existing,
              totalDelivery: existing.totalDelivery + parsed.totalDelivery,
              ttdNormalTotal: existing.ttdNormalTotal + parsed.ttdNormalTotal,
              ttdNormalAdaFoto: existing.ttdNormalAdaFoto + parsed.ttdNormalAdaFoto,
              ttdNormalTidakAdaFoto: existing.ttdNormalTidakAdaFoto + parsed.ttdNormalTidakAdaFoto,
              scanRetorTotal: existing.scanRetorTotal + parsed.scanRetorTotal,
              scanRetorAdaFoto: existing.scanRetorAdaFoto + parsed.scanRetorAdaFoto,
              scanRetorTidakAdaFoto: existing.scanRetorTidakAdaFoto + parsed.scanRetorTidakAdaFoto,
              belumJumlahAwb: existing.belumJumlahAwb + parsed.belumJumlahAwb,
              belumJumlahInventory: existing.belumJumlahInventory + parsed.belumJumlahInventory,
              belumTinggalGudang: existing.belumTinggalGudang + parsed.belumTinggalGudang,
              belumPaketBermasalah: existing.belumPaketBermasalah + parsed.belumPaketBermasalah,
              belumInputAwb: existing.belumInputAwb + parsed.belumInputAwb,
            });
          } else {
            const kodeDp = lookupKodeDp(dpDelivery);
            if (!kodeDp) unmatched.add(dpDelivery);
            const namaKota = lookupNamaKota(dpDelivery);
            if (namaKota) namaKotaCount.set(namaKota, (namaKotaCount.get(namaKota) ?? 0) + 1);
            groupMap.set(dpDelivery, { kodeDp, dpDelivery, ...parsed });
          }
        }

        const parsedData = Array.from(groupMap.values());
        parsedData.sort((a, b) => {
          const ra = a.totalDelivery > 0 ? (a.ttdNormalTotal + a.scanRetorTotal) / a.totalDelivery : 0;
          const rb = b.totalDelivery > 0 ? (b.ttdNormalTotal + b.scanRetorTotal) / b.totalDelivery : 0;
          return rb - ra;
        });

        // Kota terbanyak di antara DP yang cocok (biasanya seragam - satu
        // cabang = satu kota, lihat master_cabang - tapi diambil mode-nya
        // buat jaga-jaga kalau ada campuran).
        let dominantNamaKota = '';
        let dominantCount = 0;
        for (const [nama, count] of namaKotaCount) {
          if (count > dominantCount) {
            dominantNamaKota = nama;
            dominantCount = count;
          }
        }
        setNamaKota(dominantNamaKota);

        setStagedData(parsedData);
        if (parsedData.length === 0) {
          toast.warning('Tidak ada baris DP Delivery yang terbaca. Pastikan file adalah laporan Refine Total dari JMS.');
        } else {
          toast.success(`Berhasil memproses file. Ditemukan ${parsedData.length} Drop Point.`);
          if (unmatched.size > 0) {
            toast.warning(`Kode DP tidak ditemukan di Master Drop Point: ${Array.from(unmatched).join(', ')}`);
          }
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Gagal memproses file Excel.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCopyImage = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      setCopying('img');
      const imagePromise = (async () => {
        await new Promise((r) => setTimeout(r, 20));
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
      toast.success('Gambar tabel disalin — tempel di chat (WA/Feishu).');
    } catch (error) {
      console.error('Gagal copy gambar', error);
      toast.error('Gagal menyalin gambar. Pastikan bukan mode Incognito & browser mendukung Clipboard API.');
    } finally {
      setCopying(null);
    }
  };

  const handleCopyTable = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      setCopying('table');
      const htmlBlob = new Blob([el.outerHTML], { type: 'text/html' });
      const textBlob = new Blob([el.innerText], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
      toast.success('Tabel disalin — tempel di Excel/Spreadsheet.');
    } catch (error) {
      console.error('Gagal copy tabel', error);
      toast.error('Gagal menyalin tabel.');
    } finally {
      setCopying(null);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {!isGenerated && (
        <Card>
          <CardHeader>
            <CardTitle>1. Upload Data JMS (Refine Total)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? 'border-primary bg-accent' : 'border-muted-foreground/25'
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
            >
              <p className="text-sm text-muted-foreground">
                Drag & drop file Excel Monitor Delivery (Refine Total) dari JMS ke sini, atau
              </p>
              <p className="text-muted-foreground text-xs">
                Gunakan laporan JMS Refine Total (16 kolom: TTD Normal, Scan TTD Retur, Belum TTD, Rasio TTD).
              </p>
              {dropPointsLoading && (
                <p className="text-muted-foreground text-xs">Memuat data Master Drop Point…</p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={dropPointsLoading}
              >
                Pilih File Excel
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={dropPointsLoading}
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                  e.target.value = '';
                }}
              />
              {fileName && <p className="text-sm mt-2 font-medium text-primary">File siap: {fileName}</p>}
            </div>

            {stagedData.length > 0 && (
              <div className="p-4 border border-border rounded-lg bg-muted">
                <Button
                  onClick={() => {
                    setGeneratedAt(new Date());
                    setIsGenerated(true);
                  }}
                >
                  Tampilkan Tabel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isGenerated && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>2. Hasil Tabel Monitoring (Refine Total)</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setIsGenerated(false)}>
                Edit
              </Button>
              <Button variant="outline" onClick={handleCopyTable} disabled={copying !== null} title="Tempel sebagai sel di Excel / Google Sheets">
                <Table2 className="size-4" aria-hidden />
                {copying === 'table' ? 'Menyalin…' : 'Salin Tabel (Excel)'}
              </Button>
              <Button onClick={handleCopyImage} disabled={copying !== null} title="Tempel sebagai gambar di WhatsApp / Feishu">
                <ImageIcon className="size-4" aria-hidden />
                {copying === 'img' ? 'Menyalin…' : 'Salin Gambar (Chat)'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {generatedAt && (
              <MonitoringRefineTable ref={tableRef} data={stagedData} generatedAt={generatedAt} namaKota={namaKota} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
