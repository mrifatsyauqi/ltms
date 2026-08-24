'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchRecentBatchesAction, fetchBatchLogsAction } from '@/app/(app)/communication/push-mas-kurir/actions';
import { Search, Loader2, Calendar, User, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

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
        return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">Selesai</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/20">Selesai Sebagian</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">Gagal</Badge>;
      case 'QUEUED':
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">Dalam Antrean</Badge>;
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
              <SelectItem value="QUEUED">Dalam Antrean</SelectItem>
              <SelectItem value="PROCESSING">Sedang Mengirim</SelectItem>
              <SelectItem value="COMPLETED">Selesai</SelectItem>
              <SelectItem value="PARTIAL">Selesai Sebagian</SelectItem>
              <SelectItem value="FAILED">Gagal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <span>Memuat riwayat pengiriman...</span>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 border rounded-lg border-dashed">
          <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-4" />
          <span>Tidak ada riwayat pengiriman ditemukan.</span>
        </div>
      ) : (
        <div className="border rounded-lg bg-background overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[280px]">Batch Info</TableHead>
                <TableHead className="w-[180px]">Konfigurasi</TableHead>
                <TableHead className="min-w-[200px]">Progress</TableHead>
                <TableHead className="w-[140px]">Metrik</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[100px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBatches.map((batch: any) => {
                const successCount = batch.success_count || 0;
                const failedCount = batch.failed_count || 0;
                const queuedCount = batch.queued_count || 0;
                const processed = successCount + failedCount;
                const total = batch.total_messages || batch.target_count || 1; // target_count is legacy fallback
                const percentage = Math.round((processed / total) * 100);
                
                return (
                  <TableRow key={batch.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="font-medium text-sm flex items-center gap-2 truncate max-w-[250px]" title={batch.template?.name || 'Batch Pengiriman'}>
                          {batch.template?.name || 'Batch Pengiriman'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] h-5 font-mono px-1.5">{batch.drop_point_id}</Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(batch.created_at).toLocaleString('id-ID', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          <span className="font-mono">{batch.sender_code || 'Sistem'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Delay: {batch.delay_seconds || 0}s</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-2 pr-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium">{processed} / {total} Pesan</span>
                          <span className="text-muted-foreground">{percentage}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                          <div 
                            className="bg-green-500 h-full transition-all duration-500" 
                            style={{ width: `${(successCount / total) * 100}%` }}
                          />
                          <div 
                            className="bg-red-500 h-full transition-all duration-500" 
                            style={{ width: `${(failedCount / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1 text-[11px] font-medium">
                        {successCount > 0 && <span className="text-green-600">Berhasil: {successCount}</span>}
                        {failedCount > 0 && <span className="text-red-600">Gagal: {failedCount}</span>}
                        {queuedCount > 0 && <span className="text-muted-foreground">Menunggu: {queuedCount}</span>}
                        {successCount === 0 && failedCount === 0 && queuedCount === 0 && <span className="text-muted-foreground">Belum ada</span>}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {getStatusBadge(batch.status)}
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-medium" onClick={() => setSelectedBatch(batch.id)}>
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
