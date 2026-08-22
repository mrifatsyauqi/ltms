'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchRecentBatchesAction } from '@/app/(app)/communication/push-mas-kurir/actions';

export function TabRiwayat() {
  const { data: batches, isLoading } = useQuery({
    queryKey: ['whatsapp_batches'],
    queryFn: () => fetchRecentBatchesAction()
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Pengiriman</CardTitle>
        <CardDescription>Daftar 20 pengiriman Push Mas Kurir terakhir.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-4 text-muted-foreground">Memuat data...</p>
        ) : batches?.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">Belum ada riwayat pengiriman.</p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Aturan</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Diproses</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches?.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{new Date(b.created_at).toLocaleString('id-ID')}</TableCell>
                    <TableCell>{b.created_by}</TableCell>
                    <TableCell>TTD {b.filter_operator} {b.threshold}%</TableCell>
                    <TableCell>{b.target_count}</TableCell>
                    <TableCell>{b.submitted_count}</TableCell>
                    <TableCell>
                      <Badge variant={
                        b.status === 'completed' || b.status === 'submitted' ? 'default' : 
                        b.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {b.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
