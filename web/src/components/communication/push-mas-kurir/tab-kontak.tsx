'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { SendTarget } from '@/services/communication/whatsapp.service';

export function TabKontak() {
  const queryClient = useQueryClient();
  const [sessionData, setSessionData] = useState<SendTarget[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');

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

  const { data: contactsResponse, isLoading } = useQuery({
    queryKey: ['whatsapp_contacts'],
    queryFn: () => fetch('/api/communication/whatsapp/contacts').then(res => res.json())
  });

  const contactsMap = new Map((contactsResponse?.data || []).map((c: any) => [c.sprinter_id, c.phone_number]));

  const combinedList: SendTarget[] = sessionData.map(t => ({
    ...t,
    phone_number: String(contactsMap.get(t.sprinter_id) || '')
  }));

  const handleSave = async (target: SendTarget) => {
    if (!editPhone || editPhone.trim() === '') {
      toast.error('Nomor telepon tidak boleh kosong');
      return;
    }

    try {
      const res = await fetch('/api/communication/whatsapp/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprinter_id: target.sprinter_id,
          name: target.name,
          phone_number: editPhone.trim(),
          drop_point_id: target.drop_point_id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Kontak berhasil disimpan');
      setEditingId(null);
      setEditPhone('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp_contacts'] });
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan kontak');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontak Target</CardTitle>
        <CardDescription>Atur nomor WhatsApp target dari data yang diunggah saat ini.</CardDescription>
      </CardHeader>
      <CardContent>
        {sessionData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Belum ada data terpilih.</p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target ID</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Drop Point</TableHead>
                  <TableHead>Nomor WA</TableHead>
                  <TableHead className="w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedList.map(t => (
                  <TableRow key={t.sprinter_id}>
                    <TableCell>{t.sprinter_id}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.drop_point_id}</TableCell>
                    <TableCell>
                      {editingId === t.sprinter_id ? (
                        <Input 
                          value={editPhone} 
                          onChange={e => setEditPhone(e.target.value)} 
                          placeholder="628..." 
                          className="w-full min-w-[150px]"
                        />
                      ) : (
                        t.phone_number ? (
                          <span>{String(t.phone_number)}</span>
                        ) : (
                          <span className="text-rose-500 text-sm font-medium">Belum ada</span>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === t.sprinter_id ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSave(t)}>Simpan</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Batal</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingId(t.sprinter_id);
                          setEditPhone(t.phone_number || '');
                        }}>
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
