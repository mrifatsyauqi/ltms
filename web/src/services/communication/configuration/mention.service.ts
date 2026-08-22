import {
  listMentionMappings,
  getMentionMappingById,
  createMentionMapping,
  updateMentionMapping,
  deleteMentionMapping,
  batchLookupMentions,
  type MentionMappingRecord,
  type MentionScopeType,
  type CreateMentionMappingInput,
  type UpdateMentionMappingInput,
} from '@/lib/data/supabase/mention-mapping';
import { memoryCache } from '../utils/cache';

export class MentionService {
  private cacheKey(suffix: string): string {
    return `mention_map_${suffix}`;
  }

  public async listMappings(options?: {
    scope_type?: MentionScopeType;
    search?: string;
    is_active?: boolean;
  }): Promise<MentionMappingRecord[]> {
    const key = this.cacheKey(
      `list_${options?.scope_type || 'all'}_${options?.is_active ?? 'all'}_${options?.search || ''}`
    );
    const cached = memoryCache.get<MentionMappingRecord[]>(key);
    if (cached) return cached;

    const list = await listMentionMappings(options);
    memoryCache.set(key, list, 30 * 1000); // 30 detik
    return list;
  }

  public async getById(id: string): Promise<MentionMappingRecord | null> {
    const key = this.cacheKey(`id_${id}`);
    const cached = memoryCache.get<MentionMappingRecord>(key);
    if (cached) return cached;

    const mapping = await getMentionMappingById(id);
    if (mapping) {
      memoryCache.set(key, mapping, 30 * 1000);
    }
    return mapping;
  }

  public async create(input: CreateMentionMappingInput): Promise<MentionMappingRecord> {
    const created = await createMentionMapping(input);
    memoryCache.clear();
    return created;
  }

  public async update(id: string, input: UpdateMentionMappingInput): Promise<MentionMappingRecord | null> {
    const updated = await updateMentionMapping(id, input);
    memoryCache.clear();
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    const ok = await deleteMentionMapping(id);
    memoryCache.clear();
    return ok;
  }

  /**
   * Mengambil mapping mention untuk beberapa key (Kecamatan atau Kurir) secara batch
   * Digunakan langsung oleh CardCompilerService saat mengompilasi kartu penugasan
   */
  public async getMentionsByKeys(
    scopeType: MentionScopeType,
    keys: string[]
  ): Promise<Map<string, MentionMappingRecord[]>> {
    return await batchLookupMentions(scopeType, keys);
  }

  /**
   * Helper untuk merender tag mention Feishu Lark Markdown
   * Jika Open ID ada -> `<at id="ou_xxxxx">Nama</at>`
   * Jika tidak ada -> `@Nama`
   */
  public formatFeishuMentionTag(picName: string, openId?: string | null): string {
    if (openId && openId.trim()) {
      return `<at id="${openId.trim()}">${picName.trim()}</at>`;
    }
    return `@${picName.trim()}`;
  }
}

export const mentionService = new MentionService();
