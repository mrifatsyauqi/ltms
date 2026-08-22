'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchRecentLogsAction } from '@/app/(app)/communication/push-mas-kurir/actions';
import { Search, Loader2 } from 'lucide-react';

export function TabRiwayat() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['whatsapp_logs_recent'],
    queryFn: () => fetchRecentLogsAction(),
    refetchInterval: 10000 // Refetch every 10 seconds to get status updates
  });

  const filteredLogs = (logs || []).filter((log: any) => {
    const matchesSearch = 
      log.sprinter_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.phone_number.includes(searchQuery) ||
      (log.batch?.template?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'delivered':
        return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">Delivered</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/20">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">Failed</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary" className="bg-muted text-muted-foreground">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Riwayat Pengiriman</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau status pengiriman pesan WhatsApp Push Mas Kurir.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-muted overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari Sprinter, Nomor, atau Template..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                <TableHead className="whitespace-nowrap">Sender (Admin)</TableHead>
                <TableHead className="whitespace-nowrap">Sprinter</TableHead>
                <TableHead className="whitespace-nowrap">Nomor WA</TableHead>
                <TableHead className="whitespace-nowrap">Template</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mb-2" />
                      <span>Memuat riwayat...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                    Tidak ada riwayat pengiriman ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{log.batch?.created_by || '-'}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-sm">{log.sprinter_id}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{log.phone_number}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm" title={log.batch?.template?.name}>
                      {log.batch?.template?.name || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={log.error_message || 'Success'}>
                      {log.error_message || 'Success'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
