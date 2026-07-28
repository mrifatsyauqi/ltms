'use client';

import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { toJpeg } from 'html-to-image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MonitoringRow, MonitoringTable } from './monitoring-table';

export function MonitoringClient() {
  const [data, setData] = useState<MonitoringRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [totalSampai, setTotalSampai] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = (fileList: FileList | File[]) => {
    const file = fileList[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Baca sebagai array 2D
        const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // Lewati 2 baris pertama (header)
        const dataRows = rows.slice(2);

        const sprinterMap = new Map<string, MonitoringRow>();

        for (const row of dataRows) {
          if (!row || row.length < 17) continue;

          // Kolom E (index 4) adalah Sprinter
          const rawSprinter = row[4];
          if (typeof rawSprinter !== 'string') continue;

          const sprinter = rawSprinter.trim();
          
          // Filter hanya yang diawali "Mtr" (case-insensitive)
          if (!sprinter.toLowerCase().startsWith('mtr')) {
            continue;
          }

          const waybillDelivery = Number(row[5]) || 0; // Kolom F
          const ttdNormalTotal = Number(row[6]) || 0; // Kolom G
          // const scanTtdReturTotal = Number(row[9]) || 0; // Kolom J (Tidak dipakai sesuai revisi)
          
          const paketBermasalah = Number(row[15]) || 0; // Kolom P
          
          // Rumus Final
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
        setData(parsedData);
        toast.success(`Berhasil memproses file. Ditemukan ${parsedData.length} sprinter.`);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Gagal memproses file Excel.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCopyImage = async () => {
    if (!tableRef.current) return;
    try {
      setIsGenerating(true);
      const dataUrl = await toJpeg(tableRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
      
      const blob = await (await fetch(dataUrl)).blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      toast.success('Gambar tabel berhasil disalin ke clipboard!');
    } catch (error) {
      console.error('Gagal copy image', error);
      toast.error('Gagal menyalin gambar. Browser mungkin tidak mendukung fitur ini.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Data JMS</CardTitle>
        </CardHeader>
        <CardContent
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
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
          <p className="text-sm">Drag & drop file Excel Monitor Delivery dari JMS ke sini, atau</p>
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
          {fileName && <p className="text-muted-foreground text-sm mt-2 font-medium">File aktif: {fileName}</p>}
        </CardContent>
      </Card>

      {data.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Tabel Monitoring Delivery</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="totalSampai">TOTAL SAMPAI (Manual):</Label>
                <Input
                  id="totalSampai"
                  type="number"
                  value={totalSampai || ''}
                  onChange={(e) => setTotalSampai(Number(e.target.value))}
                  className="w-32"
                  placeholder="Input angka"
                />
              </div>
              <Button onClick={handleCopyImage} disabled={isGenerating}>
                {isGenerating ? 'Menyalin...' : 'Copy as Image'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MonitoringTable ref={tableRef} data={data} totalSampai={totalSampai} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
