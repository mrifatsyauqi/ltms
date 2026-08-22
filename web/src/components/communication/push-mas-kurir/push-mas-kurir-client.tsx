'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabKontak } from './tab-kontak';
import { TabTemplate } from './tab-template';
import { TabRiwayat } from './tab-riwayat';
import { TabSender } from './tab-sender';

export function PushMasKurirClient() {
  const [activeTab, setActiveTab] = useState('sender');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="bg-muted flex-wrap h-auto p-1">
        <TabsTrigger value="sender">WhatsApp Sender</TabsTrigger>
        <TabsTrigger value="kontak">Kontak Sprinter</TabsTrigger>
        <TabsTrigger value="template">Template Pesan</TabsTrigger>
        <TabsTrigger value="riwayat">Riwayat Pengiriman</TabsTrigger>
      </TabsList>

      <TabsContent value="sender" className="m-0">
        <TabSender />
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
