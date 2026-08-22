'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardScope, ALL_SCOPE } from '@/components/dashboard/scope-context';
export function TabKontak() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone_number: '',
    is_active: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: contactsResponse, isLoading } = useQuery({
    queryKey: ['whatsapp_contacts_all'],
    // Fetch without DP filter, the API will scope it to the user's DP if they are Admin DP/SPV
    queryFn: () => fetch('/api/communication/whatsapp/contacts').then(res => res.json())
  });

  const contacts = contactsResponse?.data || [];
  const { scope } = useDashboardScope();

  const filteredContacts = contacts.filter((c: any) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery)
  );

  const openAddDialog = () => {
    if (scope === ALL_SCOPE) {
      toast.error('Pilih Drop Point aktif terlebih dahulu di panel Scope Filter untuk menambah kontak.');
      return;
    }
    setFormData({ id: '', name: '', phone_number: '', is_active: true });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contact: any) => {
    setFormData({
      id: contact.id || '',
      name: contact.name,
      phone_number: contact.phone_number,
      is_active: contact.is_active !== undefined ? contact.is_active : true
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (contact: any, newStatus: boolean) => {
    try {
      const res = await fetch('/api/communication/whatsapp/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contact,
          is_active: newStatus
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      
      toast.success('Status kontak diperbarui');
      queryClient.invalidateQueries({ queryKey: ['whatsapp_contacts_all'] });
      // Also invalidate scoped contacts used in the modal
      queryClient.invalidateQueries({ queryKey: ['whatsapp_contacts'] });
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengubah status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone_number) {
      toast.error('Semua kolom wajib diisi');
      return;
    }

    if (scope === ALL_SCOPE) {
      toast.error('Gagal: Scope aktif saat ini adalah Semua DP.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/communication/whatsapp/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, drop_point_id: scope })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Kontak berhasil disimpan');
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['whatsapp_contacts_all'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp_contacts'] });
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan kontak');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Manajemen Kontak</h2>
          <p className="text-sm text-muted-foreground">
            Kelola nomor WhatsApp Sprinter untuk pengiriman pesan otomatis.
          </p>
        </div>
        
        <Button onClick={openAddDialog} disabled={scope === ALL_SCOPE}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Kontak
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari Nama atau Nomor WA..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Drop Point</TableHead>
                <TableHead>Nomor WA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                    Tidak ada kontak ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((c: any) => (
                  <TableRow key={c.id || Math.random()}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.drop_point_id}</TableCell>
                    <TableCell>{c.phone_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={c.is_active !== false} 
                          onCheckedChange={(checked) => handleToggleStatus(c, checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {c.is_active !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(c)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Kontak' : 'Tambah Kontak Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kode DP</Label>
              <div className="text-sm font-medium p-2 bg-muted rounded-md border">{scope}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input 
                id="name" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor WhatsApp</Label>
              <Input 
                id="phone" 
                value={formData.phone_number}
                onChange={e => setFormData({...formData, phone_number: e.target.value})}
                placeholder="62812xxxx"
                required
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="active" 
                checked={formData.is_active} 
                onCheckedChange={c => setFormData({...formData, is_active: c})}
              />
              <Label htmlFor="active">Kontak Aktif</Label>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
