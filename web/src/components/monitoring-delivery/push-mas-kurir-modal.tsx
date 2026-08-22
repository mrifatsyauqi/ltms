'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PushMasKurirModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  dpName?: string;
}

export function PushMasKurirModal({ isOpen, onClose, data, dpName }: PushMasKurirModalProps) {
  const [threshold, setThreshold] = useState(90);
  const [isSending, setIsSending] = useState(false);

  const { data: contactsResponse, isLoading: contactsLoading } = useQuery({
    queryKey: ['whatsapp_contacts', dpName, 'active'],
    queryFn: () => fetch(`/api/communication/whatsapp/contacts?activeOnly=true${dpName ? `&dp=${dpName}` : ''}`).then(res => res.json()),
    enabled: isOpen
  });

  const { data: templateResponse, isLoading: templateLoading } = useQuery({
    queryKey: ['whatsapp_template_active'],
    queryFn: () => fetch('/api/communication/whatsapp/template').then(res => res.json()),
    enabled: isOpen
  });

  const { data: sendersResponse, isLoading: sendersLoading } = useQuery({
    queryKey: ['whatsapp_senders'],
    queryFn: () => fetch('/api/communication/whatsapp/senders').then(res => res.json()),
    enabled: isOpen
  });

  if (!isOpen) return null;

  // Prepare base payload mapped from stagedData (handles both MonitoringRecord and RefineRow)
  const sessionData = data.map(r => {
    // Detect if this is RefineRow (has dpDelivery) or MonitoringRecord (has groupName)
    const isRefine = 'dpDelivery' in r;
    const total_delivery = isRefine ? r.totalDelivery : r.waybillDelivery;
    const clear_ttd = isRefine ? (r.ttdNormalTotal + r.scanRetorTotal) : r.tandaTerima;
    const belum_ttd = isRefine ? r.belumJumlahAwb : r.belumDiterima;
    const sprinter_id = isRefine ? r.dpDelivery : r.groupName;
    const currentDpName = isRefine ? (r.kodeDp || r.dpDelivery) : dpName;

    return {
      sprinter_id,
      name: sprinter_id,
      drop_point_id: currentDpName,
      total_delivery,
      clear_ttd,
      belum_ttd,
      persentase_ttd: total_delivery > 0 ? (clear_ttd / total_delivery) * 100 : 0
    };
  });

  const contactsMap = new Map((contactsResponse?.data || []).map((c: any) => [c.sprinter_id, c.phone_number]));
  const template = templateResponse?.data;
  const activeSenders = sendersResponse?.data?.filter((s: any) => s.status === 'connected') || [];

  const eligibleTargets = sessionData.filter(t => t.persentase_ttd < threshold);
  
  const processedTargets = eligibleTargets.map(t => ({
    ...t,
    phone_number: String(contactsMap.get(t.sprinter_id) || '')
  }));

  const missingContacts = processedTargets.filter(t => !t.phone_number);
  const readyTargets = processedTargets.filter(t => t.phone_number);

  const isReady = !contactsLoading && !templateLoading && !sendersLoading;

  const handleSend = async () => {
    if (activeSenders.length === 0) {
      toast.error('Tidak ada WhatsApp Sender yang aktif. Silakan hubungkan di menu Communication Center.');
      return;
    }
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
      // Use the first active sender by default
      const senderId = activeSenders[0].sender_id;

      const res = await fetch('/api/communication/whatsapp/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: readyTargets,
          threshold,
          operator: '<',
          sender_code: senderId
        })
      });
      
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Gagal mengirim pesan');

      toast.success(`Berhasil memproses ${responseData.data.targetCount} pesan.`);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Push Mas Kurir</DialogTitle>
          <DialogDescription>
            Kirim WhatsApp reminder otomatis kepada Sprinter yang TTD-nya masih di bawah target.
          </DialogDescription>
        </DialogHeader>

        {!isReady ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="threshold">Batas Target TTD (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Sprinter (Di bawah {threshold}%):</span>
                <span className="font-semibold">{eligibleTargets.length} orang</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kontak WA Ditemukan:</span>
                <span className="font-semibold text-green-600">{readyTargets.length} orang</span>
              </div>
              {missingContacts.length > 0 && (
                <div className="flex gap-2 items-start text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Ada {missingContacts.length} sprinter yang belum terdaftar nomor WhatsApp-nya di sistem. 
                    Mereka akan dilewati.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status Sistem</Label>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Template Pesan:</span>
                  {template ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700">{template.name}</Badge>
                  ) : (
                    <Badge variant="destructive">Belum Diatur</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">WhatsApp Sender:</span>
                  {activeSenders.length > 0 ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {activeSenders[0].display_name || activeSenders[0].sender_id}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Tidak Ada Sender Aktif</Badge>
                  )}
                </div>
              </div>
            </div>

            {template && readyTargets.length > 0 && (
              <div className="space-y-2">
                <Label>Preview Pesan (Contoh untuk {readyTargets[0].name})</Label>
                <div className="bg-muted p-3 text-xs whitespace-pre-wrap rounded-md font-mono h-32 overflow-y-auto">
                  {template.content
                    .replace(/\{\{nama_sprinter\}\}/g, readyTargets[0].name)
                    .replace(/\{\{total_delivery\}\}/g, String(readyTargets[0].total_delivery))
                    .replace(/\{\{clear_ttd\}\}/g, String(readyTargets[0].clear_ttd))
                    .replace(/\{\{belum_ttd\}\}/g, String(readyTargets[0].belum_ttd))
                    .replace(/\{\{persentase_ttd\}\}/g, readyTargets[0].persentase_ttd.toFixed(2))
                    .replace(/\{\{target_ttd\}\}/g, String(threshold))
                    .replace(/\{\{drop_point\}\}/g, readyTargets[0].drop_point_id)
                    .replace(/\{\{tanggal\}\}/g, new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>Batal</Button>
          <Button 
            onClick={handleSend} 
            disabled={!isReady || readyTargets.length === 0 || !template || activeSenders.length === 0 || isSending}
            className="bg-[#25D366] hover:bg-[#1DA851] text-white"
          >
            {isSending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Kirim {readyTargets.length} Pesan</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
