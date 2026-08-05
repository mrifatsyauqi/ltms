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
    key: 'pickup_dp',
    label: 'Pickup DP',
    description: 'Nama / kode Drop Point asal pickup (cth: BATANG01)',
    example: 'BATANG01',
    category: 'general',
  },
  {
    key: 'drop_point',
    label: 'Drop Point Delivery',
    description: 'Nama / kode Drop Point tujuan delivery (cth: BATANG01)',
    example: 'BATANG01',
    category: 'general',
  },
  {
    key: 'target_city',
    label: 'Kota Tujuan Delivery',
    description: 'Nama kota atau kabupaten tujuan pengiriman (cth: KOTA BATANG)',
    example: 'KOTA BATANG',
    category: 'general',
  },
  {
    key: 'city',
    label: 'Target Kota (Alias)',
    description: 'Alias untuk kota target monitoring',
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
    key: 'user',
    label: 'Operator / Pengirim',
    description: 'Nama pengguna yang membagikan laporan',
    example: 'Admin Batang',
    category: 'general',
  },

  // Waktu
  {
    key: 'generated_at',
    label: 'Waktu Generate Lengkap',
    description: 'Format waktu lengkap (cth: 05 Agustus 2026 08.30 WIB)',
    example: '05 Agustus 2026 08.30 WIB',
    category: 'meta',
  },
  {
    key: 'today',
    label: 'Tanggal Hari Ini',
    description: 'Format tanggal singkat (cth: 05 Agu 2026)',
    example: '05 Agu 2026',
    category: 'meta',
  },
  {
    key: 'time',
    label: 'Jam Saat Ini',
    description: 'Format jam WIB (cth: 08:30 WIB)',
    example: '08:30 WIB',
    category: 'meta',
  },

  // Metrik Monitoring INC
  {
    key: 'total_inc',
    label: 'Total AWB INC',
    description: 'Total seluruh paket incoming intercity yang dimonitor',
    example: '14.942',
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
    key: 'pending_ttd',
    label: 'Belum TTD',
    description: 'Jumlah paket yang masih berstatus belum selesai / TTD',
    example: '72',
    category: 'metrics',
  },
  {
    key: 'over_sla',
    label: 'AWB Melebihi SLA',
    description: 'Jumlah paket yang telah melampaui batas SLA',
    example: '54',
    category: 'metrics',
  },
  {
    key: 'sla_percentage',
    label: 'Persentase SLA (%)',
    description: 'Persentase pencapaian SLA operasional',
    example: '99.1',
    category: 'metrics',
  },

  // Metrik Monitoring Delivery
  {
    key: 'total_arrived',
    label: 'Total Sampai',
    description: 'Total paket yang telah sampai di Drop Point',
    example: '3.420',
    category: 'metrics',
  },
  {
    key: 'total_delivery',
    label: 'Total AWB Delivery',
    description: 'Total paket yang masuk dalam proses antaran delivery',
    example: '3.210',
    category: 'metrics',
  },
  {
    key: 'delivery_percentage',
    label: 'Persentase Delivery (%)',
    description: 'Persentase keberhasilan penyelesaian antaran',
    example: '98.5',
    category: 'metrics',
  },

  // Last Scan
  {
    key: 'last_scan_time',
    label: 'Waktu Last Scan',
    description: 'Waktu aktivitas scan terakhir tercatat',
    example: '05 Agustus 2026 08:26 WIB',
    category: 'meta',
  },
  {
    key: 'last_scan_awb',
    label: 'AWB Last Scan',
    description: 'Nomor resi / AWB aktivitas scan terakhir',
    example: 'JT1234567890',
    category: 'meta',
  },
  {
    key: 'last_scan_status',
    label: 'Status Last Scan',
    description: 'Status proses scan terakhir (cth: Delivery)',
    example: 'Delivery',
    category: 'meta',
  },

  // Detail Kecamatan & Lampiran
  {
    key: 'destination_subdistricts',
    label: 'Kecamatan Tujuan',
    description: 'Daftar rincian kecamatan tujuan beserta jumlah AWB',
    example: 'BATANG\n31 AWB\n\nWARUNGASEM\n26 AWB\n\nLIMPUNG\n23 AWB',
    category: 'metrics',
  },
  {
    key: 'monitoring_image',
    label: 'Lampiran Screenshot',
    description: 'Lampiran gambar screenshot tabel monitoring HD',
    example: '[Image Attachment]',
    category: 'meta',
  },
  {
    key: 'footer',
    label: 'Teks Catatan Kaki (Footer)',
    description: 'Identitas sistem pada bagian bawah kartu',
    example: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
    category: 'meta',
  },
];

