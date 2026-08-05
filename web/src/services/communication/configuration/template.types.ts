export type TemplateModule =
  | 'monitoring_inc'
  | 'monitoring_delivery'
  | 'longtail'
  | 'dashboard'
  | 'custom';

export type CardTheme = 'red' | 'dark' | 'blue' | 'green';
export type KpiGridStyle = '2_column' | '4_column' | 'horizontal_5';
export type ActionButtonType = 'none' | 'open_dashboard';

export interface CardHeaderConfig {
  title: string;
  subtitle?: string;
  pickupDpLabel?: string;
  pickupDpValue?: string;
  targetCityLabel?: string;
  targetCityValue?: string;
  updateLabel?: string;
  updateValue?: string;
  showPickupDp?: boolean;
  showTargetCity?: boolean;
  showUpdate?: boolean;
}

export interface CardKpiItem {
  id: string;
  label: string;
  valueTemplate: string;
  color?: 'default' | 'red' | 'green' | 'blue' | 'orange' | 'purple';
  icon?: string;
}

export interface CardKpiGridConfig {
  title?: string;
  layout: 'horizontal_5' | '4_column' | '2_column';
  items: CardKpiItem[];
}

export interface CardSubdistrictsConfig {
  title: string;
  maxItems: '5' | '10' | 'all';
  sortOrder: 'desc' | 'asc';
  show: boolean;
}

export interface CardLastScanConfig {
  title: string;
  scanTimeLabel?: string;
  scanTimeValue?: string;
  awbLabel?: string;
  awbValue?: string;
  statusLabel?: string;
  statusValue?: string;
  fallbackText?: string;
  show: boolean;
}

export interface CardScreenshotConfig {
  show: boolean;
  hdQuality?: boolean;
}

export interface CardFooterConfig {
  title?: string;
  description?: string;
  show: boolean;
}

export interface CardActionButtonConfig {
  label: string;
  url: string;
  enabled: boolean;
}

export interface VisualCardBlocksConfig {
  theme: CardTheme;
  header: CardHeaderConfig;
  lastScan?: CardLastScanConfig;
  kpiGrid: CardKpiGridConfig;
  subdistricts?: CardSubdistrictsConfig;
  screenshot: CardScreenshotConfig;
  footer: CardFooterConfig;
  actionButton: CardActionButtonConfig;

  // Backward compatibility fields
  title?: string;
  showLogo?: boolean;
  showSummary?: boolean;
  showKpiGrid?: boolean;
  kpiStyle?: KpiGridStyle;
  showTopKecamatan?: boolean;
  topKecamatanLimit?: 5 | 10 | 15;
  showImage?: boolean;
  showFooter?: boolean;
  footerText?: string;
}

export interface VariableDefinition {
  key: string;
  label: string;
  description: string;
  example: string;
  category: 'general' | 'metrics' | 'meta';
}

export interface TemplateVariablesContext {
  // Wilayah & Identitas
  pickup_dp?: string;
  pickupDp?: string;
  dp?: string;
  drop_point?: string;
  dropPoint?: string;
  target_city?: string;
  targetCity?: string;
  city?: string;
  target_kota?: string;
  branch?: string;
  cabang?: string;
  user?: string;
  senderName?: string;
  generated_by?: string;

  // Waktu
  generated_at?: string;
  generatedAt?: string;
  today?: string;
  time?: string;
  generated_date?: string;
  generated_time?: string;

  // Metrik Monitoring INC
  total_inc?: string | number;
  totalInc?: string | number;
  total_package?: string | number;
  total?: string | number;
  clear_ttd?: string | number;
  clearTtd?: string | number;
  clear?: string | number;
  pending_ttd?: string | number;
  pendingTtd?: string | number;
  pending_package?: string | number;
  belum?: string | number;
  over_sla?: string | number;
  overSla?: string | number;
  late?: string | number;
  sla_percentage?: string | number;
  slaPercentage?: string | number;
  progress?: string | number;
  percent?: string | number;

  // Metrik Monitoring Delivery
  total_arrived?: string | number;
  totalArrived?: string | number;
  totalSampai?: string | number;
  total_delivery?: string | number;
  totalDelivery?: string | number;
  totalAntaran?: string | number;
  delivery_percentage?: string | number;
  deliveryPercentage?: string | number;

  // Last Scan
  last_scan_time?: string;
  lastScanTime?: string;
  last_scan_awb?: string;
  lastScanAwb?: string;
  last_scan_status?: string;
  lastScanStatus?: string;

  // Detail List Kecamatan
  destination_subdistricts?: string;
  district_list?: string;
  top_kecamatan?: string;
  topKecamatan?: any;

  // Lampiran & Footer
  monitoring_image?: string;
  footer?: string;
  [key: string]: any;
}
