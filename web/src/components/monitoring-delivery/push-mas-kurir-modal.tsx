'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, AlertTriangle, MessageSquare, ExternalLink } from 'lucide-react';
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');

  const { data: contactsResponse, isLoading: contactsLoading } = useQuery({
    queryKey: ['whatsapp_contacts', dpName, 'active'],
    queryFn: () => fetch(`/api/communication/whatsapp/contacts?activeOnly=true${dpName ? `&dp=${dpName}` : ''}`).then(res => res.json()),
    enabled: isOpen
  });

  const { data: templatesResponse, isLoading: templateLoading } = useQuery({
    queryKey: ['whatsapp_templates'],
    queryFn: () => fetch('/api/communication/whatsapp/template').then(res => res.json()), // Adjust this if we support multiple templates later, right now the endpoint returns single active.
    enabled: isOpen
  });

  const { data: sendersResponse, isLoading: sendersLoading } = useQuery({
    queryKey: ['whatsapp_senders'],
    queryFn: () => fetch('/api/communication/whatsapp/senders').then(res => res.json()),
    enabled: isOpen
  });

  if (!isOpen) return null;

  // Prepare base payload
  const sessionData = data.map(r => {
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
  const template = templatesResponse?.data;
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
      toast.error('Sender Belum Terhubung', { description: 'WhatsApp Sender belum terhubung. Silakan konek di Communication Center.' });
      return;
    }
    if (readyTargets.length === 0) {
      toast.error('Target Kosong', { description: 'Tidak ada target dengan nomor WhatsApp yang valid.' });
      return;
    }
    if (!template) {
      toast.error('Template Kosong', { description: 'Template pesan aktif belum diatur.' });
      return;
    }

    try {
      setIsSending(true);
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

      toast.success('Pengiriman Berhasil', { description: `Berhasil memproses ${responseData.data.targetCount} pesan.` });
      onClose();
    } catch (error: any) {
      toast.error('Gagal Mengirim', { description: error.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSending(false);
    }
  };

  const getPreviewText = () => {
    if (!template || readyTargets.length === 0) return 'Tidak ada preview.';
    const sample = readyTargets[0];
    let text = template.content;
    text = text.replace(/{{nama_sprinter}}/g, sample.name);
    text = text.replace(/{{total_delivery}}/g, sample.total_delivery);
    text = text.replace(/{{clear_ttd}}/g, sample.clear_ttd);
    text = text.replace(/{{belum_ttd}}/g, sample.belum_ttd);
    text = text.replace(/{{persentase_ttd}}/g, sample.persentase_ttd.toFixed(2));
    text = text.replace(/{{target_ttd}}/g, threshold.toString());
    text = text.replace(/{{drop_point}}/g, sample.drop_point_id || '-');
    text = text.replace(/{{tanggal}}/g, new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
    return text;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] h-full sm:h-auto max-h-[100dvh] flex flex-col p-0 sm:p-6 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-6 sm:p-0 border-b sm:border-0 shrink-0">
          <DialogTitle className="text-xl">Push Mas Kurir</DialogTitle>
          <DialogDescription>
            Kirim WhatsApp reminder kepada Sprinter yang belum mencapai target TTD.
          </DialogDescription>
        </DialogHeader>

        {!isReady ? (
          <div className="flex flex-col items-center justify-center flex-1 p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Menyiapkan data...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 sm:p-0 space-y-8">
            
            {/* Target Rule */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Target Pengiriman</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Kirim jika Persentase TTD {'<'}</span>
                <div className="relative w-24">
                  <Input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="pr-8 h-9"
                  />
                  <span className="absolute right-3 top-2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </section>

            {/* Summary Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-none border-border/60 bg-muted/20">
                <CardContent className="p-4 flex flex-col justify-center">
                  <span className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Total Kandidat</span>
                  <span className="text-2xl font-bold">{eligibleTargets.length}</span>
                </CardContent>
              </Card>
              <Card className="shadow-none border-green-500/20 bg-green-50/50">
                <CardContent className="p-4 flex flex-col justify-center">
                  <span className="text-xs font-medium text-green-700/70 mb-1 uppercase tracking-wider">Siap Dikirim</span>
                  <span className="text-2xl font-bold text-green-700">{readyTargets.length}</span>
                </CardContent>
              </Card>
              <Card className="shadow-none border-amber-500/20 bg-amber-50/50">
                <CardContent className="p-4 flex flex-col justify-center">
                  <span className="text-xs font-medium text-amber-700/70 mb-1 uppercase tracking-wider">Belum Ada Nomor</span>
                  <span className="text-2xl font-bold text-amber-700">{missingContacts.length}</span>
                </CardContent>
              </Card>
            </section>

            {/* Target Preview Table */}
            {processedTargets.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Preview Target</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8 text-xs font-medium">Sprinter</TableHead>
                        <TableHead className="h-8 text-xs font-medium text-right">TTD</TableHead>
                        <TableHead className="h-8 text-xs font-medium">Nomor WA</TableHead>
                        <TableHead className="h-8 text-xs font-medium text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedTargets.slice(0, 5).map((t, i) => (
                        <TableRow key={i} className="h-10">
                          <TableCell className="py-1 text-sm font-medium">{t.sprinter_id}</TableCell>
                          <TableCell className="py-1 text-sm text-right">{t.persentase_ttd.toFixed(1)}%</TableCell>
                          <TableCell className="py-1 font-mono text-xs text-muted-foreground">
                            {t.phone_number || '-'}
                          </TableCell>
                          <TableCell className="py-1 text-right">
                            {t.phone_number ? (
                              <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200">Ready</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">No Contact</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {processedTargets.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Lihat {processedTargets.length - 5} target lainnya...
                  </p>
                )}
              </section>
            )}

            {/* Template Selection */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Template Pesan</h3>
              {template ? (
                <Select value="default">
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Pilih Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{template.name}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-dashed">
                  <span className="text-sm text-muted-foreground">Belum ada template aktif.</span>
                  <a href="/communication/push-mas-kurir" target="_blank" className="text-sm font-medium text-primary hover:underline flex items-center">
                    Kelola Template <ExternalLink className="ml-1 w-3 h-3" />
                  </a>
                </div>
              )}
            </section>

            {/* Message Preview Card */}
            {template && readyTargets.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Preview Pesan</h3>
                <Card className="shadow-none border-muted bg-[url('/wa-bg.png')] bg-repeat">
                  <CardContent className="p-4 flex">
                    <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm text-sm whitespace-pre-wrap leading-relaxed max-w-[85%] relative border border-border/50">
                      {getPreviewText()}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Sender Validation Warning */}
            {activeSenders.length === 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">WhatsApp Sender Belum Terhubung</p>
                  <p className="text-xs opacity-90 mt-0.5">Anda harus menghubungkan nomor pengirim sebelum melakukan broadcast.</p>
                </div>
                <Button variant="outline" size="sm" className="bg-white hover:bg-red-50 text-red-700 w-full sm:w-auto" onClick={() => window.open('/communication/push-mas-kurir', '_blank')}>
                  Konek Sender
                </Button>
              </div>
            )}
            
          </div>
        )}

        <DialogFooter className="p-6 sm:p-0 border-t sm:border-0 shrink-0 gap-2 sm:gap-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={isSending}>Batal</Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !isReady || activeSenders.length === 0 || readyTargets.length === 0 || !template}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Kirim Sekarang
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
