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
    description: 'Nama kota atau kabupaten tujuan pengiriman (cth: BATANG)',
    example: 'BATANG',
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
    label: 'Total INC',
    description: 'Total seluruh paket incoming intercity yang dimonitor',
    example: '14942',
    category: 'metrics',
  },
  {
    key: 'clear_ttd',
    label: 'Clear TTD',
    description: 'Jumlah paket yang telah berhasil terkirim dan TTD',
    example: '14816',
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
    label: 'Lewat SLA',
    description: 'Jumlah paket yang telah melampaui batas SLA',
    example: '54',
    category: 'metrics',
  },
  {
    key: 'sla_percentage',
    label: 'SLA (%)',
    description: 'Persentase pencapaian SLA operasional',
    example: '99.1',
    category: 'metrics',
  },

  // Metrik Monitoring Delivery
  {
    key: 'total_delivery',
    label: 'Total Delivery',
    description: 'Total paket yang masuk dalam proses antaran delivery',
    example: '3240',
    category: 'metrics',
  },
  {
    key: 'delivered',
    label: 'Clear / Terkirim',
    description: 'Jumlah paket berhasil diantar ke penerima',
    example: '3198',
    category: 'metrics',
  },
  {
    key: 'pending_delivery',
    label: 'Pending',
    description: 'Jumlah paket dalam antaran belum selesai',
    example: '42',
    category: 'metrics',
  },
  {
    key: 'delivery_sla',
    label: 'Delivery SLA (%)',
    description: 'Persentase penyelesaian delivery',
    example: '98.0',
    category: 'metrics',
  },

  // Last Scan
  {
    key: 'last_scan_time',
    label: 'Last Scan Time',
    description: 'Waktu aktivitas scan terakhir tercatat',
    example: '08:21 WIB',
    category: 'meta',
  },
  {
    key: 'last_scan_awb',
    label: 'AWB Last Scan',
    description: 'Nomor resi aktivitas scan terakhir',
    example: 'JT1234567890',
    category: 'meta',
  },
  {
    key: 'last_scan_status',
    label: 'Status Last Scan',
    description: 'Status scan terakhir',
    example: 'Delivery',
    category: 'meta',
  },
];

export const SAMPLE_DUMMY_CONTEXT: TemplateVariablesContext = {
  pickup_dp: 'BATANG01',
  drop_point: 'BATANG01',
  target_city: 'KOTA BATANG',
  city: 'KOTA BATANG',
  branch: 'SEMARANG',
  user: 'Admin Operasional',
  generated_at: '05 Agustus 2026 08:30 WIB',
  date: '05/08/2026',
  time: '08:30 WIB',
  total_inc: '14.942',
  clear_ttd: '14.816',
  pending_ttd: '72',
  over_sla: '54',
  sla_percentage: '99.1',
  total_arrived: '3.240',
  total_delivery: '3.240',
  delivered: '3.198',
  pending_delivery: '42',
  delivery_sla: '98.0',
  destination_subdistricts: '📍 BATANG: 24 AWB\n📍 WARUNGASEM: 18 AWB\n📍 BANDAR: 15 AWB\n📍 LIMPUNG: 10 AWB\n📍 TULIS: 5 AWB',
  last_scan_time: '08:21 WIB',
  last_scan_awb: 'JT1234567890',
  last_scan_status: 'Delivery',
  dashboard_url: 'https://ltms.jt-express.id/monitoring-inc',
};

export interface StarterPreset {
  id: string;
  module: TemplateModule;
  name: string;
  badge?: string;
  description: string;
  blocksConfig: VisualCardBlocksConfig;
}

