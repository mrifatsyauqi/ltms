'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function TabTemplate() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: templateResponse, isLoading } = useQuery({
    queryKey: ['whatsapp_template_active'],
    queryFn: () => fetch('/api/communication/whatsapp/template').then(res => res.json())
  });

  useEffect(() => {
    if (templateResponse?.data?.content) {
      setContent(templateResponse.data.content);
    }
  }, [templateResponse]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Template tidak boleh kosong');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/communication/whatsapp/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Template berhasil disimpan');
      queryClient.invalidateQueries({ queryKey: ['whatsapp_template_active'] });
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Editor Template</CardTitle>
          <CardDescription>Ubah isi pesan WhatsApp yang akan dikirim secara massal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Ketik template pesan di sini..."
          />
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Menyimpan...' : 'Simpan Template'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Panduan Variabel</CardTitle>
          <CardDescription>Gunakan tag berikut di dalam teks pesan.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{nama_sprinter}}'}</code> - Nama Sprinter/DP</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{total_delivery}}'}</code> - Total Delivery</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{clear_ttd}}'}</code> - Clear TTD</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{belum_ttd}}'}</code> - Belum TTD</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{persentase_ttd}}'}</code> - Persentase TTD</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{target_ttd}}'}</code> - Target Minimal</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{drop_point}}'}</code> - Nama Drop Point</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">{'{{tanggal}}'}</code> - Tanggal Hari Ini</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
