import { db } from './client';

export interface FeishuGroupRecord {
  id: string;
  chat_id: string;
  group_name: string;
  avatar?: string | null;
  member_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLogRecord {
  id: string;
  channel: string;
  chat_id: string;
  message_type: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string | null;
  response_time_ms?: number | null;
  sender_email?: string | null;
  payload_summary?: Record<string, any> | null;
  card_json?: Record<string, any> | null;
  created_at: string;
}

export interface FeishuGroupUpsertInput {
  chat_id: string;
  group_name: string;
  avatar?: string | null;
  member_count?: number | null;
}

export interface CommunicationLogInsertInput {
  channel: string;
  chat_id: string;
  message_type: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string | null;
  response_time_ms?: number | null;
  sender_email?: string | null;
  payload_summary?: Record<string, any> | null;
  card_json?: Record<string, any> | null;
}

/**
 * Mengambil seluruh data group Feishu yang tersimpan di database Supabase.
 */
export async function listFeishuGroups(): Promise<FeishuGroupRecord[]> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('feishu_groups')
      .select('*')
      .order('group_name', { ascending: true });

    if (error) {
      console.error('Error fetching feishu_groups:', error);
      return [];
    }

    return (data || []) as FeishuGroupRecord[];
  } catch (err) {
    console.error('Database error listing feishu groups:', err);
    return [];
  }
}

/**
 * Menyimpan / memperbarui daftar group Feishu secara massal (upsert on chat_id).
 */
export async function upsertFeishuGroups(
  groups: FeishuGroupUpsertInput[]
): Promise<FeishuGroupRecord[]> {
  if (!groups || groups.length === 0) return [];

  try {
    const supabase = db();
    const records = groups.map((g) => ({
      chat_id: g.chat_id,
      group_name: g.group_name,
      avatar: g.avatar || null,
      member_count: g.member_count || 0,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('feishu_groups')
      .upsert(records, { onConflict: 'chat_id' })
      .select('*');

    if (error) {
      console.error('Error upserting feishu_groups:', error);
      throw new Error(`Failed to upsert Feishu groups: ${error.message}`);
    }

    return (data || []) as FeishuGroupRecord[];
  } catch (err) {
    console.error('Database error upserting feishu groups:', err);
    throw err;
  }
}

/**
 * Mencatat log aktivitas komunikasi ke tabel communication_logs.
 */
export async function insertCommunicationLog(
  log: CommunicationLogInsertInput
): Promise<CommunicationLogRecord | null> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('communication_logs')
      .insert([
        {
          channel: log.channel || 'feishu',
          chat_id: log.chat_id,
          message_type: log.message_type,
          status: log.status,
          error_message: log.error_message || null,
          response_time_ms: log.response_time_ms || 0,
          sender_email: log.sender_email || null,
          payload_summary: log.payload_summary || null,
          card_json: log.card_json || null,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error inserting communication log:', error);
      return null;
    }

    return data as CommunicationLogRecord;
  } catch (err) {
    console.error('Database error inserting communication log:', err);
    return null;
  }
}

/**
 * Mengambil daftar riwayat communication logs terbaru.
 */
export async function listCommunicationLogs(
  limit = 50
): Promise<CommunicationLogRecord[]> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching communication_logs:', error);
      return [];
    }

    return (data || []) as CommunicationLogRecord[];
  } catch (err) {
    console.error('Database error listing communication logs:', err);
    return [];
  }
}

// ==========================================
// WhatsApp Sender Connections
// ==========================================

export interface WhatsappSenderConnectionRecord {
  id: string;
  sender_id: string;
  phone?: string | null;
  display_name?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  last_seen: string;
}

export interface WhatsappSenderUpsertInput {
  sender_id: string;
  phone?: string | null;
  display_name?: string | null;
  status?: string;
}

export async function listWhatsappSenders(): Promise<WhatsappSenderConnectionRecord[]> {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('whatsapp_sender_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching whatsapp_sender_connections:', error);
      return [];
    }

    return (data || []) as WhatsappSenderConnectionRecord[];
  } catch (err) {
    console.error('Database error listing whatsapp senders:', err);
    return [];
  }
}

export async function upsertWhatsappSenders(
  senders: WhatsappSenderUpsertInput[],
  userId?: string
): Promise<WhatsappSenderConnectionRecord[]> {
  if (!senders || senders.length === 0) return [];

  try {
    const supabase = db();
    const records = senders.map((s) => ({
      sender_id: s.sender_id,
      phone: s.phone || null,
      display_name: s.display_name || null,
      status: s.status || 'disconnected',
      created_by: userId || 'system',
      last_seen: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('whatsapp_sender_connections')
      .upsert(records, { onConflict: 'sender_id' })
      .select('*');

    if (error) {
      console.error('Error upserting whatsapp_sender_connections:', error);
      throw new Error(`Failed to upsert WhatsApp senders: ${error.message}`);
    }

    return (data || []) as WhatsappSenderConnectionRecord[];
  } catch (err) {
    console.error('Database error upserting whatsapp senders:', err);
    throw err;
  }
}

export async function deleteWhatsappSender(id: string): Promise<boolean> {
  try {
    const supabase = db();
    const { error } = await supabase
      .from('whatsapp_sender_connections')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting whatsapp sender:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Database error deleting whatsapp sender:', err);
    return false;
  }
}
