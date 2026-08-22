import { db } from './client';

export type WhatsappContact = {
  id: string;
  sprinter_id: string;
  name: string;
  phone_number: string;
  drop_point_id: string;
  is_active: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type WhatsappTemplate = {
  id: string;
  name: string;
  content: string;
  status: 'active' | 'inactive';
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WhatsappBatch = {
  id: string;
  module: string;
  monitoring_reference: string;
  template_id: string;
  filter_operator: string;
  threshold: number;
  target_count: number;
  submitted_count: number;
  status: 'draft' | 'reviewed' | 'sending' | 'submitted' | 'partial' | 'completed' | 'failed';
  bablast_blast_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WhatsappLog = {
  id: string;
  batch_id: string;
  sprinter_id: string;
  phone_number: string;
  rendered_message: string;
  bablast_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
};

export async function getWhatsappContacts(dropPointIds?: string[], activeOnly: boolean = false): Promise<WhatsappContact[]> {
  const supabase = db();
  let query = supabase.from('whatsapp_contacts').select('*');
  
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  
  if (dropPointIds && dropPointIds.length > 0) {
    query = query.in('drop_point_id', dropPointIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertWhatsappContact(contact: Partial<WhatsappContact> & { sprinter_id: string }): Promise<WhatsappContact> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_contacts')
    .upsert({ ...contact, updated_at: new Date().toISOString() }, { onConflict: 'sprinter_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveTemplate(): Promise<WhatsappTemplate | null> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_message_templates')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
  return data;
}

export async function createTemplate(template: Omit<WhatsappTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<WhatsappTemplate> {
  const supabase = db();
  
  // set others to inactive
  await supabase.from('whatsapp_message_templates').update({ status: 'inactive' }).neq('status', 'placeholder_force_all'); 
  
  const { data, error } = await supabase
    .from('whatsapp_message_templates')
    .insert(template)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createSendBatch(batch: Partial<WhatsappBatch>): Promise<WhatsappBatch> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_send_batches')
    .insert(batch)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createSendLogs(logs: Partial<WhatsappLog>[]): Promise<WhatsappLog[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_send_logs')
    .insert(logs)
    .select();
  if (error) throw error;
  return data;
}

export async function updateBatch(id: string, updates: Partial<WhatsappBatch>): Promise<WhatsappBatch> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_send_batches')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRecentBatches(): Promise<WhatsappBatch[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_send_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function getBatchLogs(batchId: string): Promise<WhatsappLog[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from('whatsapp_send_logs')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
