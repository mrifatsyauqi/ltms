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
    name: 'Monitoring INC [Kode DP]',
    badge: 'Monitoring INC',
    description: 'Ringkasan & penugasan operasional intercity per DP pickup, dengan daftar DP tujuan bernomor dan mention PIC otomatis per baris.',
    blocksConfig: {
      theme: 'red',
      header: {
        title: 'MONITORING INC {{pickup_dp}}',
        pickupDpLabel: 'DP Pickup',
        pickupDpValue: '{{pickup_dp}}',
        updateLabel: 'Waktu Generate',
        updateValue: '{{generated_at}}',
        showPickupDp: true,
        showTargetCity: false,
        showUpdate: true,
      },
      kpiGrid: {
        title: '📊 Ringkasan Monitoring',
        layout: '2_column',
        items: [
          { id: '1', label: '📦 Total AWB INC', valueTemplate: '{{total_inc}}', color: 'default' },
          { id: '2', label: '✅ Clear TTD', valueTemplate: '{{clear_ttd}}', color: 'green' },
          { id: '3', label: '⏳ Belum TTD', valueTemplate: '{{pending_ttd}}', color: 'red' },
          { id: '4', label: '📈 Persentase', valueTemplate: '{{sla_percentage}}%', color: 'green' },
        ],
      },
      subdistricts: {
        title: '📍 Drop Point Tujuan',
        maxItems: '15',
        sortOrder: 'desc',
        show: true,
        showMention: true,
        mentionPrefix: '👤',
        listStyle: 'numbered',
      },
      freeText: {
        show: true,
        text: '',
        placeholder: 'Tambahkan catatan di sini...',
      },
      screenshot: {
        show: true,
        title: '🖼 Lampiran Monitoring',
        hdQuality: true,
      },
      actionButton: {
        label: '🚀 Buka LTMS Dashboard',
        url: '{{dashboard_url}}',
        enabled: false,
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
    name: 'Monitoring Delivery [Kode DP]',
    badge: 'Monitoring Delivery',
    description: 'Ringkasan monitoring delivery harian per Drop Point, dengan waktu update dan lampiran gambar.',
    blocksConfig: {
      theme: 'dark',
      header: {
        title: 'MONITORING DELIVERY {{drop_point}}',
        updateLabel: 'Waktu Update',
        updateValue: '{{generated_at}}',
        showPickupDp: false,
        showTargetCity: false,
        showUpdate: true,
      },
      kpiGrid: {
        title: '📊 Ringkasan Monitoring',
        layout: '2_column',
        items: [
          { id: '1', label: '📦 Total AWB', valueTemplate: '{{total_delivery}}', color: 'default' },
          { id: '2', label: '✅ Clear TTD', valueTemplate: '{{delivered}}', color: 'green' },
          { id: '3', label: '⏳ Belum TTD', valueTemplate: '{{pending_delivery}}', color: 'red' },
          { id: '4', label: '📈 Persentase', valueTemplate: '{{delivery_sla}}%', color: 'green' },
        ],
      },
      subdistricts: {
        title: '📍 Drop Point Tujuan',
        maxItems: '10',
        sortOrder: 'desc',
        show: false,
        showMention: false,
      },
      kurirFollowUp: {
        title: '🛵 Kurir Perlu Follow Up',
        maxItems: '10',
        show: false,
      },
      screenshot: {
        show: true,
        title: '🖼 Lampiran Monitoring Delivery',
        hdQuality: true,
      },
      actionButton: {
        label: '🚀 Buka LTMS Delivery',
        url: '{{dashboard_url}}',
        enabled: false,
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
