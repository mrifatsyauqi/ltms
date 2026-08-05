import { db } from './client';

export type TemplateStatus = 'active' | 'archived';

export interface MessageTemplateRecord {
  id: string;
  module: string;
  template_name: string;
  content: string;
  is_default: boolean;
  status: TemplateStatus;
  version: string;
  version_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateVersionRecord {
  id: string;
  template_id: string;
  version: string;
  content: string;
  note?: string | null;
  created_at: string;
}

export interface CardTemplateRecord {
  id: string;
  module: string;
  template_name: string;
  blocks_config: Record<string, any>;
  json_template: Record<string, any>;
  is_default: boolean;
  status: TemplateStatus;
  version: string;
  version_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardTemplateVersionRecord {
  id: string;
  card_template_id: string;
  version: string;
  blocks_config: Record<string, any>;
  note?: string | null;
  created_at: string;
}

export interface FeishuGroupConfigRecord {
  id: string;
  chat_id: string;
  group_name: string;
  avatar?: string | null;
  member_count: number;
  is_default: boolean;
  status: 'active' | 'disconnected';
  last_sync: string;
  last_send?: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// MESSAGE TEMPLATES
// ==========================================

export async function listMessageTemplates(options?: {
  module?: string;
  status?: TemplateStatus;
}): Promise<MessageTemplateRecord[]> {
  try {
    const supabase = db();
    let query = supabase
      .from('message_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (options?.module && options.module !== 'all') {
      query = query.eq('module', options.module);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error listing message_templates:', error);
      return [];
    }
    return (data || []) as MessageTemplateRecord[];
  } catch (err) {
    console.error('Database error listing message templates:', err);
    return [];
  }
}

export async function getMessageTemplateById(id: string): Promise<MessageTemplateRecord | null> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as MessageTemplateRecord;
  } catch {
    return null;
  }
}

export async function getDefaultMessageTemplate(module: string): Promise<MessageTemplateRecord | null> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('module', module)
      .eq('status', 'active')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Fallback: ambil template active pertama
      const { data: firstActive } = await supabase
        .from('message_templates')
        .select('*')
        .eq('module', module)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (firstActive as MessageTemplateRecord) || null;
    }
    return data as MessageTemplateRecord;
  } catch {
    return null;
  }
}

export async function createMessageTemplate(input: {
  module: string;
  template_name: string;
  content: string;
  is_default?: boolean;
  version_note?: string;
}): Promise<MessageTemplateRecord> {
  const supabase = db();
  const now = new Date().toISOString();

  if (input.is_default) {
    await supabase
      .from('message_templates')
      .update({ is_default: false })
      .eq('module', input.module);
  }

  const { data, error } = await supabase
    .from('message_templates')
    .insert([
      {
        module: input.module,
        template_name: input.template_name,
        content: input.content,
        is_default: Boolean(input.is_default),
        status: 'active',
        version: 'v1.0',
        version_note: input.version_note || 'Initial version',
        created_at: now,
        updated_at: now,
      },
    ])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Gagal membuat Message Template: ${error.message}`);
  }

  const created = data as MessageTemplateRecord;

  // Insert version 1.0 history
  await supabase.from('message_template_versions').insert([
    {
      template_id: created.id,
      version: 'v1.0',
      content: input.content,
      note: input.version_note || 'Initial version',
      created_at: now,
    },
  ]);

  return created;
}

export async function updateMessageTemplate(
  id: string,
  input: {
    template_name?: string;
    content?: string;
    is_default?: boolean;
    version_note?: string;
  }
): Promise<MessageTemplateRecord> {
  const supabase = db();
  const current = await getMessageTemplateById(id);
  if (!current) throw new Error('Template tidak ditemukan');

  const now = new Date().toISOString();

  if (input.is_default && !current.is_default) {
    await supabase
      .from('message_templates')
      .update({ is_default: false })
      .eq('module', current.module);
  }

  // Increment version if content changed
  let nextVersion = current.version;
  const isContentChanged = input.content && input.content !== current.content;
  if (isContentChanged) {
    const match = current.version.match(/^v(\d+)\.(\d+)$/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10) + 1;
      nextVersion = `v${major}.${minor}`;
    } else {
      nextVersion = 'v1.1';
    }
  }

  const updatePayload: Record<string, any> = {
    updated_at: now,
  };
  if (input.template_name !== undefined) updatePayload.template_name = input.template_name;
  if (input.content !== undefined) updatePayload.content = input.content;
  if (input.is_default !== undefined) updatePayload.is_default = input.is_default;
  if (isContentChanged) {
    updatePayload.version = nextVersion;
    updatePayload.version_note = input.version_note || 'Pembaruan template';
  }

  const { data, error } = await supabase
    .from('message_templates')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Gagal update template: ${error.message}`);

  const updated = data as MessageTemplateRecord;

  // Catat ke versi jika konten berubah
  if (isContentChanged) {
    await supabase.from('message_template_versions').insert([
      {
        template_id: updated.id,
        version: nextVersion,
        content: input.content!,
        note: input.version_note || 'Pembaruan template',
        created_at: now,
      },
    ]);
  }

  return updated;
}

