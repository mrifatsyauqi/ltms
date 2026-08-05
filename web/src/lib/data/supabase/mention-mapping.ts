import { db } from './client';
import { ApiError } from '@/lib/errors';

export type MentionScopeType = 'kecamatan' | 'drop_point' | 'kurir';

export interface MentionMappingRecord {
  id: string;
  scope_type: MentionScopeType;
  scope_key: string;
  pic_name: string;
  role: string | null;
  feishu_open_id: string | null;
  feishu_user_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMentionMappingInput {
  scope_type: MentionScopeType;
  scope_key: string;
  pic_name: string;
  role?: string;
  feishu_open_id?: string;
  feishu_user_id?: string;
  phone?: string;
  is_active?: boolean;
}

export interface UpdateMentionMappingInput {
  scope_type?: MentionScopeType;
  scope_key?: string;
  pic_name?: string;
  role?: string;
  feishu_open_id?: string;
  feishu_user_id?: string;
  phone?: string;
  is_active?: boolean;
}

// In-memory fallback dataset jika database belum memiliki tabel atau saat offline
let MEMORY_MENTIONS: MentionMappingRecord[] = [
  {
    id: 'm1',
    scope_type: 'kecamatan',
    scope_key: 'BATANG',
    pic_name: 'Agus Supriyanto',
    role: 'Admin DP Batang',
    feishu_open_id: 'ou_demo_batang_01',
    feishu_user_id: null,
    phone: '081234567890',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm2',
    scope_type: 'kecamatan',
    scope_key: 'WARUNGASEM',
    pic_name: 'Dimas Prasetyo',
    role: 'Admin DP Warungasem',
    feishu_open_id: 'ou_demo_warungasem_01',
    feishu_user_id: null,
    phone: '081234567891',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm3',
    scope_type: 'kecamatan',
    scope_key: 'LIMPUNG',
    pic_name: 'Rian Hidayat',
    role: 'Admin DP Limpung',
    feishu_open_id: 'ou_demo_limpung_01',
    feishu_user_id: null,
    phone: '081234567892',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm4',
    scope_type: 'kecamatan',
    scope_key: 'BANDAR',
    pic_name: 'Arif Munandar',
    role: 'Admin DP Bandar',
    feishu_open_id: 'ou_demo_bandar_01',
    feishu_user_id: null,
    phone: '081234567893',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm5',
    scope_type: 'drop_point',
    scope_key: 'BATANG01',
    pic_name: 'Budi Santoso',
    role: 'SPV Drop Point Batang',
    feishu_open_id: 'ou_demo_spv_batang01',
    feishu_user_id: null,
    phone: '081234567894',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm6',
    scope_type: 'kurir',
    scope_key: 'Andi',
    pic_name: 'Andi Setiawan',
    role: 'Sprinter / Kurir',
    feishu_open_id: 'ou_demo_kurir_andi',
    feishu_user_id: null,
    phone: '081234567895',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm7',
    scope_type: 'kurir',
    scope_key: 'Rudi',
    pic_name: 'Rudi Hermawan',
    role: 'Sprinter / Kurir',
    feishu_open_id: 'ou_demo_kurir_rudi',
    feishu_user_id: null,
    phone: '081234567896',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm8',
    scope_type: 'kurir',
    scope_key: 'Bambang',
    pic_name: 'Bambang Wijaya',
    role: 'Sprinter / Kurir',
    feishu_open_id: 'ou_demo_kurir_bambang',
    feishu_user_id: null,
    phone: '081234567897',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function listMentionMappings(options?: {
  scope_type?: MentionScopeType;
  search?: string;
  is_active?: boolean;
}): Promise<MentionMappingRecord[]> {
  try {
    let query = db().from('communication_mention_mappings').select('*').order('created_at', { ascending: false });

    if (options?.scope_type) {
      query = query.eq('scope_type', options.scope_type);
    }
    if (options?.is_active !== undefined) {
      query = query.eq('is_active', options.is_active);
    }
    if (options?.search) {
      query = query.or(
        `scope_key.ilike.%${options.search}%,pic_name.ilike.%${options.search}%,role.ilike.%${options.search}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      // Fallback ke memory dataset
      let filtered = [...MEMORY_MENTIONS];
      if (options?.scope_type) filtered = filtered.filter((m) => m.scope_type === options.scope_type);
      if (options?.is_active !== undefined) filtered = filtered.filter((m) => m.is_active === options.is_active);
      if (options?.search) {
        const s = options.search.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.scope_key.toLowerCase().includes(s) ||
            m.pic_name.toLowerCase().includes(s) ||
            (m.role && m.role.toLowerCase().includes(s))
        );
      }
      return filtered;
    }

    return (data || []) as MentionMappingRecord[];
  } catch {
    return MEMORY_MENTIONS;
  }
}

export async function getMentionMappingById(id: string): Promise<MentionMappingRecord | null> {
  try {
    const { data, error } = await db()
      .from('communication_mention_mappings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return MEMORY_MENTIONS.find((m) => m.id === id) || null;
    }
    return data as MentionMappingRecord;
  } catch {
    return MEMORY_MENTIONS.find((m) => m.id === id) || null;
  }
}

export async function createMentionMapping(input: CreateMentionMappingInput): Promise<MentionMappingRecord> {
  const row = {
    scope_type: input.scope_type,
    scope_key: input.scope_key.trim(),
    pic_name: input.pic_name.trim(),
    role: input.role?.trim() || 'Admin DP',
    feishu_open_id: input.feishu_open_id?.trim() || null,
    feishu_user_id: input.feishu_user_id?.trim() || null,
    phone: input.phone?.trim() || null,
    is_active: input.is_active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await db()
      .from('communication_mention_mappings')
      .insert([row])
      .select('*')
      .single();

    if (error) {
      const fallbackRecord: MentionMappingRecord = {
        id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...row,
      };
      MEMORY_MENTIONS.unshift(fallbackRecord);
      return fallbackRecord;
    }
    return data as MentionMappingRecord;
  } catch {
    const fallbackRecord: MentionMappingRecord = {
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...row,
    };
    MEMORY_MENTIONS.unshift(fallbackRecord);
    return fallbackRecord;
  }
}

export async function updateMentionMapping(
  id: string,
  input: UpdateMentionMappingInput
): Promise<MentionMappingRecord | null> {
  const updates = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await db()
      .from('communication_mention_mappings')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      const idx = MEMORY_MENTIONS.findIndex((m) => m.id === id);
      if (idx !== -1) {
        MEMORY_MENTIONS[idx] = { ...MEMORY_MENTIONS[idx], ...updates };
        return MEMORY_MENTIONS[idx];
      }
      return null;
    }
    return data as MentionMappingRecord;
  } catch {
    const idx = MEMORY_MENTIONS.findIndex((m) => m.id === id);
    if (idx !== -1) {
      MEMORY_MENTIONS[idx] = { ...MEMORY_MENTIONS[idx], ...updates };
      return MEMORY_MENTIONS[idx];
    }
    return null;
  }
}

export async function deleteMentionMapping(id: string): Promise<boolean> {
  try {
    const { error } = await db()
      .from('communication_mention_mappings')
      .delete()
      .eq('id', id);

    if (error) {
      MEMORY_MENTIONS = MEMORY_MENTIONS.filter((m) => m.id !== id);
      return true;
    }
    return true;
  } catch {
    MEMORY_MENTIONS = MEMORY_MENTIONS.filter((m) => m.id !== id);
    return true;
  }
}

export async function batchLookupMentions(
  scopeType: MentionScopeType,
  keys: string[]
): Promise<Map<string, MentionMappingRecord[]>> {
  const map = new Map<string, MentionMappingRecord[]>();
  if (!keys || keys.length === 0) return map;

  const normalizedKeys = keys.map((k) => k.trim().toUpperCase());

  try {
    const { data, error } = await db()
      .from('communication_mention_mappings')
      .select('*')
      .eq('scope_type', scopeType)
      .eq('is_active', true);

    const list = (!error && data ? data : MEMORY_MENTIONS) as MentionMappingRecord[];

    for (const record of list) {
      if (record.scope_type !== scopeType || !record.is_active) continue;
      const recKey = record.scope_key.trim().toUpperCase();
      if (normalizedKeys.includes(recKey)) {
        const existing = map.get(recKey) || [];
        existing.push(record);
        map.set(recKey, existing);
      }
    }
  } catch {
    for (const record of MEMORY_MENTIONS) {
      if (record.scope_type !== scopeType || !record.is_active) continue;
      const recKey = record.scope_key.trim().toUpperCase();
      if (normalizedKeys.includes(recKey)) {
        const existing = map.get(recKey) || [];
        existing.push(record);
        map.set(recKey, existing);
      }
    }
  }

  return map;
}
