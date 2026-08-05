export type CommunicationChannel = 'feishu';

export type CommunicationMessageType =
  | 'interactive_card'
  | 'image'
  | 'text'
  | 'file';

export type CommunicationModule =
  | 'monitoring_inc'
  | 'monitoring_delivery'
  | 'longtail'
  | 'dashboard'
  | 'analytics'
  | 'custom';

export interface TargetScopeInfo {
  type: 'all' | 'cabang' | 'kota' | 'drop_point';
  name: string;
  code?: string;
}

export interface ReportMetricItem {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
  color?: 'default' | 'red' | 'green' | 'blue' | 'yellow' | 'orange' | 'purple';
}

export interface KecamatanStat {
  nama: string;
  total: number;
  belum: number;
  late: number;
  clear: number;
}

export interface GenericReportData {
  module?: CommunicationModule;
  title?: string;
  headerTemplate?:
    | 'red'
    | 'blue'
    | 'turquoise'
    | 'indigo'
    | 'orange'
    | 'green'
    | 'carmine'
    | 'violet';
  targetScope?: TargetScopeInfo;
  targetKota?: string;
  targetDp?: string;
  total?: number;
  belum?: number;
  late?: number;
  clear?: number;
  percent?: number;
  metrics?: ReportMetricItem[];
  topKecamatan?: string[];
  subdistricts?: Array<{ name: string; count: number | string; picName?: string; openId?: string }>;
  kurirList?: Array<{ name: string; count: number | string; picName?: string; openId?: string }>;
  kecamatanStats?: KecamatanStat[];
  details?: Array<{ label: string; value: string }>;
  notes?: string;
  generateTime?: string;
  imageBase64?: string; // base64 Data URL atau raw base64 string
  imageKey?: string;
  caption?: string;
}

/** Alias untuk kompatibilitas backward Monitoring INC */
export type MonitoringIncSummaryData = GenericReportData;

export interface SendMessagePayload {
  channel: CommunicationChannel;
  chatId: string;
  messageType: CommunicationMessageType;
  data?: GenericReportData;
  textContent?: string;
  senderEmail?: string;
  templateId?: string;
  cardTemplateId?: string;
  cardConfig?: Record<string, any>;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  channel: CommunicationChannel;
  chatId: string;
  responseTimeMs: number;
  imageKey?: string;
  error?: string;
}

export interface FeishuGroup {
  id?: string;
  chatId: string;
  groupName: string;
  avatar?: string | null;
  memberCount?: number;
  isDefault?: boolean;
  is_default?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeishuTenantTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

export interface FeishuChatItem {
  chat_id: string;
  name: string;
  avatar?: string;
  description?: string;
  owner_id?: string;
  owner_id_type?: string;
  user_count?: string | number;
}

export interface FeishuChatListResponse {
  code: number;
  msg: string;
  data?: {
    items?: FeishuChatItem[];
    page_token?: string;
    has_more?: boolean;
  };
}

export interface FeishuUploadImageResponse {
  code: number;
  msg: string;
  data?: {
    image_key?: string;
  };
}

export interface FeishuUploadFileResponse {
  code: number;
  msg: string;
  data?: {
    file_key?: string;
  };
}

export interface FeishuSendMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id?: string;
    create_time?: string;
  };
}

export interface FeishuCardElement {
  tag: string;
  [key: string]: any;
}

export interface FeishuInteractiveCard {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: 'plain_text';
      content: string;
    };
    template?: string;
  };
  elements: FeishuCardElement[];
}