export async function archiveMessageTemplate(id: string): Promise<boolean> {
  const supabase = db();
  const { error } = await supabase
    .from('message_templates')
    .update({ status: 'archived', is_default: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function restoreMessageTemplate(id: string): Promise<boolean> {
  const supabase = db();
  const { error } = await supabase
    .from('message_templates')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function setDefaultMessageTemplate(id: string): Promise<boolean> {
  const supabase = db();
  const tpl = await getMessageTemplateById(id);
  if (!tpl) return false;

  await supabase
    .from('message_templates')
    .update({ is_default: false })
    .eq('module', tpl.module);

  const { error } = await supabase
    .from('message_templates')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  return !error;
}

export async function listMessageTemplateVersions(
  templateId: string
): Promise<MessageTemplateVersionRecord[]> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('message_template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as MessageTemplateVersionRecord[];
  } catch {
    return [];
  }
}

// ==========================================
// CARD TEMPLATES
// ==========================================

export async function listCardTemplates(options?: {
  module?: string;
  status?: TemplateStatus;
}): Promise<CardTemplateRecord[]> {
  try {
    const supabase = db();
    let query = supabase
      .from('card_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (options?.module && options.module !== 'all') {
      query = query.eq('module', options.module);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error listing card_templates:', error);
      return [];
    }
    return (data || []) as CardTemplateRecord[];
  } catch (err) {
    console.error('Database error listing card templates:', err);
    return [];
  }
}

export async function getCardTemplateById(id: string): Promise<CardTemplateRecord | null> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('card_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as CardTemplateRecord;
  } catch {
    return null;
  }
}

export async function getDefaultCardTemplate(module: string): Promise<CardTemplateRecord | null> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('card_templates')
      .select('*')
      .eq('module', module)
      .eq('status', 'active')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const { data: firstActive } = await supabase
        .from('card_templates')
        .select('*')
        .eq('module', module)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (firstActive as CardTemplateRecord) || null;
    }
    return data as CardTemplateRecord;
  } catch {
    return null;
  }
}

