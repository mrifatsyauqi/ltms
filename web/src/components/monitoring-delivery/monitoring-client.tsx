'use client';

import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Image as ImageIcon, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MonitoringRow, MonitoringTable } from './monitoring-table';

export function MonitoringClient({ dpName }: { dpName: string }) {
  const [stagedData, setStagedData] = useState<MonitoringRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [totalSampai, setTotalSampai] = useState<number>(0);
  
  const [isGenerated, setIsGenerated] = useState(false);
  const [copying, setCopying] = useState<null | 'img' | 'table'>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = (fileList: FileList | File[]) => {
    const file = fileList[0];
    if (!file) return;

    setFileName(file.name);
    setIsGenerated(false); // Reset generated state on new file
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const dataRows = rows.slice(2);

        const sprinterMap = new Map<string, MonitoringRow>();

        for (const row of dataRows) {
          if (!row || row.length < 17) continue;

          const rawSprinter = row[4];
          if (typeof rawSprinter !== 'string') continue;

          const sprinter = rawSprinter.trim();
          
          if (!sprinter.toLowerCase().startsWith('mtr')) {
            continue;
          }

          const waybillDelivery = Number(row[5]) || 0;
          const ttdNormalTotal = Number(row[6]) || 0;
          const paketBermasalah = Number(row[15]) || 0;
          
          const tandaTerima = ttdNormalTotal;
          const belumDiterima = waybillDelivery - tandaTerima;
          const presentaseTtd = waybillDelivery > 0 ? (tandaTerima / waybillDelivery) * 100 : 0;

          if (sprinterMap.has(sprinter)) {
            const existing = sprinterMap.get(sprinter)!;
            const newWaybill = existing.waybillDelivery + waybillDelivery;
            const newTandaTerima = existing.tandaTerima + tandaTerima;
            sprinterMap.set(sprinter, {
              sprinter,
              waybillDelivery: newWaybill,
              tandaTerima: newTandaTerima,
              belumDiterima: existing.belumDiterima + belumDiterima,
              paketBermasalah: existing.paketBermasalah + paketBermasalah,
              presentaseTtd: newWaybill > 0 ? (newTandaTerima / newWaybill) * 100 : 0,
            });
          } else {
            sprinterMap.set(sprinter, {
              sprinter,
              waybillDelivery,
              tandaTerima,
              belumDiterima,
              paketBermasalah,
              presentaseTtd,
            });
          }
        }

        const parsedData = Array.from(sprinterMap.values());
        
        // Urutkan dari presentase TTD terbesar ke terkecil
        parsedData.sort((a, b) => b.presentaseTtd - a.presentaseTtd);
        
        setStagedData(parsedData);
        toast.success(`Berhasil memproses file. Ditemukan ${parsedData.length} sprinter.`);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Gagal memproses file Excel.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerate = () => {
    if (!totalSampai || totalSampai <= 0) {
      toast.error('Harap masukkan Jumlah Total Sampai terlebih dahulu.');
      return;
    }
    setIsGenerated(true);
  };

  /**
   * Salin GAMBAR saja (image/png). Wajib format tunggal: kalau digabung dgn
   * text/html atau text/plain, app chat (WhatsApp, Feishu) memilih teks
   * sehingga yang ter-paste teks — bukan gambar. Dengan hanya image/png, app
   * chat pasti menempel gambar tabel.
   *
   * Promise diberikan LANGSUNG ke ClipboardItem supaya navigator.clipboard.write
   * dipanggil sinkron (user-gesture terjaga di Safari/iOS), render berat toPng
   * berjalan di latar (fix INP).
   */
  const handleCopyImage = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      setCopying('img');
      const imagePromise = (async () => {
        await new Promise((r) => setTimeout(r, 20)); // beri main-thread merender "Menyalin…"
        // Tangkap LEBAR PENUH tabel (scrollWidth) + overflow visible supaya
        // kolom tak terpotong saat tabel lebih lebar dari area layar.
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

  /**
   * Salin TABEL (text/html + text/plain) untuk ditempel sebagai sel di
   * Excel/Google Sheets. Sengaja TANPA image/png supaya spreadsheet menempel
   * tabel yang bisa diedit, bukan gambar.
   */
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
            <CardTitle>1. Upload Data JMS & Pengaturan</CardTitle>
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
                Drag & drop file Excel Monitor Delivery dari JMS ke sini, atau
              </p>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
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
              {fileName && <p className="text-sm mt-2 font-medium text-primary">File siap: {fileName}</p>}
            </div>

            {stagedData.length > 0 && (
              <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="totalSampaiSetup">Jumlah Total Sampai</Label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <Input
                      id="totalSampaiSetup"
                      type="number"
                      value={totalSampai || ''}
                      onChange={(e) => setTotalSampai(Number(e.target.value))}
                      placeholder="Masukkan angka..."
                      className="max-w-[250px]"
                    />
                    <Button onClick={handleGenerate} className="w-full sm:w-auto">
                      Generate Data
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Angka ini akan ditampilkan pada baris terbawah tabel.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isGenerated && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>2. Hasil Tabel Monitoring</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setIsGenerated(false)}>
                Edit Parameter
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
            <MonitoringTable ref={tableRef} data={stagedData} totalSampai={totalSampai} dpName={dpName} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
