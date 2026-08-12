'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { ImportBatchRow } from '@/lib/data/import';

export async function fetchImportHistory(): Promise<ImportBatchRow[]> {
  const res = await fetch('/api/import/history');
  const body = await res.json();
  if (!body.ok) throw new Error(body.message || body.error);
  return body.data;
}

export function ImportHistory() {
  const { data, isLoading, error } = useQuery({ queryKey: ['import-history'], queryFn: fetchImportHistory });

  if (isLoading) return <p className="text-muted-foreground text-sm">Memuat riwayat...</p>;
  if (error) return <p className="text-destructive text-sm">Gagal memuat riwayat: {(error as Error).message}</p>;
  if (!data || data.length === 0) return <p className="text-muted-foreground text-sm">Belum ada riwayat import.</p>;

  const sorted = [...data].reverse(); // terbaru di atas

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Admin</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Berhasil</TableHead>
          <TableHead className="text-right">Gagal</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Keterangan</TableHead>
          <TableHead>File Asli</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((b) => (
          <TableRow key={b['Batch ID']}>
            <TableCell className="whitespace-nowrap">
              {b.Tanggal} {b.Jam}
            </TableCell>
            <TableCell>{b['Nama File']}</TableCell>
            <TableCell>{b['Admin Cabang']}</TableCell>
            <TableCell className="text-right">{b['Total Baris']}</TableCell>
            <TableCell className="text-right">{b.Berhasil}</TableCell>
            <TableCell className="text-right">{b.Gagal}</TableCell>
            <TableCell>{b.Status}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{b.Keterangan}</TableCell>
            <TableCell>
              {b.Files.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {b.Files.map((f) => (
                    <Button
                      key={f.id}
                      variant="outline"
                      size="xs"
                      title={f.namaFile}
                      render={<a href={`/api/import/files/${f.id}/download`} download />}
                    >
                      <Download aria-hidden /> Unduh
                    </Button>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
