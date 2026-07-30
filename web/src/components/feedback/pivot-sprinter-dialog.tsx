'use client';

import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Image as ImageIcon, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LongTailRow } from '@/lib/data/longtail';
import { buildSprinterPivot, PivotSprinterTable } from './pivot-sprinter-table';

type Props = {
  rows: LongTailRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Popup Pivot AWB per Sprinter (dikelompokkan per DP) + salin sbg gambar/tabel. */
export function PivotSprinterDialog({ rows, open, onOpenChange }: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copying, setCopying] = useState<null | 'img' | 'table'>(null);
  const pivot = useMemo(() => buildSprinterPivot(rows), [rows]);

  // Salin GAMBAR saja (image/png) - format tunggal spy app chat (WA/Feishu)
  // menempel gambar, bukan teks. Pola sama dgn Monitoring Delivery.
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
      toast.success('Gambar pivot disalin — tempel di chat (WA/Feishu).');
    } catch (error) {
      console.error('Gagal copy gambar', error);
      toast.error('Gagal menyalin gambar. Pastikan bukan mode Incognito & browser mendukung Clipboard API.');
    } finally {
      setCopying(null);
    }
  };

  // Salin TABEL (text/html + text/plain) utk ditempel sbg sel Excel/Sheets.
  const handleCopyTable = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      setCopying('table');
      const htmlBlob = new Blob([el.outerHTML], { type: 'text/html' });
      const textBlob = new Blob([el.innerText], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
      toast.success('Tabel pivot disalin — tempel di Excel/Spreadsheet.');
    } catch (error) {
      console.error('Gagal copy tabel', error);
      toast.error('Gagal menyalin tabel.');
    } finally {
      setCopying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pivot AWB per Sprinter</DialogTitle>
          <DialogDescription>
            Jumlah No. Waybill per Sprinter, dikelompokkan per DP — mengikuti data & filter yang sedang tertampil.
            Baris tanpa Sprinter ditaruh paling atas di tiap DP tanpa nama.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {pivot.groups.length} DP · {pivot.grandTotal.toLocaleString('id-ID')} waybill
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyTable}
              disabled={copying !== null || pivot.grandTotal === 0}
              title="Tempel sebagai sel di Excel / Google Sheets"
            >
              <Table2 className="size-4" aria-hidden />
              {copying === 'table' ? 'Menyalin…' : 'Salin Tabel (Excel)'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCopyImage}
              disabled={copying !== null || pivot.grandTotal === 0}
              title="Tempel sebagai gambar di WhatsApp / Feishu"
            >
              <ImageIcon className="size-4" aria-hidden />
              {copying === 'img' ? 'Menyalin…' : 'Salin Gambar (Chat)'}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <PivotSprinterTable ref={tableRef} pivot={pivot} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
