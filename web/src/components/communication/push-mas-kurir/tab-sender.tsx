'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Smartphone, QrCode, Hash, CheckCircle2, XCircle, LogOut, Key, Link as LinkIcon, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import QRCode from 'react-qr-code';

interface SenderConnection {
  id: string;
  sender_id: string;
  phone: string | null;
  display_name: string | null;
  status: string;
  last_seen: string;
}

interface ConfigStatus {
  configured: boolean;
  provider: string;
  connection: string;
  maskedKey: string;
}

export function TabSender() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  
  const [senders, setSenders] = useState<SenderConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // API Config Modal States
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

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

  // Test Kirim Modal States
  const [testKirimSender, setTestKirimSender] = useState<SenderConnection | null>(null);
  const [isTestKirimModalOpen, setIsTestKirimModalOpen] = useState(false);
  const [testKirimPhone, setTestKirimPhone] = useState('');
  const [testKirimMessage, setTestKirimMessage] = useState('Halo, ini pesan test dari LTMS melalui Bablast API.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testKirimResult, setTestKirimResult] = useState<any>(null);

  const fetchConfigStatus = async () => {
    setIsConfigLoading(true);
    try {
      const res = await fetch('/api/communication/whatsapp/config');
      if (res.ok) {
        const data = await res.json();
        setConfigStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch config status:', error);
    } finally {
      setIsConfigLoading(false);
    }
  };

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

  useEffect(() => {
    fetchConfigStatus();
    fetchSenders();
    return () => stopPolling();
  }, []);

  // --- API Config Flow ---
  const handleSaveConfig = async () => {
    if (!apiKeyInput) {
      toast.error('API Key wajib diisi');
      return;
    }

    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/communication/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput })
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success('Konfigurasi Berhasil', { description: 'API Key valid dan berhasil disimpan.' });
        setConfigStatus(data.data);
        setIsConfigModalOpen(false);
        setApiKeyInput('');
      } else {
        toast.error('Gagal Menyimpan Konfigurasi', { description: data.error || data.message });
      }
    } catch (error: any) {
      toast.error('Terjadi Kesalahan', { description: error.message });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    // A quick way to test connection is to just refetch the config status
    toast.promise(fetchConfigStatus(), {
      loading: 'Menguji koneksi ke Bablast...',
      success: 'Koneksi API valid dan terhubung.',
      error: 'Koneksi gagal.'
    });
  };

  // --- Pairing Flow ---
  
  const handleConnectStart = () => {
    if (!configStatus?.configured) return;
    
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
        toast.error('Gagal Meminta Pairing', { description: data.error || data.message });
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
        if (data.ok && data.mappedStatus === 'connected') {
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

  // --- Sender Management ---
  const refreshStatus = async (phone: string) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/communication/whatsapp/connection/status?phone=${phone}`);
      const data = await res.json();
      if (data.ok) {
        toast.success('Status Diperbarui', { description: `Status terbaru: ${data.data?.status || 'Unknown'}` });
        fetchSenders();
      } else {
        toast.error('Gagal Cek Status', { description: data.error || data.message });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message });
    } finally {
      setIsRefreshing(false);
    }
  };
  // --- Disconnect Flow ---
  const handleDisconnect = async () => {
    if (!disconnectSender) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/communication/whatsapp/connection/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: disconnectSender.sender_id })
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Sender diputus', { description: `${disconnectSender.phone} berhasil di-disconnect.` });
        setDisconnectSender(null);
        fetchSenders();
      } else {
        toast.error('Gagal disconnect', { description: data.error });
      }
    } catch (e) {
      toast.error('Gagal disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // --- Test Kirim Flow ---
  const handleOpenTestKirim = (sender: SenderConnection) => {
    if (sender.status !== 'connected') {
      toast.error('Sender Belum Siap', { description: 'Sender belum terhubung. Silakan lakukan pairing terlebih dahulu.' });
      return;
    }
    setTestKirimSender(sender);
    setTestKirimPhone('');
    setTestKirimMessage('Halo, ini pesan test dari LTMS melalui Bablast API.');
    setTestKirimResult(null);
    setIsTestKirimModalOpen(true);
  };

  const handleSendTest = async () => {
    if (!testKirimSender) return;
    
    // Normalize phone (08 -> 628)
    let phone = testKirimPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    } else if (phone.startsWith('8')) {
      phone = '62' + phone;
    }
    
    if (!phone) {
      toast.error('Nomor tujuan harus diisi');
      return;
    }
    
    setIsSendingTest(true);
    setTestKirimResult(null);
    
    try {
      // Refresh status first just to be sure
      const statusRes = await fetch(`/api/communication/whatsapp/connection/status?phone=${testKirimSender.sender_id}`);
      const statusData = await statusRes.json();
      if (!statusData.ok || statusData.mappedStatus !== 'connected') {
        toast.error('Sender belum siap digunakan', { description: 'Status sender di backend bukan connected.' });
        setIsSendingTest(false);
        return;
      }

      // We pass the phone or ID as sender_code
      const res = await fetch('/api/communication/whatsapp/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phone, 
          message: testKirimMessage,
          sender_code: testKirimSender.sender_id, // For diagnostic, we just use sender_id as sender_code
          sender_id: testKirimSender.sender_id
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success('Pesan berhasil masuk antrean Bablast.');
        setTestKirimResult({ success: true, data });
      } else {
        if (res.status === 404 || data.status === 404) {
          toast.error('Bablast mengembalikan 404 saat mengirim pesan.', { duration: 5000 });
        } else if (res.status === 401 || data.status === 401) {
          toast.error('API Key Bablast tidak valid atau tidak memiliki permission.');
        } else if (res.status === 403 || data.status === 403) {
          toast.error('API Key tidak memiliki izin untuk mengirim pesan.');
        } else {
          toast.error(data.error || 'Gagal mengirim pesan test');
        }
        setTestKirimResult({ success: false, data, status: res.status });
      }
    } catch (e: any) {
      toast.error('Gagal mengirim pesan', { description: e.message });
      setTestKirimResult({ success: false, error: e.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Bablast API Config Section */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase text-muted-foreground">Konfigurasi Sistem</h3>
        
        {isConfigLoading ? (
           <div className="flex items-center p-4 bg-muted/20 rounded-xl border border-dashed h-24">
             <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
           </div>
        ) : (
          <Card className="shadow-sm border-muted overflow-hidden">
            <CardContent className="p-0">
              <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${configStatus?.configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      Bablast Global API
                      {configStatus?.configured ? (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20 text-[10px] uppercase font-bold py-0 h-5">Connected</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase font-bold py-0 h-5">Belum Terhubung</Badge>
                      )}
                    </h4>
                    
                    {configStatus?.configured ? (
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground font-mono">
                        <span className="font-medium text-foreground">API Key:</span>
                        <span>{configStatus.maskedKey}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        LTMS belum memiliki Global API Key Bablast. Hubungkan untuk mengaktifkan WhatsApp Sender.
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                  {configStatus?.configured && (
                    <Button variant="outline" size="sm" onClick={handleTestConnection}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Test Connection
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setIsConfigModalOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    {configStatus?.configured ? 'Ubah API Key' : 'Konfigurasi API'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 2. Sender Connection Section */}
      <section className="space-y-3 pt-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">WhatsApp Sender</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Kelola nomor WhatsApp yang digunakan untuk pengiriman pesan ke Sprinter.
            </p>
          </div>
          
          <Button 
            onClick={handleConnectStart} 
            disabled={!configStatus?.configured}
            title={!configStatus?.configured ? "Konfigurasikan Bablast API terlebih dahulu." : ""}
          >
            + Konek Sender
          </Button>
        </div>

        {isLoading || isConfigLoading ? (
          <div className="flex items-center justify-center p-12 bg-muted/20 rounded-xl border border-dashed">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !configStatus?.configured ? (
          <Card className="border-dashed shadow-sm bg-amber-50/30 border-amber-200">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <LinkIcon className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-amber-900">Bablast Belum Terhubung</h3>
              <p className="text-sm text-amber-700/80 max-w-md mt-2 mb-6">
                Hubungkan Global API Key Bablast terlebih dahulu untuk mengaktifkan integrasi WhatsApp Sender.
              </p>
              <Button onClick={() => setIsConfigModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
                Konfigurasi Bablast API
              </Button>
            </CardContent>
          </Card>
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
              <Card key={sender.id} className="shadow-sm hover:shadow-md transition-shadow border-muted flex flex-col h-full">
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
                <CardContent className="pb-4 flex-1">
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Nomor Terhubung:</span>
                      <span className="font-medium text-foreground">{sender.phone || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Provider:</span>
                      <span className="font-medium text-foreground">Bablast</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Terakhir Dilihat:</span>
                      <span className="text-xs">
                        {sender.last_seen ? new Date(sender.last_seen).toLocaleString('id-ID') : '-'}
                      </span>
                    </div>
                  </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50 border-t p-3 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs"
                        onClick={() => {
                          setConnectPhone(sender.phone || sender.sender_id || '');
                          setConnectStep(2);
                          setConnectMethod(null);
                          setPairingData(null);
                          setPairingStatus('pending');
                          setIsConnectModalOpen(true);
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Reconnect
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs"
                        disabled={sender.status !== 'connected'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenTestKirim(sender);
                        }}
                      >
                        Test Kirim
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full text-xs bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                        onClick={() => setDisconnectSender(sender)}
                      >
                        Putus Koneksi
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full text-xs"
                        onClick={() => {
                          if (confirm('Apakah Anda yakin ingin menghapus sender ini?')) {
                            // TODO: Add actual delete logic via API
                            alert('Hapus sender belum diimplementasi di API');
                          }
                        }}
                      >
                        Hapus Sender
                      </Button>
                    </div>
                  </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* --- MODALS --- */}

      {/* API Config Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={(open) => !open && !isSavingConfig && setIsConfigModalOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Konfigurasi Bablast API</DialogTitle>
            <DialogDescription>
              Masukkan Global API Key dari dashboard Bablast Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="apiKey" className="mb-2 block">Global API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="bk_live_..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Kredensial ini akan disimpan secara aman dan terenkripsi.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)} disabled={isSavingConfig}>
              Batal
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSavingConfig || !apiKeyInput}>
              {isSavingConfig ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengetes & Menyimpan...</>
              ) : (
                'Test & Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection Flow Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={(open) => !open && closeConnectModal()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Konek WhatsApp Sender</DialogTitle>
            <DialogDescription>
              Ikuti langkah di bawah ini untuk menghubungkan perangkat Anda.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Step 1: Input Phone */}
            {connectStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Nomor WhatsApp Pengirim</Label>
                  <Input 
                    id="phone" 
                    placeholder="Contoh: 6282211700060" 
                    value={connectPhone}
                    onChange={(e) => setConnectPhone(e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">Gunakan awalan kode negara (62).</p>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleConnectStep1}>Lanjut</Button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Method */}
            {connectStep === 2 && (
              <div className="space-y-6">
                <div className="text-center space-y-1 mb-4">
                  <p className="text-sm font-medium">Nomor: {connectPhone}</p>
                  <p className="text-sm text-muted-foreground">Pilih metode otentikasi</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card 
                    className={`cursor-pointer hover:border-primary transition-all ${connectMethod === 'qr' ? 'border-primary ring-1 ring-primary' : ''}`}
                    onClick={() => requestPairing('qr')}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <QrCode className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">QR Code</h4>
                        <p className="text-xs text-muted-foreground mt-1">Scan menggunakan aplikasi WhatsApp</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer hover:border-primary transition-all ${connectMethod === 'code' ? 'border-primary ring-1 ring-primary' : ''}`}
                    onClick={() => requestPairing('code')}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Hash className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Pairing Code</h4>
                        <p className="text-xs text-muted-foreground mt-1">Gunakan kode 8 karakter</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {isRequestingPair && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Meminta data dari provider...</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Action Phase */}
            {connectStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md border text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={
                    pairingStatus === 'connected' ? 'default' :
                    pairingStatus === 'failed' || pairingStatus === 'timeout' ? 'destructive' : 'secondary'
                  } className="capitalize">
                    {pairingStatus === 'pending' ? (
                      <span className="flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Menunggu...</span>
                    ) : pairingStatus}
                  </Badge>
                </div>

                {connectMethod === 'qr' && pairingData?.qr ? (
                  <div className="flex flex-col items-center space-y-4">
                    {pairingStatus === 'timeout' ? (
                      <div className="p-8 border border-dashed rounded-lg bg-muted text-center w-64 h-64 flex flex-col items-center justify-center text-muted-foreground">
                        <XCircle className="h-8 w-8 mb-2" />
                        <p>Sesi Berakhir</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => requestPairing('qr')}>Coba Lagi</Button>
                      </div>
                    ) : pairingStatus === 'connected' ? (
                      <div className="p-8 border border-dashed border-green-200 rounded-lg bg-green-50 text-center w-64 h-64 flex flex-col items-center justify-center text-green-700">
                        <CheckCircle2 className="h-12 w-12 mb-4" />
                        <p className="font-semibold mb-4">Berhasil Terhubung!</p>
                        <div className="flex flex-col gap-2 w-full mt-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            className="w-full text-xs" 
                            onClick={() => {
                              setIsConnectModalOpen(false);
                              fetchSenders().then(() => {
                                // Find the sender we just paired and open test kirim
                                const phoneNum = pairingData?.phone || connectPhone;
                                if (phoneNum) {
                                  // The sender list might not be instantly updated, we'll try to find it
                                  setTimeout(() => {
                                    setSenders(current => {
                                      const found = current.find(s => s.phone === phoneNum || s.sender_id === phoneNum || s.sender_id === pairingData?.sender_id);
                                      if (found) handleOpenTestKirim(found);
                                      return current;
                                    });
                                  }, 500);
                                }
                              });
                            }}
                          >
                            Test Kirim Pesan
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-white w-full text-xs" 
                            onClick={() => {
                              setIsConnectModalOpen(false);
                              fetchSenders();
                            }}
                          >
                            Selesai & Tutup
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white border rounded-xl shadow-sm flex items-center justify-center">
                        <QRCode value={pairingData.qr} size={256} />
                      </div>
                    )}
                    <div className="text-center">
                      <h4 className="font-semibold text-foreground">Scan QR Code</h4>
                      <p className="text-sm text-muted-foreground mt-1">Buka WhatsApp &gt; Tautkan Perangkat &gt; Scan QR</p>
                    </div>
                  </div>
                ) : connectMethod === 'code' && pairingData?.pairing_code ? (
                  <div className="flex flex-col items-center space-y-6">
                    {pairingStatus === 'timeout' ? (
                      <div className="p-8 border border-dashed rounded-lg bg-muted text-center w-full flex flex-col items-center justify-center text-muted-foreground">
                        <XCircle className="h-8 w-8 mb-2" />
                        <p>Sesi Berakhir</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => requestPairing('code')}>Coba Lagi</Button>
                      </div>
                    ) : pairingStatus === 'connected' ? (
                      <div className="p-8 border border-dashed border-green-200 rounded-lg bg-green-50 text-center w-full flex flex-col items-center justify-center text-green-700">
                        <CheckCircle2 className="h-12 w-12 mb-4" />
                        <p className="font-semibold mb-4">Berhasil Terhubung!</p>
                        <div className="flex flex-col gap-2 w-full mt-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            className="w-full text-xs" 
                            onClick={() => {
                              setIsConnectModalOpen(false);
                              fetchSenders().then(() => {
                                const phoneNum = pairingData?.phone || connectPhone;
                                if (phoneNum) {
                                  setTimeout(() => {
                                    setSenders(current => {
                                      const found = current.find(s => s.phone === phoneNum || s.sender_id === phoneNum || s.sender_id === pairingData?.sender_id);
                                      if (found) handleOpenTestKirim(found);
                                      return current;
                                    });
                                  }, 500);
                                }
                              });
                            }}
                          >
                            Test Kirim Pesan
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-white w-full text-xs" 
                            onClick={() => {
                              setIsConnectModalOpen(false);
                              fetchSenders();
                            }}
                          >
                            Selesai & Tutup
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-center">
                          <h4 className="font-semibold text-foreground">Kode Tautan</h4>
                          <p className="text-sm text-muted-foreground mt-1">Masukkan kode ini pada aplikasi WhatsApp Anda.</p>
                        </div>
                        <div className="bg-muted px-8 py-6 rounded-xl border border-dashed w-full max-w-sm flex items-center justify-center">
                          <span className="text-4xl font-mono font-bold tracking-[0.2em] text-primary">{pairingData.pairing_code}</span>
                        </div>
                        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5 ml-2">
                          <li>Buka WhatsApp di HP Anda</li>
                          <li>Ketuk menu tiga titik &gt; Tautkan Perangkat</li>
                          <li>Pilih "Tautkan dengan nomor telepon saja"</li>
                          <li>Masukkan kode di atas</li>
                        </ol>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect Modal */}
      <Dialog open={!!disconnectSender} onOpenChange={(open) => !open && !isDisconnecting && setDisconnectSender(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Putuskan Koneksi Sender</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin memutus koneksi WhatsApp untuk nomor <strong>{disconnectSender?.phone || disconnectSender?.sender_id}</strong>?
              Anda harus memindai ulang QR Code untuk menghubungkannya kembali.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDisconnectSender(null)} disabled={isDisconnecting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memutuskan...</>
              ) : (
                'Putuskan Koneksi'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Kirim Modal */}
      <Dialog open={isTestKirimModalOpen} onOpenChange={(open) => !open && !isSendingTest && setIsTestKirimModalOpen(false)}>
        <DialogContent className="sm:max-w-[475px]">
          <DialogHeader>
            <DialogTitle>Test Kirim Pesan</DialogTitle>
            <DialogDescription>
              Uji coba pengiriman pesan menggunakan sender <strong>{testKirimSender?.phone || testKirimSender?.sender_id}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-phone">Nomor Tujuan</Label>
              <Input 
                id="test-phone" 
                placeholder="Contoh: 628123456789" 
                value={testKirimPhone}
                onChange={(e) => setTestKirimPhone(e.target.value)}
                disabled={isSendingTest}
              />
              <p className="text-xs text-muted-foreground">Format nomor akan dinormalisasi secara otomatis (08... &rarr; 628...).</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="test-msg">Isi Pesan</Label>
              <textarea 
                id="test-msg"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={testKirimMessage}
                onChange={(e) => setTestKirimMessage(e.target.value)}
                disabled={isSendingTest}
              />
            </div>
            
            {testKirimResult && (
              <div className={`p-3 rounded-md text-sm border ${testKirimResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="font-semibold mb-1">
                  {testKirimResult.success ? 'Berhasil Terkirim' : 'Gagal Mengirim'}
                </div>
                {testKirimResult.success ? (
                  <p className="text-xs">Message ID: {testKirimResult.data?.data?.message_id || 'OK'}</p>
                ) : (
                  <div className="text-xs space-y-1">
                    <p><strong>Status:</strong> HTTP {testKirimResult.status}</p>
                    <p><strong>Response:</strong> {JSON.stringify(testKirimResult.data || testKirimResult.error)}</p>
                    {testKirimResult.status === 404 && (
                      <p className="mt-2 pt-2 border-t border-red-200">
                        *Catatan: 404 dari Bablast mengindikasikan sender_code belum disinkronisasi sepenuhnya, atau menggunakan channel (WABA) yang memiliki flow/endpoint berbeda.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestKirimModalOpen(false)} disabled={isSendingTest}>
              Tutup
            </Button>
            <Button onClick={handleSendTest} disabled={isSendingTest}>
              {isSendingTest ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</>
              ) : (
                'Kirim Pesan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
