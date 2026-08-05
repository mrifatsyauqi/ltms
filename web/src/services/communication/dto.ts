import type { VisualCardBlocksConfig } from './configuration/template.types';

// ============================================================================
// 1. CARD TEMPLATE DTOs & MAPPERS
// ============================================================================

export interface CardTemplateDTO {
  id: string;
  module: string;
  template_name: string;
  blocks_config: VisualCardBlocksConfig;
  json_template?: Record<string, any>;
  is_default: boolean;
  status: 'active' | 'archived';
  version: string;
  version_note?: string;
  created_at: string;
  updated_at: string;
}

export interface CardTemplateCreateDTO {
  module: string;
  template_name: string;
  blocks_config: VisualCardBlocksConfig;
  is_default?: boolean;
  version_note?: string;
}

export interface CardTemplateUpdateDTO {
  template_name?: string;
  blocks_config?: VisualCardBlocksConfig;
  is_default?: boolean;
  version_note?: string;
  status?: 'active' | 'archived';
}

export interface CardTemplateVersionDTO {
  id: string;
  card_template_id: string;
  version: string;
  version_number?: string;
  blocks_config: VisualCardBlocksConfig;
  note?: string;
  created_at: string;
}

/**
 * Normalizes raw card template data from API/database into CardTemplateDTO
 */
export function toCardTemplateDTO(raw: any): CardTemplateDTO {
  if (!raw) {
    throw new Error('Invalid card template data');
  }

  const template_name = raw.template_name || raw.name || 'Untitled Template';
  const version_note = raw.version_note || raw.change_summary || raw.description || '';
  const version = raw.version || raw.current_version || 'v1.0';

  return {
    id: raw.id,
    module: raw.module || 'monitoring_inc',
    template_name,
    blocks_config: raw.blocks_config || {},
    json_template: raw.json_template,
    is_default: Boolean(raw.is_default || raw.isDefault),
    status: raw.status === 'archived' ? 'archived' : 'active',
    version,
    version_note,
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    updated_at: raw.updated_at || raw.updatedAt || new Date().toISOString(),
  };
}

/**
 * Maps form state to strict CardTemplate payload for creation/updating
 */
export function toCardTemplatePayload(form: {
  name?: string;
  template_name?: string;
  module?: string;
  blocks_config: VisualCardBlocksConfig;
  is_default?: boolean;
  change_summary?: string;
  version_note?: string;
  description?: string;
}): CardTemplateCreateDTO {
  return {
    module: form.module || 'monitoring_inc',
    template_name: (form.template_name || form.name || '').trim(),
    blocks_config: form.blocks_config,
    is_default: Boolean(form.is_default),
    version_note: (form.version_note || form.change_summary || form.description || 'Pembaruan template').trim(),
  };
}

// ============================================================================
// 2. FEISHU GROUP DTOs & MAPPERS
// ============================================================================

export interface NormalizedFeishuGroup {
  id: string;
  chatId: string;
  chat_id: string;
  name: string;
  group_name: string;
  avatar?: string | null;
  memberCount: number;
  member_count: number;
  isDefault: boolean;
  is_default: boolean;
  status: 'active' | 'disconnected';
  lastSync: string;
  last_sync: string;
  lastSend?: string | null;
  last_send?: string | null;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
}

/**
 * Normalizes group data from any shape (database record or Feishu API)
 */
export function normalizeFeishuGroup(raw: any): NormalizedFeishuGroup {
  const chatId = raw.chat_id || raw.chatId || raw.id || '';
  const name = raw.group_name || raw.name || 'Grup Feishu';
  const memberCount = Number(raw.member_count ?? raw.memberCount ?? 0);
  const isDefault = Boolean(raw.is_default ?? raw.isDefault ?? false);
  const status = (raw.status === 'active' || raw.status === 'disconnected') ? raw.status : 'active';
  const nowIso = new Date().toISOString();
  const lastSync = raw.last_sync || raw.lastSync || nowIso;
  const lastSend = raw.last_send || raw.lastSend || null;
  const createdAt = raw.created_at || raw.createdAt || nowIso;
  const updatedAt = raw.updated_at || raw.updatedAt || nowIso;

  return {
    id: raw.id || chatId,
    chatId,
    chat_id: chatId,
    name,
    group_name: name,
    avatar: raw.avatar || null,
    memberCount,
    member_count: memberCount,
    isDefault,
    is_default: isDefault,
    status,
    lastSync,
    last_sync: lastSync,
    lastSend,
    last_send: lastSend,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt,
  };
}

// ============================================================================
// 3. MENTION MAPPING DTOs & MAPPERS
// ============================================================================

export interface MentionDTO {
  id: string;
  scope_type: 'kecamatan' | 'kabupaten' | 'provinsi' | 'global';
  scope_key: string;
  pic_name: string;
  role?: string;
  feishu_open_id?: string;
  feishu_user_id?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function toMentionDTO(raw: any): MentionDTO {
  return {
    id: raw.id || '',
    scope_type: raw.scope_type || 'kecamatan',
    scope_key: (raw.scope_key || '').toUpperCase().trim(),
    pic_name: (raw.pic_name || raw.name || '').trim(),
    role: raw.role || 'Admin DP',
    feishu_open_id: raw.feishu_open_id || '',
    feishu_user_id: raw.feishu_user_id || '',
    phone: raw.phone || '',
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}
