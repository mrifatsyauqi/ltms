import type {
  TemplateModule,
  VisualCardBlocksConfig,
  VariableDefinition,
  TemplateVariablesContext,
} from './template.types';

export type { VariableDefinition };

export const OFFICIAL_VARIABLES: VariableDefinition[] = [
  // General / Wilayah
  {
    key: 'city',
    label: 'Target Kota / Wilayah',
    description: 'Nama kota atau wilayah target monitoring (cth: BATANG)',
    example: 'BATANG',
    category: 'general',
  },
  {
    key: 'branch',
    label: 'Nama Cabang',
    description: 'Nama cabang operasional (cth: SEMARANG)',
    example: 'SEMARANG',
    category: 'general',
  },
  {
    key: 'dp',
    label: 'Drop Point',
    description: 'Nama atau kode Drop Point (cth: BATANG01)',
    example: 'BATANG01',
    category: 'general',
  },
  {
    key: 'user',
    label: 'Operator / Pengirim',
    description: 'Nama pengguna yang membagikan laporan',
    example: 'Admin Batang',
    category: 'general',
  },

  // Metrik Paket
  {
    key: 'total_package',
    label: 'Total Paket',
    description: 'Jumlah seluruh paket yang dimonitor',
    example: '14.942',
    category: 'metrics',
  },
  {
    key: 'pending_package',
    label: 'Belum TTD',
    description: 'Jumlah paket yang masih berstatus belum selesai/TTD',
    example: '72',
    category: 'metrics',
  },
  {
    key: 'clear_ttd',
    label: 'Clear TTD',
    description: 'Jumlah paket yang telah berhasil terkirim dan TTD',
    example: '14.816',
    category: 'metrics',
  },
  {
    key: 'over_sla',
    label: 'Lewat SLA',
    description: 'Jumlah paket yang telah melampaui batas SLA',
    example: '54',
    category: 'metrics',
  },
  {
    key: 'progress',
    label: 'Progress SLA (%)',
    description: 'Persentase pencapaian SLA operasional',
    example: '99.1',
    category: 'metrics',
  },
  {
    key: 'sla_percentage',
    label: 'Persentase SLA (%)',
    description: 'Alias untuk persentase SLA operasional',
    example: '99.1',
    category: 'metrics',
  },
  {
    key: 'district_list',
    label: 'Top Kecamatan Tertinggi',
    description: 'Daftar rincian kecamatan dengan sisa paket tertinggi',
    example: '1. Batang (18)\n2. Warungasem (14)\n3. Limpung (12)',
    category: 'metrics',
  },

  // Waktu & Meta
  {
    key: 'today',
    label: 'Tanggal Hari Ini',
    description: 'Format tanggal hari ini (cth: 05 Agu 2026)',
    example: '05 Agu 2026',
    category: 'meta',
  },
  {
    key: 'time',
    label: 'Jam Sekarang',
    description: 'Format jam saat ini (cth: 08:30 WIB)',
    example: '08:30 WIB',
    category: 'meta',
  },
  {
    key: 'generated_date',
    label: 'Tanggal Laporan',
    description: 'Tanggal saat laporan diekspor',
    example: '05 Agu 2026',
    category: 'meta',
  },
  {
    key: 'generated_time',
    label: 'Jam Laporan',
    description: 'Jam saat laporan diekspor',
    example: '08:30 WIB',
    category: 'meta',
  },
  {
    key: 'footer',
    label: 'Footer LTMS',
    description: 'Teks penutup identitas resmi LTMS',
    example: 'Logistics Traceability & Monitoring System (LTMS)',
    category: 'meta',
  },
];

export interface StarterPreset {
  id: string;
  module: TemplateModule;
  name: string;
  badge: string;
  iconName: string;
  description: string;
  messageContent: string;
  blocksConfig: VisualCardBlocksConfig;
}

