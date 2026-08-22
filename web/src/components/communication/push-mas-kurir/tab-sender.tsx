'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Smartphone, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SenderConnection {
  id: string;
  sender_id: string;
  phone: string | null;
  display_name: string | null;
  status: string;
  last_seen: string;
}

export function TabSender() {
  const [senders, setSenders] = useState<SenderConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Wrapper for compatibility with older code that used useToast()
  const customToast = (props: any) => { 
    if (props.variant === 'destructive') toast.error(props.title, { description: props.description }); 
    else toast.success(props.title, { description: props.description }); 
  };
  const uiToast = { toast: customToast };

  const fetchSenders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/communication/whatsapp/senders');
      if (res.ok) {
        const data = await res.json();
        setSenders(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch senders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncSenders = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/communication/whatsapp/senders/sync', { method: 'GET' });
      const data = await res.json();
      
      if (data.success) {
        uiToast.toast({
          title: 'Sinkronisasi Berhasil',
          description: `Berhasil mengambil ${data.data.length} sender dari Bablast.`,
        });
        setSenders(data.data);
      } else {
        uiToast.toast({
          variant: 'destructive',
          title: 'Sinkronisasi Gagal',
          description: data.message || 'Terjadi kesalahan saat sinkronisasi',
        });
      }
    } catch (error: any) {
      uiToast.toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Gagal menghubungi server',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">WhatsApp Sender</h2>
          <p className="text-sm text-muted-foreground">
            Kelola koneksi perangkat WhatsApp yang digunakan untuk pengiriman pesan.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('https://dashboard.bablast.id', '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Bablast Dashboard
          </Button>
          <Button onClick={syncSenders} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sinkronisasi Sender
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : senders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">Belum Ada Sender</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              Tidak ada perangkat WhatsApp yang terhubung. Silakan lakukan pairing melalui Dashboard Bablast lalu klik Sinkronisasi.
            </p>
            <Button onClick={() => window.open('https://dashboard.bablast.id', '_blank')}>
              Buka Bablast Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {senders.map((sender) => (
            <Card key={sender.id}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {sender.display_name || sender.phone || sender.sender_id}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    ID: {sender.sender_id}
                  </CardDescription>
                </div>
                {sender.status === 'connected' ? (
                  <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
                    <XCircle className="mr-1 h-3 w-3" /> Disconnected
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nomor WA:</span>
                    <span className="font-medium">{sender.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terakhir Aktif:</span>
                    <span>
                      {sender.last_seen ? new Date(sender.last_seen).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
