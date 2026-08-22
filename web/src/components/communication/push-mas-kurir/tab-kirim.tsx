'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Send, AlertTriangle } from 'lucide-react';
import { SendTarget } from '@/services/communication/whatsapp.service';

export function TabKirim({ onNavigateToContacts }: { onNavigateToContacts: () => void }) {
  const [sessionData, setSessionData] = useState<SendTarget[]>([]);
  const [threshold, setThreshold] = useState(90);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem('pushMasKurirData');
    if (data) {
      try {
        setSessionData(JSON.parse(data));
      } catch (e) {
        console.error('Failed to parse pushMasKurirData', e);
      }
    }
  }, []);

  const { data: contactsResponse, isLoading: contactsLoading } = useQuery({
    queryKey: ['whatsapp_contacts'],
    queryFn: () => fetch('/api/communication/whatsapp/contacts').then(res => res.json())
  });

  const { data: templateResponse, isLoading: templateLoading } = useQuery({
    queryKey: ['whatsapp_template_active'],
    queryFn: () => fetch('/api/communication/whatsapp/template').then(res => res.json())
  });

  if (!sessionData || sessionData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Tidak ada data terpilih. Silakan mulai dari menu <strong>Monitoring Delivery</strong> dan klik <strong>Push Mas Kurir</strong>.
        </CardContent>
      </Card>
    );
  }

  const contactsMap = new Map((contactsResponse?.data || []).map((c: any) => [c.sprinter_id, c.phone_number]));
  const template = templateResponse?.data;

  // Filter based on rule
  const eligibleTargets = sessionData.filter(t => t.persentase_ttd < threshold);
  
  // Combine with contacts
  const processedTargets: SendTarget[] = eligibleTargets.map(t => ({
    ...t,
    phone_number: String(contactsMap.get(t.sprinter_id) || '')
  }));

  const missingContacts = processedTargets.filter(t => !t.phone_number);
  const readyTargets = processedTargets.filter(t => t.phone_number);

  const handleSend = async () => {
    if (readyTargets.length === 0) {
      toast.error('Tidak ada target yang valid untuk dikirim pesan.');
      return;
    }
    if (!template) {
      toast.error('Template pesan belum diatur.');
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch('/api/communication/whatsapp/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: readyTargets,
          threshold,
          operator: '<'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Berhasil memproses ${data.data.targetCount} pesan. Silakan cek tab riwayat.`);
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengirim pesan.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Aturan Pengiriman</CardTitle>
          <CardDescription>Pesan akan dikirim ke target yang memenuhi kriteria berikut.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label>Kirim Jika Persentase TTD &lt;</Label>
            <div className="relative w-32">
              <Input 
                type="number" 
                value={threshold} 
                onChange={e => setThreshold(Number(e.target.value))} 
              />
              <span className="absolute right-3 top-2 text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-md">
              <span className="text-sm font-medium">Total Kandidat (TTD &lt; {threshold}%)</span>
              <span className="font-bold text-lg">{processedTargets.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-500/10 text-emerald-600 rounded-md">
              <span className="text-sm font-medium">Siap Kirim (Ada Nomor)</span>
              <span className="font-bold text-lg">{readyTargets.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-rose-500/10 text-rose-600 rounded-md">
              <span className="text-sm font-medium">Belum Ada Nomor</span>
              <span className="font-bold text-lg">{missingContacts.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingContacts.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 text-amber-600 rounded-md border border-amber-500/20">
                <AlertTriangle className="size-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Ada nomor yang kosong</p>
                  <p className="text-sm mt-1 mb-2">Sebagian target tidak dapat dikirim karena nomor belum didaftarkan.</p>
                  <Button size="sm" variant="outline" className="bg-white hover:bg-amber-50 text-amber-700 border-amber-500/50" onClick={onNavigateToContacts}>
                    Isi Nomor Target
                  </Button>
                </div>
              </div>
            )}
            {!template && !templateLoading && (
              <p className="text-rose-500 text-sm font-medium">Template pesan belum aktif. Silakan cek tab Template Pesan.</p>
            )}
            <div className="pt-4 border-t">
              <Button 
                onClick={handleSend} 
                disabled={isSending || readyTargets.length === 0 || !template}
                className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white"
              >
                <Send className="size-4 mr-2" />
                {isSending ? 'Mengirim...' : `Kirim Pesan Sekarang (${readyTargets.length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
