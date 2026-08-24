'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Smartphone, QrCode, Hash, CheckCircle2, XCircle, LogOut, Key, Link as LinkIcon, Settings, Send, Trash2, ShieldAlert } from 'lucide-react';
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
  sender_code?: string | null;
  channel_type?: string | null;
}

interface ConfigStatus {
  configured: boolean;
  provider: string;
  connection: string;
  maskedKey: string;
  isSuperAdmin?: boolean;
}

export function TabSender() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  
  const [senders, setSenders] = useState<SenderConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // API Config Modal States
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // --- WIZARD STATES ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isReconnectMode, setIsReconnectMode] = useState(false);
  const [activeSenderId, setActiveSenderId] = useState<string | null>(null);
  
  // Step 1: Info
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  
  // Step 2 & 3: Pairing & Polling
  const [pairingMethod, setPairingMethod] = useState<'qr' | 'code' | null>(null);
  const [pairingData, setPairingData] = useState<any>(null);
  const [pairingStatus, setPairingStatus] = useState<'pending' | 'connected' | 'failed' | 'timeout'>('pending');
  const [isRequestingPair, setIsRequestingPair] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Step 4: Sender Code
  const [senderCode, setSenderCode] = useState('');
  
  // Step 5 & 6: Test Send
  const [testKirimTarget, setTestKirimTarget] = useState('');
  const [testKirimMessage, setTestKirimMessage] = useState('Halo, ini pesan test dari LTMS melalui Bablast API.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testKirimResult, setTestKirimResult] = useState<any>(null);
  
  // Step 7: Save
  const [isSavingSender, setIsSavingSender] = useState(false);

  // Standalone Test Kirim Modal
  const [standaloneTestSender, setStandaloneTestSender] = useState<SenderConnection | null>(null);
  const [isStandaloneTestOpen, setIsStandaloneTestOpen] = useState(false);
  const [testKirimPhone, setTestKirimPhone] = useState('');

  // Disconnect & Delete States
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

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

  // --- WIZARD LOGIC ---
  const startWizard = (reconnectSender?: SenderConnection) => {
    if (!configStatus?.configured) return;
    
    setIsReconnectMode(!!reconnectSender);
    setActiveSenderId(reconnectSender?.id || null);
    
    setWizardStep(1);
    setSenderName(reconnectSender?.display_name || '');
    setSenderPhone(reconnectSender?.phone || '');
    setSenderCode(reconnectSender?.sender_code || '');
    setPairingMethod(null);
    setPairingData(null);
    setPairingStatus('pending');
    setTestKirimTarget('');
    setTestKirimResult(null);
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    stopPolling();
    setIsWizardOpen(false);
    fetchSenders();
  };

  const goToStep = (step: number) => {
    setWizardStep(step);
  };

  const handleStep1Submit = () => {
    if (!senderName) {
      toast.error('Nama Sender wajib diisi');
      return;
    }
    if (!senderPhone || senderPhone.length < 10) {
      toast.error('Nomor WhatsApp tidak valid', { description: 'Gunakan awalan 62' });
      return;
    }
    
    // Check duplicates if not reconnecting
    if (!isReconnectMode) {
      const isDuplicate = senders.some(s => s.phone === senderPhone);
      if (isDuplicate) {
        toast.error('Nomor sudah terdaftar', { description: 'Nomor WhatsApp ini sudah ada di daftar Sender Anda.' });
        return;
      }
    }
    
    goToStep(2);
  };

  const requestPairing = async (method: 'qr' | 'code') => {
    setPairingMethod(method);
    setIsRequestingPair(true);
    try {
      const res = await fetch('/api/communication/whatsapp/connection/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: senderPhone, method })
      });
      const data = await res.json();
      
      if (data.ok) {
        setPairingData(data.data);
        goToStep(3);
        startPolling();
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
      if (attempts > 30) { // Timeout after ~90 seconds
        setPairingStatus('timeout');
        stopPolling();
        return;
      }
      try {
        const res = await fetch(`/api/communication/whatsapp/connection/status?phone=${senderPhone}`);
        const data = await res.json();
        if (data.ok && data.mappedStatus === 'connected') {
          setPairingStatus('connected');
          stopPolling();
          toast.success('WhatsApp Terhubung!');
          setTimeout(() => goToStep(4), 1500); // Automatically move to sender code step
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

  const handleStep4Submit = () => {
    if (!senderCode) {
      toast.error('Sender Code wajib diisi');
      return;
    }
    goToStep(5);
  };

  const handleTestSend = async (fromWizard: boolean) => {
    const targetPhone = fromWizard ? testKirimTarget : testKirimPhone;
    const message = fromWizard ? testKirimMessage : testKirimMessage;
    const code = fromWizard ? senderCode : standaloneTestSender?.sender_code;
    const phoneSource = fromWizard ? senderPhone : standaloneTestSender?.phone;

    let phone = targetPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    else if (phone.startsWith('8')) phone = '62' + phone;

    if (!phone) {
      toast.error('Nomor tujuan harus diisi');
      return;
    }

    if (!code) {
      toast.error('Sender Code tidak ditemukan');
      return;
    }

    setIsSendingTest(true);
    if (fromWizard) setTestKirimResult(null);
    else setTestKirimResult(null);

    try {
      // Send the test message
      const res = await fetch('/api/communication/whatsapp/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phone, 
          message: message,
          sender_code: code,
          sender_id: phoneSource // Used as fallback check in some places, but Bablast strictly needs sender_code
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success('Pesan berhasil masuk antrean Bablast.');
        if (fromWizard) {
          setTestKirimResult({ success: true, data });
          setTimeout(() => goToStep(7), 1000); // Move to save step
        } else {
          setTestKirimResult({ success: true, data });
        }
      } else {
        const errorMsg = data.error || data.message || 'Gagal mengirim pesan';
        if (res.status === 404 || data.status === 404) {
          toast.error('Sender not found (404)', { description: 'Sender Code mungkin salah atau sender tidak ada di Bablast Dashboard.' });
        } else if (res.status === 401 || data.status === 401) {
          toast.error('Unauthorized (401)', { description: 'API Key tidak valid.' });
        } else {
          toast.error(errorMsg);
        }
        if (fromWizard) setTestKirimResult({ success: false, data, status: res.status });
        else setTestKirimResult({ success: false, data, status: res.status });
      }
    } catch (e: any) {
      toast.error('Gagal mengirim pesan', { description: e.message });
      if (fromWizard) setTestKirimResult({ success: false, error: e.message });
      else setTestKirimResult({ success: false, error: e.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveSender = async () => {
    setIsSavingSender(true);
    try {
      const res = await fetch('/api/communication/whatsapp/senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: senderPhone,
          phone: senderPhone,
          display_name: senderName,
          status: 'connected',
          sender_code: senderCode,
          channel_type: 'unofficial' // assumption based on dashboard UI
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Sender berhasil disimpan!');
        closeWizard();
      } else {
        toast.error('Gagal menyimpan sender', { description: data.message });
      }
    } catch (e: any) {
      toast.error('Kesalahan', { description: e.message });
    } finally {
      setIsSavingSender(false);
    }
  };

  const handleDisconnect = async (sender: SenderConnection) => {
    setIsDisconnecting(sender.id);
    try {
      const res = await fetch('/api/communication/whatsapp/connection/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sender.phone || sender.sender_id })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success('Koneksi diputus', { description: 'Sesi WhatsApp telah diakhiri di Bablast.' });
        fetchSenders();
      } else {
        toast.error('Gagal memutuskan koneksi', { description: data.error || data.message });
      }
    } catch (e: any) {
      toast.error('Error', { description: e.message });
    } finally {
      setIsDisconnecting(null);
    }
  };

  const handleDelete = async (sender: SenderConnection) => {
    if (!confirm('Anda yakin ingin menghapus Sender ini? Jika status Connected, koneksi akan diputus otomatis sebelum dihapus.')) return;
    
    setIsDeleting(sender.id);
    try {
      const res = await fetch(`/api/communication/whatsapp/senders/${sender.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Sender berhasil dihapus');
        fetchSenders();
      } else {
        toast.error('Gagal menghapus sender', { description: data.message || data.error });
      }
    } catch (e: any) {
      toast.error('Error', { description: e.message });
    } finally {
      setIsDeleting(null);
    }
  };

  const openStandaloneTest = (sender: SenderConnection) => {
    setStandaloneTestSender(sender);
    setTestKirimPhone('');
    setTestKirimMessage('Halo, ini pesan test dari LTMS melalui Bablast API.');
    setTestKirimResult(null);
    setIsStandaloneTestOpen(true);
  };

  // --- RENDER HELPERS ---
  const renderWizardContent = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Pengirim</Label>
              <Input placeholder="Contoh: CS Jateng 1" value={senderName} onChange={e => setSenderName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nomor WhatsApp</Label>
              <Input placeholder="Contoh: 6281234567890" value={senderPhone} onChange={e => setSenderPhone(e.target.value.replace(/\D/g, ''))} />
              <p className="text-xs text-muted-foreground">Gunakan format 628...</p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-1 mb-4">
              <p className="text-sm font-medium">Nomor: {senderPhone}</p>
              <p className="text-sm text-muted-foreground">Pilih metode otentikasi</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary transition-all" onClick={() => requestPairing('qr')}>
                <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <QrCode className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-sm">QR Code</h4>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-primary transition-all" onClick={() => requestPairing('code')}>
                <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Hash className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-sm">Pairing Code</h4>
                </CardContent>
              </Card>
            </div>
            {isRequestingPair && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Meminta sesi dari provider...</span>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col items-center space-y-6">
             <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md border w-full text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={pairingStatus === 'connected' ? 'default' : pairingStatus === 'failed' || pairingStatus === 'timeout' ? 'destructive' : 'secondary'} className="capitalize">
                  {pairingStatus === 'pending' ? <span className="flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Polling...</span> : pairingStatus}
                </Badge>
              </div>

              {pairingStatus === 'timeout' && (
                <div className="text-center">
                  <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Sesi Berakhir</p>
                  <Button variant="outline" className="mt-4" onClick={() => goToStep(2)}>Coba Lagi</Button>
                </div>
              )}

              {pairingStatus === 'connected' && (
                 <div className="text-center text-green-600">
                   <CheckCircle2 className="h-16 w-16 mx-auto mb-4" />
                   <h3 className="font-semibold text-lg">WhatsApp Connected!</h3>
                   <p className="text-sm text-green-700/80 mt-1">Mengalihkan ke langkah selanjutnya...</p>
                 </div>
              )}

              {pairingStatus === 'pending' && pairingMethod === 'qr' && pairingData?.qr && (
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white border rounded-xl shadow-sm mb-4">
                    <QRCode value={pairingData.qr} size={200} />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">Buka WhatsApp &gt; Tautkan Perangkat &gt; Scan QR</p>
                </div>
              )}

              {pairingStatus === 'pending' && pairingMethod === 'code' && pairingData?.pairing_code && (
                <div className="flex flex-col items-center w-full">
                  <div className="p-6 bg-slate-50 border rounded-xl shadow-sm text-center w-full mb-4">
                    <span className="text-4xl font-mono tracking-widest font-bold text-slate-800">{pairingData.pairing_code}</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">Masukkan kode ini di notifikasi WhatsApp Anda</p>
                </div>
              )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
              <p className="font-semibold mb-2 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Sender Code Diperlukan</p>
              <p>Meskipun WhatsApp sudah terhubung, Anda harus mendaftarkan nomor ini di Dashboard Bablast dan menyalin <b>Sender Code</b> yang diberikan.</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Buka Dashboard Bablast &gt; Sender</li>
                <li>Klik Tambah Sender dan pilih Unofficial</li>
                <li>Pilih nomor yang baru di-scan ini</li>
                <li>Salin 8 digit Sender Code yang dihasilkan</li>
              </ol>
            </div>
            <div className="space-y-2 pt-2">
              <Label>Sender Code Bablast</Label>
              <Input placeholder="Contoh: EFYK91RO" value={senderCode} onChange={e => setSenderCode(e.target.value.toUpperCase())} className="font-mono uppercase tracking-wider text-lg py-6" />
            </div>
          </div>
        );
      case 5:
      case 6: // Step 6 is essentially viewing the test send result
        return (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sender Code:</span>
              <span className="font-mono font-bold">{senderCode}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Kita harus melakukan test kirim pesan untuk memverifikasi bahwa Sender Code ini valid dan aktif.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nomor Tujuan Test</Label>
                <Input placeholder="Nomor penerima test..." value={testKirimTarget} onChange={e => setTestKirimTarget(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pesan Test</Label>
                <Input value={testKirimMessage} onChange={e => setTestKirimMessage(e.target.value)} />
              </div>
              
              {testKirimResult && !testKirimResult.success && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                  <p className="font-semibold">Test Gagal (HTTP {testKirimResult.status})</p>
                  <p className="mt-1">{testKirimResult.error || testKirimResult.data?.message}</p>
                  {testKirimResult.status === 404 && (
                    <p className="mt-2 text-xs opacity-90">Solusi: Pastikan Sender Code benar. Jika baru dibuat di Dashboard Bablast, coba lagi dalam beberapa detik.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 7:
        return (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Sender Siap!</h3>
            <p className="text-muted-foreground max-w-sm">
              WhatsApp telah terhubung, Sender Code divalidasi, dan pesan test berhasil dikirim.
            </p>
            <div className="bg-slate-50 border rounded-lg p-4 w-full text-left mt-4 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Nama:</span> <span className="font-medium">{senderName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nomor:</span> <span className="font-medium font-mono">{senderPhone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kode:</span> <span className="font-medium font-mono">{senderCode}</span></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderWizardFooter = () => {
    switch (wizardStep) {
      case 1:
        return <Button className="w-full" onClick={handleStep1Submit}>Lanjut ke Pairing</Button>;
      case 2:
        return <Button variant="ghost" className="w-full" onClick={() => goToStep(1)}>Kembali</Button>;
      case 3:
        return <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={closeWizard}>Batalkan Pairing</Button>;
      case 4:
        return (
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => goToStep(3)}>Kembali (Status)</Button>
            <Button className="flex-1" onClick={handleStep4Submit}>Validasi Code</Button>
          </div>
        );
      case 5:
      case 6:
        return (
          <div className="flex w-full flex-col gap-3">
            <Button className="w-full" onClick={() => handleTestSend(true)} disabled={isSendingTest}>
              {isSendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</> : <><Send className="mr-2 h-4 w-4" /> Kirim Pesan Test</>}
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => goToStep(4)}>Kembali Edit Code</Button>
          </div>
        );
      case 7:
        return (
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleSaveSender} disabled={isSavingSender}>
            {isSavingSender ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan Sender ke LTMS'}
          </Button>
        );
      default:
        return null;
    }
  };

  const getWizardStepTitle = () => {
    switch (wizardStep) {
      case 1: return "Informasi Sender";
      case 2: return "Metode Pairing";
      case 3: return "Proses Pairing";
      case 4: return "Input Sender Code";
      case 5:
      case 6: return "Test Kirim (Validasi)";
      case 7: return "Selesai";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Bablast API Config Section */}
      {configStatus?.isSuperAdmin && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase text-muted-foreground">Konfigurasi Sistem Global</h3>
          
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
      )}

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
            onClick={() => startWizard()} 
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
                Hubungkan nomor WhatsApp Anda untuk mulai menggunakan fitur Push Mas Kurir.
              </p>
              <Button onClick={() => startWizard()}>
                + Konek Sender
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {senders.map((sender) => {
              const isReady = sender.status === 'connected' && !!sender.sender_code;
              const isConnectedNoCode = sender.status === 'connected' && !sender.sender_code;
              
              return (
              <Card key={sender.id} className={`shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ${isReady ? 'border-green-200' : isConnectedNoCode ? 'border-amber-200' : 'border-red-200'}`}>
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle className="text-base font-semibold">
                      {sender.display_name || sender.phone || sender.sender_id}
                    </CardTitle>
                    {sender.sender_code ? (
                      <CardDescription className="text-xs font-mono bg-muted px-2 py-0.5 rounded w-max">
                        Code: {sender.sender_code}
                      </CardDescription>
                    ) : (
                      <CardDescription className="text-xs font-mono bg-muted px-2 py-0.5 rounded w-max text-red-500">
                        Code Missing
                      </CardDescription>
                    )}
                  </div>
                  {isReady ? (
                    <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> READY
                    </Badge>
                  ) : isConnectedNoCode ? (
                    <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/20">
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> NEED CODE
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> DISCONNECTED
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pb-4 flex-1">
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Nomor Terhubung:</span>
                      <span className="font-medium text-foreground font-mono">{sender.phone || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Status WhatsApp:</span>
                      <span className="font-medium text-foreground capitalize">{sender.status}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t p-3 flex flex-col gap-2">
                  
                  {isConnectedNoCode && (
                    <div className="w-full bg-amber-50 border border-amber-200 text-amber-700 p-2 rounded-md mb-1 text-xs text-center">
                      Sender Code wajib diisi. Silakan Reconnect.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 w-full">
                    {sender.status === 'connected' ? (
                       <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        onClick={() => handleDisconnect(sender)}
                        disabled={isDisconnecting === sender.id}
                      >
                        {isDisconnecting === sender.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Putus Koneksi'}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs"
                        onClick={() => startWizard(sender)}
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Reconnect
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs"
                      disabled={!isReady}
                      onClick={() => openStandaloneTest(sender)}
                    >
                      <Send className="w-3 h-3 mr-2" />
                      Test Kirim
                    </Button>
                  </div>
                  <div className="w-full pt-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 h-7"
                      onClick={() => handleDelete(sender)}
                      disabled={isDeleting === sender.id}
                    >
                      {isDeleting === sender.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />} Hapus Permanen
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )})}
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : (
                'Test & Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WIZARD MODAL */}
      <Dialog open={isWizardOpen} onOpenChange={(open) => !open && closeWizard()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isReconnectMode ? 'Reconnect Sender' : 'Tambah Sender Baru'}
            </DialogTitle>
            <DialogDescription>
              Langkah {wizardStep} dari 7: {getWizardStepTitle()}
            </DialogDescription>
            
            {/* Step Indicators */}
            <div className="flex justify-between mt-4 pb-2 border-b">
               {[1, 2, 3, 4, 5, 7].map(step => (
                 <div key={step} className={`h-1.5 flex-1 mx-0.5 rounded-full ${wizardStep >= step ? 'bg-primary' : 'bg-muted'}`} />
               ))}
            </div>
          </DialogHeader>

          <div className="py-2 min-h-[200px]">
            {renderWizardContent()}
          </div>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            {renderWizardFooter()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STANDALONE TEST KIRIM MODAL */}
      <Dialog open={isStandaloneTestOpen} onOpenChange={setIsStandaloneTestOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Test Kirim Pesan</DialogTitle>
            <DialogDescription>
              Uji coba pengiriman pesan menggunakan sender <span className="font-semibold text-foreground">{standaloneTestSender?.display_name || standaloneTestSender?.phone}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted p-2 rounded text-xs flex justify-between">
              <span>Sender Code: <b className="font-mono">{standaloneTestSender?.sender_code}</b></span>
              <span>Status: <b className="text-green-600">CONNECTED</b></span>
            </div>
            <div className="space-y-2">
              <Label>Nomor Tujuan</Label>
              <Input placeholder="628..." value={testKirimPhone} onChange={e => setTestKirimPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pesan</Label>
              <Input value={testKirimMessage} onChange={e => setTestKirimMessage(e.target.value)} />
            </div>
            
            {testKirimResult && (
              <div className={`mt-2 p-3 text-sm rounded-md border ${testKirimResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <p className="font-semibold">{testKirimResult.success ? 'Berhasil (200)' : `Gagal (${testKirimResult.status})`}</p>
                <p className="mt-1 opacity-90">{testKirimResult.success ? 'Pesan telah masuk antrean pengiriman Bablast.' : testKirimResult.error || 'Terjadi kesalahan tidak diketahui.'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStandaloneTestOpen(false)}>Tutup</Button>
            <Button onClick={() => handleTestSend(false)} disabled={isSendingTest}>
              {isSendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</> : 'Kirim Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
