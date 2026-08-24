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
      <div className="w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
        <TabsList className="inline-flex w-max bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="sender" className="px-4 py-2 text-sm">WhatsApp Sender</TabsTrigger>
          <TabsTrigger value="kontak" className="px-4 py-2 text-sm">Kontak Sprinter</TabsTrigger>
          <TabsTrigger value="template" className="px-4 py-2 text-sm">Template Pesan</TabsTrigger>
          <TabsTrigger value="riwayat" className="px-4 py-2 text-sm">Riwayat Pengiriman</TabsTrigger>
        </TabsList>
      </div>

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