export async function createCardTemplate(input: {
  module: string;
  template_name: string;
  blocks_config: Record<string, any>;
  json_template: Record<string, any>;
  is_default?: boolean;
  version_note?: string;
}): Promise<CardTemplateRecord> {
  const supabase = db();
  const now = new Date().toISOString();

  if (input.is_default) {
    await supabase
      .from('card_templates')
      .update({ is_default: false })
      .eq('module', input.module);
  }

  const { data, error } = await supabase
    .from('card_templates')
    .insert([
      {
        module: input.module,
        template_name: input.template_name,
        blocks_config: input.blocks_config,
        json_template: input.json_template,
        is_default: Boolean(input.is_default),
        status: 'active',
        version: 'v1.0',
        version_note: input.version_note || 'Initial version',
        created_at: now,
        updated_at: now,
      },
    ])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Gagal membuat Card Template: ${error.message}`);
  }

  const created = data as CardTemplateRecord;

  await supabase.from('card_template_versions').insert([
    {
      card_template_id: created.id,
      version: 'v1.0',
      blocks_config: input.blocks_config,
      note: input.version_note || 'Initial version',
      created_at: now,
    },
  ]);

  return created;
}

export async function updateCardTemplate(
  id: string,
  input: {
    template_name?: string;
    blocks_config?: Record<string, any>;
    json_template?: Record<string, any>;
    is_default?: boolean;
    version_note?: string;
  }
): Promise<CardTemplateRecord> {
  const supabase = db();
  const current = await getCardTemplateById(id);
  if (!current) throw new Error('Card template tidak ditemukan');

  const now = new Date().toISOString();

  if (input.is_default && !current.is_default) {
    await supabase
      .from('card_templates')
      .update({ is_default: false })
      .eq('module', current.module);
  }

  let nextVersion = current.version;
  const isBlocksChanged =
    input.blocks_config &&
    JSON.stringify(input.blocks_config) !== JSON.stringify(current.blocks_config);

  if (isBlocksChanged) {
    const match = current.version.match(/^v(\d+)\.(\d+)$/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10) + 1;
      nextVersion = `v${major}.${minor}`;
    } else {
      nextVersion = 'v1.1';
    }
  }

  const updatePayload: Record<string, any> = {
    updated_at: now,
  };
  if (input.template_name !== undefined) updatePayload.template_name = input.template_name;
  if (input.blocks_config !== undefined) updatePayload.blocks_config = input.blocks_config;
  if (input.json_template !== undefined) updatePayload.json_template = input.json_template;
  if (input.is_default !== undefined) updatePayload.is_default = input.is_default;
  if (isBlocksChanged) {
    updatePayload.version = nextVersion;
    updatePayload.version_note = input.version_note || 'Pembaruan tampilan kartu';
  }

  const { data, error } = await supabase
    .from('card_templates')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Gagal update card template: ${error.message}`);

  const updated = data as CardTemplateRecord;

  if (isBlocksChanged) {
    await supabase.from('card_template_versions').insert([
      {
        card_template_id: updated.id,
        version: nextVersion,
        blocks_config: input.blocks_config!,
        note: input.version_note || 'Pembaruan tampilan kartu',
        created_at: now,
      },
    ]);
  }

  return updated;
}

export async function archiveCardTemplate(id: string): Promise<boolean> {
  const supabase = db();
  const { error } = await supabase
    .from('card_templates')
    .update({ status: 'archived', is_default: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function restoreCardTemplate(id: string): Promise<boolean> {
  const supabase = db();
  const { error } = await supabase
    .from('card_templates')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function setDefaultCardTemplate(id: string): Promise<boolean> {
  const supabase = db();
  const tpl = await getCardTemplateById(id);
  if (!tpl) return false;

  await supabase
    .from('card_templates')
    .update({ is_default: false })
    .eq('module', tpl.module);

  const { error } = await supabase
    .from('card_templates')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  return !error;
}

export async function listCardTemplateVersions(
  cardTemplateId: string
): Promise<CardTemplateVersionRecord[]> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('card_template_versions')
      .select('*')
      .eq('card_template_id', cardTemplateId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as CardTemplateVersionRecord[];
  } catch {
    return [];
  }
}

// ==========================================
// FEISHU GROUPS CONFIGURATION
// ==========================================

export async function listFeishuGroupsWithConfig(): Promise<FeishuGroupConfigRecord[]> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('feishu_groups')
      .select('*')
      .order('is_default', { ascending: false })
      .order('group_name', { ascending: true });

    if (error) {
      console.error('Error fetching feishu_groups config:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      chat_id: row.chat_id,
      group_name: row.group_name,
      avatar: row.avatar,
      member_count: row.member_count || 0,
      is_default: Boolean(row.is_default),
      status: (row.status as 'active' | 'disconnected') || 'active',
      last_sync: row.last_sync || row.updated_at || row.created_at,
      last_send: row.last_send || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (err) {
    console.error('Database error listing feishu groups config:', err);
    return [];
  }
}

export async function setDefaultFeishuGroup(chatId: string): Promise<boolean> {
  try {
    const supabase = db();
    // 1. Reset all to false
    await supabase
      .from('feishu_groups')
      .update({ is_default: false });

    // 2. Set this one to true
    const { error } = await supabase
      .from('feishu_groups')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('chat_id', chatId);

    return !error;
  } catch {
    return false;
  }
}

export async function toggleFeishuGroupStatus(chatId: string, status: 'active' | 'disconnected'): Promise<boolean> {
  try {
    const supabase = db();
    const { error } = await supabase
      .from('feishu_groups')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('chat_id', chatId);
    return !error;
  } catch {
    return false;
  }
}

export async function recordGroupSendTimestamp(chatId: string): Promise<void> {
  try {
    const supabase = db();
    await supabase
      .from('feishu_groups')
      .update({ last_send: new Date().toISOString() })
      .eq('chat_id', chatId);
  } catch (err) {
    console.error('Failed to record group last_send timestamp:', err);
  }
}
