'use client';

import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
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
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  
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
        
        const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
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

  const handleCopyImage = async () => {
    if (!tableRef.current) return;
    try {
      setIsGeneratingImg(true);
      
      const htmlString = tableRef.current.outerHTML;
      const textString = tableRef.current.innerText;

      // Kita bungkus proses toPng yang berat di dalam Promise.
      // Dengan memberikan Promise langsung ke ClipboardItem, pemanggilan navigator.clipboard.write
      // terjadi secara sinkron (menjaga user-gesture), tetapi browser akan menunggu Promise ini
      // di latar belakang. Ini memungkinkan kita menggunakan setTimeout agar UI tidak freeze (INP fix).
      const imagePromise = new Promise<Blob>(async (resolve, reject) => {
        try {
          // Memberi jeda 50ms ke main thread agar browser bisa merender tulisan "Menyalin..."
          await new Promise((r) => setTimeout(r, 50));
          
          const dataUrl = await toPng(tableRef.current!, { quality: 1, backgroundColor: '#ffffff' });
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      });
      
      const htmlBlob = new Blob([htmlString], { type: 'text/html' });
      const textBlob = new Blob([textString], { type: 'text/plain' });
      
      const clipboardItem = new ClipboardItem({
        'text/plain': textBlob,
        'text/html': htmlBlob,
        'image/png': imagePromise
      });
      
      await navigator.clipboard.write([clipboardItem]);
      toast.success('Berhasil! Coba paste di Chat (gambar) atau Excel (tabel).');
    } catch (error) {
      console.error('Gagal copy image', error);
      toast.error('Gagal menyalin. Pastikan browser tidak berada dalam Incognito dan mendukung Clipboard API.');
    } finally {
      setIsGeneratingImg(false);
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
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 p-4 border rounded-lg bg-slate-50">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="totalSampaiSetup">Jumlah Total Sampai</Label>
                  <Input
                    id="totalSampaiSetup"
                    type="number"
                    value={totalSampai || ''}
                    onChange={(e) => setTotalSampai(Number(e.target.value))}
                    placeholder="Masukkan angka..."
                  />
                  <p className="text-xs text-muted-foreground">Angka ini akan ditampilkan pada baris terbawah tabel.</p>
                </div>
                <Button onClick={handleGenerate} className="w-full sm:w-auto">
                  Generate Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isGenerated && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>2. Hasil Tabel Monitoring</CardTitle>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setIsGenerated(false)}>
                Edit Parameter
              </Button>
              <Button onClick={handleCopyImage} disabled={isGeneratingImg}>
                {isGeneratingImg ? 'Menyalin...' : 'Copy as Image'}
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
