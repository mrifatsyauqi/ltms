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

  // Dummy data for preview
  const dummyData = {
    nama_sprinter: 'Ahmad S',
    total_delivery: '120',
    clear_ttd: '105',
    belum_ttd: '15',
    persentase_ttd: '87.5',
    target_ttd: '90',
    drop_point: 'BGG01',
    tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  };

  const getPreviewText = () => {
    let text = content;
    Object.entries(dummyData).forEach(([key, value]) => {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return text || 'Ketik pesan di sebelah kiri untuk melihat preview.';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Template Pesan</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Atur format pesan WhatsApp yang akan dikirim secara massal ke Sprinter.
          </p>
        </div>

        <Card className="shadow-sm border-muted">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-base">Editor Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm leading-relaxed"
              placeholder="Ketik template pesan di sini..."
            />
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving || isLoading}>
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-5 space-y-6 pt-0 lg:pt-[72px]">
        {/* WhatsApp Preview Card */}
        <Card className="shadow-sm border-muted bg-green-50/30 overflow-hidden">
          <CardHeader className="bg-green-600 text-primary-foreground py-3">
            <CardTitle className="text-sm font-medium">Preview WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-[url('/wa-bg.png')] bg-repeat">
            <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm text-sm whitespace-pre-wrap leading-relaxed max-w-[90%] relative">
              {getPreviewText()}
              <div className="text-[10px] text-muted-foreground text-right mt-2 w-full">
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variables Guide */}
        <Card className="shadow-sm border-muted">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm">Panduan Variabel</CardTitle>
            <CardDescription className="text-xs">Klik untuk menyalin (opsional)</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-2 text-sm">
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{nama_sprinter}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{total_delivery}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{clear_ttd}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{belum_ttd}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{persentase_ttd}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{target_ttd}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{drop_point}}'}</code></div>
              <div className="flex items-center gap-2"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{tanggal}}'}</code></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
