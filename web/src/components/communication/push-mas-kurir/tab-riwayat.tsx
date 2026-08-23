'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchRecentBatchesAction } from '@/app/(app)/communication/push-mas-kurir/actions';
import { Search, Loader2, Calendar, User, Clock, MessageSquare, AlertCircle, RefreshCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { fetchBatchLogsAction } from '@/app/(app)/communication/push-mas-kurir/actions';

export function TabRiwayat() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const { data: batches, isLoading, isRefetching } = useQuery({
    queryKey: ['whatsapp_batches_recent'],
    queryFn: () => fetchRecentBatchesAction(),
    refetchInterval: (query) => {
      // Only poll if there is any active batch
      const activeBatches = query.state.data?.filter(b => b.status === 'QUEUED' || b.status === 'PROCESSING') || [];
      return activeBatches.length > 0 ? 3000 : false; // 3 seconds polling
    }
  });

  const { data: batchLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['whatsapp_batch_logs', selectedBatch],
    queryFn: () => fetchBatchLogsAction(selectedBatch!),
    enabled: !!selectedBatch,
  });

  const filteredBatches = (batches || []).filter((batch: any) => {
    const matchesSearch = 
      (batch.drop_point_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (batch.sender_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (batch.template?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch(status.toUpperCase()) {
      case 'COMPLETED':
        return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">Completed</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/20">Partial Success</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">Failed</Badge>;
      case 'QUEUED':
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">Queued</Badge>;
      case 'PROCESSING':
      case 'SENDING':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/20 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Sedang Mengirim
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMessageStatusBadge = (status: string) => {
    switch(status.toUpperCase()) {
      case 'SENT':
      case 'DELIVERED':
      case 'READ':
        return <Badge className="bg-green-50 text-green-700 border-green-200">Sent</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
      case 'SENDING':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Sending</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Queued</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Riwayat Pengiriman</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau status batch pengiriman pesan WhatsApp Push Mas Kurir.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
        <div className="relative w-full sm:w-[320px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari DP, Sender, atau Template..."
            className="pl-8 bg-background shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isRefetching && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
            <SelectTrigger className="bg-background shadow-sm w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="QUEUED">Queued</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <span>Memuat batch riwayat...</span>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 border rounded-lg border-dashed">
          <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-4" />
          <span>Tidak ada riwayat batch ditemukan.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredBatches.map((batch: any) => {
            const processed = (batch.success_count || 0) + (batch.failed_count || 0);
            const total = batch.total_messages || batch.target_count || 1; // target_count is legacy fallback
            const percentage = Math.round((processed / total) * 100);
            
            return (
              <Card key={batch.id} className="shadow-sm hover:shadow-md transition-shadow duration-200 border-border/60">
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 truncate">
                      <div className="font-semibold truncate text-base flex items-center gap-2">
                        {batch.template?.name || 'Batch Pengiriman'}
                        <Badge variant="outline" className="text-[10px] font-mono">{batch.drop_point_id}</Badge>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(batch.created_at).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>

                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm grid grid-cols-2 gap-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate">{batch.sender_code || 'Sistem'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{batch.delay_seconds || 0}s Delay</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end text-sm">
                      <span className="text-muted-foreground font-medium">{total} pesan</span>
                      <span className="font-semibold">{processed} / {total}</span>
                    </div>
                    
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden flex">
                      <div 
                        className="bg-green-500 h-full transition-all duration-500" 
                        style={{ width: `${(batch.success_count / total) * 100}%` }}
                      />
                      <div 
                        className="bg-red-500 h-full transition-all duration-500" 
                        style={{ width: `${(batch.failed_count / total) * 100}%` }}
                      />
                      {/* Queued part remains gray/muted */}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium pt-1">
                      <span className="text-green-600 flex items-center gap-1">✓ Berhasil {batch.success_count || 0}</span>
                      {batch.failed_count > 0 && <span className="text-red-600 flex items-center gap-1">✕ Gagal {batch.failed_count}</span>}
                      {batch.queued_count > 0 && <span className="text-muted-foreground flex items-center gap-1">◷ Menunggu {batch.queued_count}</span>}
                    </div>
                  </div>

                  <div className="pt-2 border-t mt-1 flex justify-end">
                    <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setSelectedBatch(batch.id)}>
                      Lihat Detail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0 bg-muted/10">
            <DialogTitle>Detail Batch Pengiriman</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {logsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Memuat rincian pesan...</p>
              </div>
            ) : batchLogs && batchLogs.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[60px]">Seq</TableHead>
                    <TableHead>Sprinter</TableHead>
                    <TableHead>Nomor WA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchLogs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs text-muted-foreground">#{log.sequence_number || '-'}</TableCell>
                      <TableCell className="font-medium text-sm">{log.sprinter_id}</TableCell>
                      <TableCell className="font-mono text-xs">{log.phone_number}</TableCell>
                      <TableCell>{getMessageStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.sent_at ? new Date(log.sent_at).toLocaleTimeString('id-ID') : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={log.error_message || 'Success'}>
                        {log.error_message || (log.status === 'QUEUED' ? 'Menunggu antrean...' : 'Sukses')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p>Data pesan tidak ditemukan untuk batch ini.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