export const STARTER_PRESETS: StarterPreset[] = [
  {
    id: 'preset_monitoring_inc',
    module: 'monitoring_inc',
    name: 'Operational Assignment Card — Monitoring INC',
    badge: 'Monitoring INC',
    description: 'Kartu pengingat & penugasan operasional intercity dengan 5 indikator KPI, rincian per kecamatan, dan mention PIC otomatis.',
    blocksConfig: {
      theme: 'red',
      header: {
        title: '📦 LTMS • Monitoring INC',
        subtitle: 'Intercity Outgoing Reminder',
        pickupDpLabel: '🏢 Pickup DP',
        pickupDpValue: '{{pickup_dp}}',
        targetCityLabel: '🎯 Kota Tujuan',
        targetCityValue: '{{target_city}}',
        updateLabel: '🕒 Generate',
        updateValue: '{{generated_at}}',
        showPickupDp: true,
        showTargetCity: true,
        showUpdate: true,
      },
      kpiGrid: {
        title: '📊 Ringkasan Monitoring',
        layout: 'horizontal_5',
        items: [
          { id: '1', label: 'Total INC', valueTemplate: '{{total_inc}}', color: 'default', icon: 'package' },
          { id: '2', label: 'Clear TTD', valueTemplate: '{{clear_ttd}}', color: 'green', icon: 'check' },
          { id: '3', label: 'Belum TTD', valueTemplate: '{{pending_ttd}}', color: 'red', icon: 'clock' },
          { id: '4', label: 'Lewat SLA', valueTemplate: '{{over_sla}}', color: 'red', icon: 'alert' },
          { id: '5', label: 'SLA', valueTemplate: '{{sla_percentage}}%', color: 'green', icon: 'trend' },
        ],
      },
      subdistricts: {
        title: '📍 Kecamatan Tujuan',
        maxItems: '10',
        sortOrder: 'desc',
        show: true,
        showMention: true,
        mentionPrefix: '👤',
        badge: 'Operational Assignment',
      },
      screenshot: {
        show: true,
        title: '🖼 Lampiran Monitoring',
        hdQuality: true,
      },
      actionButton: {
        label: '🚀 Buka LTMS Dashboard',
        url: '{{dashboard_url}}',
        enabled: true,
      },
      footer: {
        title: 'Generated Automatically by LTMS',
        description: 'Long Tail Monitoring System • Real-Time Operational Reminder',
        show: true,
      },
    },
  },
  {
    id: 'preset_monitoring_delivery',
    module: 'monitoring_delivery',
    name: 'Operational Assignment Card — Monitoring Delivery',
    badge: 'Monitoring Delivery',
    description: 'Kartu pengingat & penugasan delivery harian dengan Last Scan, Ringkasan Delivery, dan follow-up kurir dengan mention otomatis.',
    blocksConfig: {
      theme: 'dark',
      header: {
        title: '🚚 LTMS • Monitoring Delivery',
        subtitle: 'Daily Delivery Assignment',
        pickupDpLabel: '🏢 Drop Point',
        pickupDpValue: '{{drop_point}}',
        targetCityLabel: '🎯 Area',
        targetCityValue: '{{city}}',
        updateLabel: '🕒 Generate',
        updateValue: '{{generated_at}}',
        showPickupDp: true,
        showTargetCity: false,
        showUpdate: true,
      },
      lastScan: {
        title: '⏱️ Last Scan Activity',
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
        title: '📊 Ringkasan Delivery',
        layout: '4_column',
        items: [
          { id: '1', label: 'Total Delivery', valueTemplate: '{{total_delivery}}', color: 'default', icon: 'package' },
          { id: '2', label: 'Clear / Sampai', valueTemplate: '{{delivered}}', color: 'green', icon: 'check' },
          { id: '3', label: 'Pending', valueTemplate: '{{pending_delivery}}', color: 'red', icon: 'clock' },
          { id: '4', label: 'SLA Delivery', valueTemplate: '{{delivery_sla}}%', color: 'green', icon: 'trend' },
        ],
      },
      kurirFollowUp: {
        title: '🛵 Kurir Perlu Follow Up',
        maxItems: '10',
        show: true,
        showMention: true,
        mentionPrefix: '👉',
        badge: 'Kurir Assignment',
      },
      screenshot: {
        show: true,
        title: '🖼 Lampiran Monitoring Delivery',
        hdQuality: true,
      },
      actionButton: {
        label: '🚀 Buka LTMS Delivery',
        url: '{{dashboard_url}}',
        enabled: true,
      },
      footer: {
        title: 'Generated Automatically by LTMS',
        description: 'Long Tail Monitoring System • Delivery Distribution Reminder',
        show: true,
      },
    },
  },
  {
    id: 'preset_longtail',
    module: 'longtail',
    name: 'Operational Assignment Card — Long Tail Alert',
    badge: 'Long Tail Alert',
    description: 'Peringatan operasional paket tertahan (Long Tail) dengan penugasan investigasi ke Drop Point terkait.',
    blocksConfig: {
      theme: 'red',
      header: {
        title: '🚨 LTMS • Long Tail Alert',
        subtitle: 'Overdue Package Action Reminder',
        pickupDpLabel: '🏢 Lokasi Terakhir',
        pickupDpValue: '{{drop_point}}',
        targetCityLabel: '🎯 Cabang',
        targetCityValue: '{{cabang}}',
        updateLabel: '🕒 Generate',
        updateValue: '{{generated_at}}',
        showPickupDp: true,
        showTargetCity: true,
        showUpdate: true,
      },
      kpiGrid: {
        title: '📊 Ringkasan Paket Tertahan',
        layout: '2_column',
        items: [
          { id: '1', label: 'Total Paket Tertahan', valueTemplate: '{{total_package}}', color: 'red', icon: 'alert' },
          { id: '2', label: 'Status Investigasi', valueTemplate: 'Perlu Tindakan', color: 'orange', icon: 'clock' },
        ],
      },
      screenshot: {
        show: true,
        title: '🖼 Lampiran Daftar AWB Tertahan',
        hdQuality: true,
      },
      actionButton: {
        label: '🚀 Tindak Lanjut di LTMS',
        url: '{{dashboard_url}}',
        enabled: true,
      },
      footer: {
        title: 'Generated Automatically by LTMS',
        description: 'Long Tail Monitoring System • Automated Exception Dispatch',
        show: true,
      },
    },
  },
];
