export type TemplateModule =
  | 'monitoring_inc'
  | 'monitoring_delivery'
  | 'longtail'
  | 'dashboard'
  | 'custom';

export type CardTheme = 'red' | 'dark' | 'blue' | 'green';
export type KpiGridStyle = '2_column' | '4_column';
export type ActionButtonType = 'none' | 'open_dashboard';

export interface VisualCardBlocksConfig {
  title: string;
  theme: CardTheme;
  showLogo: boolean;
  showSummary: boolean;
  showKpiGrid: boolean;
  kpiStyle: KpiGridStyle;
  showTopKecamatan: boolean;
  topKecamatanLimit: 5 | 10 | 15;
  showImage: boolean;
  showFooter: boolean;
  footerText?: string;
  actionButton: ActionButtonType;
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
  city?: string;
  target_kota?: string;
  branch?: string;
  cabang?: string;
  dp?: string;
  drop_point?: string;
  user?: string;
  generated_by?: string;

  // Waktu
  today?: string;
  time?: string;
  generated_date?: string;
  generated_time?: string;

  // Metrik Paket
  total_package?: string | number;
  total?: string | number;
  pending_package?: string | number;
  belum?: string | number;
  clear_ttd?: string | number;
  clear?: string | number;
  over_sla?: string | number;
  late?: string | number;
  progress?: string | number;
  percent?: string | number;
  sla_percentage?: string | number;

  // Detail List
  district_list?: string;
  top_kecamatan?: string;

  // Lainnya
  footer?: string;
  [key: string]: any;
}
