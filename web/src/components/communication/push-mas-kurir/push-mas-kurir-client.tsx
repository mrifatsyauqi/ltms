'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabKirim } from './tab-kirim';
import { TabKontak } from './tab-kontak';
import { TabTemplate } from './tab-template';
import { TabRiwayat } from './tab-riwayat';

export function PushMasKurirClient() {
  const [activeTab, setActiveTab] = useState('kirim');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="bg-muted">
        <TabsTrigger value="kirim">Kirim Push</TabsTrigger>
        <TabsTrigger value="kontak">Kontak Sprinter</TabsTrigger>
        <TabsTrigger value="template">Template Pesan</TabsTrigger>
        <TabsTrigger value="riwayat">Riwayat Pengiriman</TabsTrigger>
      </TabsList>

      <TabsContent value="kirim" className="m-0">
        <TabKirim onNavigateToContacts={() => setActiveTab('kontak')} />
      </TabsContent>

      <TabsContent value="kontak" className="m-0">
        <TabKontak />
      </TabsContent>

      <TabsContent value="template" className="m-0">
        <TabTemplate />
      </TabsContent>

      <TabsContent value="riwayat" className="m-0">
        <TabRiwayat />
      </TabsContent>
    </Tabs>
  );
}