export const STARTER_PRESETS: StarterPreset[] = [
  {
    id: 'preset_monitoring_inc',
    module: 'monitoring_inc',
    name: 'Monitoring INC',
    badge: 'SLA Incoming',
    iconName: 'Clock',
    description: 'Template pemantauan pencapaian SLA Incoming harian per kota/wilayah.',
    messageContent: `📊 MONITORING INC
Target Kota: {{city}}
━━━━━━━━━━━━━━
📦 Total Paket: {{total_package}}
⏳ Belum TTD: {{pending_package}}
✅ Clear TTD: {{clear_ttd}}
🚨 Lewat SLA: {{over_sla}}
📈 Progress: {{progress}}%
━━━━━━━━━━━━━━
Top Kecamatan:
{{district_list}}
━━━━━━━━━━━━━━
{{footer}}`,
    blocksConfig: {
      title: 'LTMS • Monitoring INC {{city}}',
      theme: 'red',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: '4_column',
      showTopKecamatan: true,
      topKecamatanLimit: 5,
      showImage: true,
      showFooter: true,
      footerText: 'Logistics Traceability & Monitoring System (LTMS)',
      actionButton: 'open_dashboard',
    },
  },
  {
    id: 'preset_monitoring_delivery',
    module: 'monitoring_delivery',
    name: 'Monitoring Delivery',
    badge: 'Delivery & Sprinter',
    iconName: 'Truck',
    description: 'Template pemantauan status antaran drop point dan performa sprinter JMS.',
    messageContent: `🚚 MONITORING DELIVERY
Cabang: {{branch}} | Drop Point: {{dp}}
━━━━━━━━━━━━━━
📦 Total Antaran: {{total_package}}
⏳ Sisa Antaran: {{pending_package}}
✅ Selesai Antar: {{clear_ttd}}
📈 Pencapaian: {{progress}}%
━━━━━━━━━━━━━━
Diperbarui: {{today}} {{time}}
Oleh: {{user}}
━━━━━━━━━━━━━━
{{footer}}`,
    blocksConfig: {
      title: 'LTMS • Delivery Summary {{dp}}',
      theme: 'blue',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: '2_column',
      showTopKecamatan: false,
      topKecamatanLimit: 5,
      showImage: true,
      showFooter: true,
      footerText: 'LTMS Delivery Dispatch System',
      actionButton: 'open_dashboard',
    },
  },
  {
    id: 'preset_longtail',
    module: 'longtail',
    name: 'Long Tail Alert',
    badge: 'Aging Paket',
    iconName: 'MessageSquareText',
    description: 'Template notifikasi paket tertahan / aging melebihi batas toleransi waktu.',
    messageContent: `⚠️ PERINGATAN PAKET LONG TAIL
Wilayah: {{city}} ({{branch}})
━━━━━━━━━━━━━━
📦 Total Paket Tertahan: {{pending_package}}
🚨 Lewat Batas: {{over_sla}}
📈 Persentase Selesai: {{progress}}%
━━━━━━━━━━━━━━
Mohon tim operasional segera melakukan follow-up ke Drop Point terkait.
━━━━━━━━━━━━━━
{{footer}}`,
    blocksConfig: {
      title: 'LTMS • Long Tail Alert {{city}}',
      theme: 'dark',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: '2_column',
      showTopKecamatan: true,
      topKecamatanLimit: 5,
      showImage: false,
      showFooter: true,
      footerText: 'LTMS Alert & Escalation Service',
      actionButton: 'open_dashboard',
    },
  },
  {
    id: 'preset_dashboard',
    module: 'dashboard',
    name: 'Dashboard Summary',
    badge: 'KPI Ringkasan',
    iconName: 'LayoutDashboard',
    description: 'Template ringkasan KPI operasional eksekutif cabang atau kota.',
    messageContent: `📈 RINGKASAN KPI OPERASIONAL
Cabang: {{branch}}
━━━━━━━━━━━━━━
📦 Total Volume: {{total_package}}
✅ Total Clear: {{clear_ttd}}
⏳ Pending: {{pending_package}}
🎯 SLA Overall: {{sla_percentage}}%
━━━━━━━━━━━━━━
Diperbarui: {{today}} {{time}}
{{footer}}`,
    blocksConfig: {
      title: 'LTMS • Executive KPI Overview',
      theme: 'green',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: '4_column',
      showTopKecamatan: false,
      topKecamatanLimit: 5,
      showImage: false,
      showFooter: true,
      footerText: 'Logistics Traceability & Monitoring System (LTMS)',
      actionButton: 'open_dashboard',
    },
  },
];

export const SAMPLE_DUMMY_CONTEXT: TemplateVariablesContext = {
  city: 'BATANG',
  target_kota: 'BATANG',
  branch: 'SEMARANG',
  cabang: 'SEMARANG',
  dp: 'BATANG01',
  drop_point: 'BATANG01',
  user: 'Admin Batang',
  generated_by: 'Admin Batang',
  today: '05 Agu 2026',
  time: '08:30 WIB',
  generated_date: '05 Agu 2026',
  generated_time: '08:30 WIB',
  total_package: '14.942',
  total: '14.942',
  pending_package: '72',
  belum: '72',
  clear_ttd: '14.816',
  clear: '14.816',
  over_sla: '54',
  late: '54',
  progress: '99.1',
  percent: '99.1',
  sla_percentage: '99.1',
  district_list: '1. Batang (18)\n2. Warungasem (14)\n3. Limpung (12)\n4. Banyuputih (10)\n5. Subah (8)',
  top_kecamatan: '1. Batang (18)\n2. Warungasem (14)\n3. Limpung (12)\n4. Banyuputih (10)\n5. Subah (8)',
  footer: 'Logistics Traceability & Monitoring System (LTMS)',
};
