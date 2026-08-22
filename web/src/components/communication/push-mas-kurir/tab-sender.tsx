'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Smartphone, QrCode, Hash, CheckCircle2, XCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Connection Modal States
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<1 | 2 | 3>(1);
  const [connectPhone, setConnectPhone] = useState('');
  const [connectMethod, setConnectMethod] = useState<'qr' | 'code' | null>(null);
  const [isRequestingPair, setIsRequestingPair] = useState(false);
  
  // Pairing Data
  const [pairingData, setPairingData] = useState<any>(null);
  const [pairingStatus, setPairingStatus] = useState<'pending' | 'connected' | 'failed' | 'timeout'>('pending');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Disconnect Modal States
  const [disconnectSender, setDisconnectSender] = useState<SenderConnection | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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

  const refreshStatus = async (phone: string) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/communication/whatsapp/connection/status?phone=${phone}`);
      const data = await res.json();
      if (data.ok) {
        toast.success('Status Diperbarui', { description: `Status terbaru: ${data.data?.status || 'Unknown'}` });
        fetchSenders();
      } else {
        toast.error('Gagal Cek Status', { description: data.error });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSenders();
    return () => stopPolling();
  }, []);

  // --- Pairing Flow ---
  
  const handleConnectStart = () => {
    setConnectStep(1);
    setConnectPhone('');
    setConnectMethod(null);
    setPairingData(null);
    setPairingStatus('pending');
    setIsConnectModalOpen(true);
  };

  const handleConnectStep1 = () => {
    if (!connectPhone || connectPhone.length < 10) {
      toast.error('Nomor tidak valid', { description: 'Masukkan nomor dengan kode negara (contoh: 628...)' });
      return;
    }
    setConnectStep(2);
  };

  const requestPairing = async (method: 'qr' | 'code') => {
    setConnectMethod(method);
    setIsRequestingPair(true);
    try {
      const res = await fetch('/api/communication/whatsapp/connection/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: connectPhone, method })
      });
      const data = await res.json();
      
      if (data.ok) {
        setPairingData(data.data);
        setConnectStep(3);
        startPolling();
        fetchSenders(); // Update table in background
      } else {
        toast.error('Gagal Meminta Pairing', { description: data.error });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message });
    } finally {
      setIsRequestingPair(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    let attempts = 0;
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 20) { // Timeout after ~60 seconds
        setPairingStatus('timeout');
        stopPolling();
        return;
      }
      try {
        const res = await fetch(`/api/communication/whatsapp/connection/status?phone=${connectPhone}`);
        const data = await res.json();
        if (data.ok && data.data?.status === 'connected') {
          setPairingStatus('connected');
          stopPolling();
          toast.success('WhatsApp Terhubung!', { description: `${connectPhone} berhasil dipairing.` });
          fetchSenders();
          setTimeout(() => setIsConnectModalOpen(false), 2000);
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const closeConnectModal = () => {
    stopPolling();
    setIsConnectModalOpen(false);
  };

  // --- Disconnect Flow ---

  const handleDisconnect = async () => {
    if (!disconnectSender || !disconnectSender.phone) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/communication/whatsapp/connection/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: disconnectSender.phone })
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success('Berhasil Diputuskan', { description: 'Koneksi WhatsApp telah diakhiri.' });
        fetchSenders();
        setDisconnectSender(null);
      } else {
        toast.error('Gagal Memutuskan', { description: data.error });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">WhatsApp Sender</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Kelola nomor WhatsApp yang digunakan untuk pengiriman pesan ke Sprinter.
          </p>
        </div>
        
        <Button onClick={handleConnectStart}>
          + Konek Sender
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-muted/20 rounded-xl border border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : senders.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Belum Ada Sender</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              Hubungkan nomor WhatsApp Anda untuk mulai menggunakan fitur Push Mas Kurir secara otomatis.
            </p>
            <Button onClick={handleConnectStart}>
              + Konek Sender
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {senders.map((sender) => (
            <Card key={sender.id} className="shadow-sm hover:shadow-md transition-shadow border-muted">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-base font-semibold">
                    {sender.display_name || sender.phone || sender.sender_id}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono bg-muted px-2 py-0.5 rounded w-max">
                    ID: {sender.sender_id}
                  </CardDescription>
                </div>
                {sender.status === 'connected' ? (
                  <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Connected
                  </Badge>
                ) : sender.status === 'connecting' ? (
                  <Badge className="bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 border-yellow-500/20">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Connecting
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
                    <XCircle className="mr-1.5 h-3.5 w-3.5" /> Disconnected
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Nomor WA</span>
                    <span className="font-medium text-foreground">{sender.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Terakhir Dilihat</span>
                    <span className="text-foreground">
                      {sender.last_seen ? new Date(sender.last_seen).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refreshStatus(sender.phone || sender.sender_id)}
                    disabled={isRefreshing || !sender.phone}
                    className="text-xs"
                  >
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDisconnectSender(sender)}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connect Sender Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={closeConnectModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Konek WhatsApp Sender</DialogTitle>
            <DialogDescription>
              {connectStep === 1 && "Masukkan nomor WhatsApp yang akan digunakan sebagai pengirim pesan."}
              {connectStep === 2 && "Pilih metode pairing yang ingin Anda gunakan."}
              {connectStep === 3 && "Selesaikan proses pairing di aplikasi WhatsApp Anda."}
            </DialogDescription>
          </DialogHeader>

          {connectStep === 1 && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="628xxxxxxxxxx"
                  value={connectPhone}
                  onChange={(e) => setConnectPhone(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-muted-foreground">Gunakan format internasional (contoh: 62822...)</p>
              </div>
              <DialogFooter>
                <Button onClick={handleConnectStep1}>Lanjutkan</Button>
              </DialogFooter>
            </div>
          )}

          {connectStep === 2 && (
            <div className="py-6 grid grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:border-red-500 hover:bg-red-50/50 transition-colors"
                onClick={() => requestPairing('qr')}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <QrCode className="h-10 w-10 text-red-600 mb-3" />
                  <h4 className="font-semibold text-sm">QR Code</h4>
                  <p className="text-xs text-muted-foreground mt-1">Scan menggunakan WhatsApp</p>
                </CardContent>
              </Card>
              <Card 
                className="cursor-pointer hover:border-red-500 hover:bg-red-50/50 transition-colors"
                onClick={() => requestPairing('code')}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <Hash className="h-10 w-10 text-red-600 mb-3" />
                  <h4 className="font-semibold text-sm">Pairing Code</h4>
                  <p className="text-xs text-muted-foreground mt-1">Hubungkan dengan kode pairing</p>
                </CardContent>
              </Card>
              
              {isRequestingPair && (
                <div className="col-span-2 flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {connectStep === 3 && (
            <div className="py-6 flex flex-col items-center text-center space-y-6">
              {connectMethod === 'qr' && pairingData?.qr_data ? (
                <div className="space-y-4 flex flex-col items-center">
                  {/* Since we don't have a QR generator library installed by default in this component, 
                      we'll render a placeholder or use an external API if we have the raw string, 
                      or assume pairingData contains a base64 image if it's an image. 
                      Assuming bablast gives a base64 image or a text string. */}
                  {pairingData.qr_image ? (
                    <img src={pairingData.qr_image} alt="QR Code" className="w-48 h-48 border rounded-lg p-2 bg-white" />
                  ) : (
                    <div className="w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                      <QrCode className="w-12 h-12 text-muted-foreground/50" />
                      {/* Note: In a real implementation we'd use qrcode.react here using pairingData.qr_data */}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-foreground">Scan QR Code</h4>
                    <p className="text-sm text-muted-foreground mt-1">Buka WhatsApp &gt; Tautkan Perangkat &gt; Scan QR</p>
                  </div>
                </div>
              ) : connectMethod === 'code' && pairingData?.pairing_code ? (
                <div className="space-y-4 flex flex-col items-center w-full">
                  <div className="w-full bg-muted/50 p-6 rounded-xl border border-border">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Kode Pairing Anda</h4>
                    <p className="text-3xl font-bold tracking-[0.2em] text-foreground">{pairingData.pairing_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Masukkan kode ini pada notifikasi Tautkan Perangkat di WhatsApp Anda.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Menyiapkan metode pairing...</p>
                </div>
              )}
              
              <div className="w-full pt-4 border-t border-border">
                {pairingStatus === 'pending' && (
                  <div className="flex items-center justify-center text-yellow-600 bg-yellow-50 py-2 px-4 rounded-full text-sm font-medium w-max mx-auto">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    🟡 Menunggu koneksi...
                  </div>
                )}
                {pairingStatus === 'connected' && (
                  <div className="flex items-center justify-center text-green-700 bg-green-50 py-2 px-4 rounded-full text-sm font-medium w-max mx-auto">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    🟢 Berhasil Terhubung
                  </div>
                )}
                {pairingStatus === 'timeout' && (
                  <div className="flex items-center justify-center text-red-600 bg-red-50 py-2 px-4 rounded-full text-sm font-medium w-max mx-auto">
                    <XCircle className="w-4 h-4 mr-2" />
                    🔴 Waktu Habis
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disconnect Modal */}
      <Dialog open={!!disconnectSender} onOpenChange={(open) => !open && setDisconnectSender(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Putuskan WhatsApp Sender?</DialogTitle>
            <DialogDescription>
              Nomor: <span className="font-semibold text-foreground">{disconnectSender?.phone}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Nomor ini tidak dapat digunakan untuk mengirim pesan Push Mas Kurir sampai dihubungkan kembali.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectSender(null)} disabled={isDisconnecting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Putuskan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