export interface StarterPreset {
  id: string;
  module: TemplateModule;
  name: string;
  badge?: string;
  description: string;
  messageContent: string;
  blocksConfig: VisualCardBlocksConfig;
}

export const STARTER_PRESETS: StarterPreset[] = [
  {
    id: 'preset_monitoring_inc',
    module: 'monitoring_inc',
    name: 'Standar Monitoring INC (Phase 2.6.1)',
    badge: 'Monitoring INC',
    description: 'Interactive card resmi Monitoring INC dengan 5 Grid KPI, Sub Header, dan daftar Kecamatan Tujuan.',
    messageContent:
      '📊 *LTMS | MONITORING INC*\n' +
      'Intercity Outgoing Monitoring\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📦 Pickup DP: {{pickup_dp}}\n' +
      '🎯 Tujuan: {{target_city}}\n' +
      '⏰ Update: {{generated_at}}\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📦 Total AWB INC: {{total_inc}}\n' +
      '✅ Clear TTD: {{clear_ttd}}\n' +
      '⏳ Belum TTD: {{pending_ttd}}\n' +
      '🚨 Lewat SLA: {{over_sla}}\n' +
      '📈 Persentase SLA: {{sla_percentage}}%\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📍 Kecamatan Tujuan:\n' +
      '{{destination_subdistricts}}\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '{{footer}}',
    blocksConfig: {
      theme: 'red',
      header: {
        title: 'LTMS | Monitoring INC',
        subtitle: 'Intercity Outgoing Monitoring',
        pickupDpLabel: 'Pickup DP',
        pickupDpValue: '{{pickup_dp}}',
        targetCityLabel: 'Tujuan',
        targetCityValue: '{{target_city}}',
        updateLabel: 'Update',
        updateValue: '{{generated_at}}',
        showPickupDp: true,
        showTargetCity: true,
        showUpdate: true,
      },
      kpiGrid: {
        title: 'Ringkasan Monitoring INC',
        layout: 'horizontal_5',
        items: [
          { id: '1', label: 'Total AWB INC', valueTemplate: '{{total_inc}}', color: 'default', icon: 'package' },
          { id: '2', label: 'Clear TTD', valueTemplate: '{{clear_ttd}}', color: 'green', icon: 'check' },
          { id: '3', label: 'Belum TTD', valueTemplate: '{{pending_ttd}}', color: 'red', icon: 'clock' },
          { id: '4', label: 'AWB Melebihi SLA', valueTemplate: '{{over_sla}}', color: 'red', icon: 'alert' },
          { id: '5', label: 'Persentase SLA', valueTemplate: '{{sla_percentage}}%', color: 'default', icon: 'trend' },
        ],
      },
      subdistricts: {
        title: '📍 Kecamatan Tujuan',
        maxItems: '5',
        sortOrder: 'desc',
        show: true,
      },
      screenshot: {
        show: true,
        hdQuality: true,
      },
      footer: {
        title: 'LTMS',
        description: 'Long Tail Monitoring System\nGenerated Automatically',
        show: true,
      },
      actionButton: {
        label: '🚀 Buka Dashboard LTMS',
        url: 'https://ltms.jt-express.id',
        enabled: true,
      },
      // Backward compatibility fields
      title: 'LTMS | Monitoring INC',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: 'horizontal_5',
      showTopKecamatan: true,
      topKecamatanLimit: 5,
      showImage: true,
      showFooter: true,
      footerText: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
    },
  },
  {
    id: 'preset_monitoring_delivery',
    module: 'monitoring_delivery',
    name: 'Standar Monitoring Delivery (Phase 2.6.1)',
    badge: 'Monitoring Delivery',
    description: 'Interactive card ringkasan performa delivery Drop Point dilengkapi Last Scan dan 5 KPI Delivery.',
    messageContent:
      '🚚 *LTMS | MONITORING DELIVERY*\n' +
      'Delivery Performance Monitoring\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🏢 Drop Point: {{drop_point}}\n' +
      '⏰ Update: {{generated_at}}\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⏱️ *Last Scan*\n' +
      '• Waktu: {{last_scan_time}}\n' +
      '• AWB: {{last_scan_awb}}\n' +
      '• Status: {{last_scan_status}}\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📦 Total Sampai: {{total_arrived}}\n' +
      '🚚 Total Delivery: {{total_delivery}}\n' +
      '✅ Clear TTD: {{clear_ttd}}\n' +
      '⏳ Belum TTD: {{pending_ttd}}\n' +
      '📈 Persentase Delivery: {{delivery_percentage}}%\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '{{footer}}',
    blocksConfig: {
      theme: 'blue',
      header: {
        title: 'LTMS | Monitoring Delivery',
        subtitle: 'Delivery Performance Monitoring',
        targetCityLabel: 'Drop Point',
        targetCityValue: '{{drop_point}}',
        updateLabel: 'Update',
        updateValue: '{{generated_at}}',
        showPickupDp: false,
        showTargetCity: true,
        showUpdate: true,
      },
      lastScan: {
        title: 'Last Scan',
        scanTimeLabel: 'Waktu Scan',
        scanTimeValue: '{{last_scan_time}}',
        awbLabel: 'AWB',
        awbValue: '{{last_scan_awb}}',
        statusLabel: 'Status',
        statusValue: '{{last_scan_status}}',
        fallbackText: 'Belum ada aktivitas scan hari ini.',
        show: true,
      },
      kpiGrid: {
        title: 'Ringkasan Delivery',
        layout: 'horizontal_5',
        items: [
          { id: '1', label: 'Total Sampai', valueTemplate: '{{total_arrived}}', color: 'default', icon: 'package' },
          { id: '2', label: 'Total AWB Delivery', valueTemplate: '{{total_delivery}}', color: 'default', icon: 'truck' },
          { id: '3', label: 'Clear TTD', valueTemplate: '{{clear_ttd}}', color: 'green', icon: 'check' },
          { id: '4', label: 'Belum TTD', valueTemplate: '{{pending_ttd}}', color: 'red', icon: 'clock' },
          { id: '5', label: 'Persentase Delivery', valueTemplate: '{{delivery_percentage}}%', color: 'default', icon: 'trend' },
        ],
      },
      screenshot: {
        show: true,
        hdQuality: true,
      },
      footer: {
        title: 'LTMS',
        description: 'Long Tail Monitoring System\nGenerated Automatically',
        show: true,
      },
      actionButton: {
        label: '🚀 Buka Dashboard LTMS',
        url: 'https://ltms.jt-express.id',
        enabled: true,
      },
      // Backward compatibility fields
      title: 'LTMS | Monitoring Delivery',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: 'horizontal_5',
      showTopKecamatan: false,
      topKecamatanLimit: 5,
      showImage: true,
      showFooter: true,
      footerText: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
    },
  },
  {
    id: 'preset_longtail_alert',
    module: 'longtail',
    name: 'Peringatan Paket Long Tail',
    badge: 'Long Tail',
    description: 'Peringatan operasional khusus paket tertahan (Long Tail SLA breach).',
    messageContent:
      '🚨 *PERINGATAN PAKET LONG TAIL*\n' +
      'Wilayah: {{target_city}} | Cabang: {{branch}}\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📦 Total Tertahan: {{pending_ttd}}\n' +
      '🚨 Lewat SLA: {{over_sla}}\n' +
      '⏰ Update: {{generated_at}}\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Mohon tim operasional segera melakukan investigasi dan update status POD.\n' +
      '{{footer}}',
    blocksConfig: {
      theme: 'red',
      header: {
        title: 'LTMS | Alert Paket Long Tail',
        subtitle: 'Critical Long Tail SLA Watch',
        targetCityLabel: 'Wilayah Target',
        targetCityValue: '{{target_city}}',
        updateLabel: 'Waktu Alert',
        updateValue: '{{generated_at}}',
        showPickupDp: false,
        showTargetCity: true,
        showUpdate: true,
      },
      kpiGrid: {
        title: 'Status Paket Bermasalah',
        layout: '2_column',
        items: [
          { id: '1', label: 'Total Tertahan', valueTemplate: '{{pending_ttd}}', color: 'red', icon: 'alert' },
          { id: '2', label: 'Lewat SLA', valueTemplate: '{{over_sla}}', color: 'red', icon: 'clock' },
        ],
      },
      screenshot: {
        show: true,
        hdQuality: true,
      },
      footer: {
        title: 'LTMS',
        description: 'Long Tail Monitoring System\nGenerated Automatically',
        show: true,
      },
      actionButton: {
        label: '🔍 Investigasi Paket',
        url: 'https://ltms.jt-express.id/longtail',
        enabled: true,
      },
      title: 'LTMS | Alert Paket Long Tail',
      showLogo: true,
      showSummary: true,
      showKpiGrid: true,
      kpiStyle: '2_column',
      showTopKecamatan: false,
      topKecamatanLimit: 5,
      showImage: true,
      showFooter: true,
      footerText: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
    },
  },
];

export const SAMPLE_DUMMY_CONTEXT: TemplateVariablesContext = {
  pickup_dp: 'BATANG01',
  pickupDp: 'BATANG01',
  drop_point: 'BATANG01',
  dropPoint: 'BATANG01',
  dp: 'BATANG01',
  target_city: 'KOTA BATANG',
  targetCity: 'KOTA BATANG',
  city: 'KOTA BATANG',
  target_kota: 'KOTA BATANG',
  branch: 'SEMARANG',
  cabang: 'SEMARANG',
  user: 'M. Rifat Syauqi (Super Admin)',
  generated_by: 'M. Rifat Syauqi (Super Admin)',

  generated_at: '05 Agustus 2026 08.30 WIB',
  generatedAt: '05 Agustus 2026 08.30 WIB',
  today: '05 Agu 2026',
  time: '08:30 WIB',
  generated_date: '05 Agu 2026',
  generated_time: '08:30 WIB',

  // Metrik INC
  total_inc: '14.942',
  totalInc: '14.942',
  total_package: '14.942',
  total: '14.942',
  clear_ttd: '14.816',
  clearTtd: '14.816',
  clear: '14.816',
  pending_ttd: '72',
  pendingTtd: '72',
  pending_package: '72',
  belum: '72',
  over_sla: '54',
  overSla: '54',
  late: '54',
  sla_percentage: '99.1',
  slaPercentage: '99.1',
  progress: '99.1',
  percent: '99.1',

  // Metrik Delivery
  total_arrived: '3.420',
  totalArrived: '3.420',
  total_delivery: '3.210',
  totalDelivery: '3.210',
  delivery_percentage: '98.5',
  deliveryPercentage: '98.5',

  // Last Scan
  last_scan_time: '05 Agustus 2026 08:26 WIB',
  lastScanTime: '05 Agustus 2026 08:26 WIB',
  last_scan_awb: 'JT1234567890',
  lastScanAwb: 'JT1234567890',
  last_scan_status: 'Delivery',
  lastScanStatus: 'Delivery',

  // Detail Kecamatan
  destination_subdistricts:
    '1. BATANG (31 AWB)\n2. WARUNGASEM (26 AWB)\n3. LIMPUNG (23 AWB)\n4. BANDAR (19 AWB)\n5. TULIS (17 AWB)',
  district_list:
    '1. BATANG (31 AWB)\n2. WARUNGASEM (26 AWB)\n3. LIMPUNG (23 AWB)\n4. BANDAR (19 AWB)\n5. TULIS (17 AWB)',
  top_kecamatan:
    '1. BATANG (31 AWB)\n2. WARUNGASEM (26 AWB)\n3. LIMPUNG (23 AWB)\n4. BANDAR (19 AWB)\n5. TULIS (17 AWB)',

  // Image & Footer
  monitoring_image: 'img_sample_key_123',
  footer: 'LTMS\nLong Tail Monitoring System\nGenerated Automatically',
};
