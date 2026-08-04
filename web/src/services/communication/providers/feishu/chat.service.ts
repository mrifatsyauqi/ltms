import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import {
  listFeishuGroups,
  upsertFeishuGroups,
} from '@/lib/data/supabase/communication';
import type {
  FeishuChatListResponse,
  FeishuGroup,
} from '../../communication.types';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuChatService {
  /**
   * Mengambil daftar group Feishu dari database lokal Supabase.
   */
  public async getGroups(): Promise<FeishuGroup[]> {
    const dbGroups = await listFeishuGroups();
    return dbGroups.map((g) => ({
      id: g.id,
      chatId: g.chat_id,
      groupName: g.group_name,
      avatar: g.avatar,
      memberCount: g.member_count || 0,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }));
  }

  /**
   * Menyinkronkan seluruh daftar Group dari Feishu Open Platform ke database Supabase.
   */
  public async syncChats(): Promise<FeishuGroup[]> {
    // 1. Ambil Token
    const token = await feishuAuthService.getTenantAccessToken();

    // 2. Fetch seluruh Group yang diikuti oleh bot (dengan pagination jika ada)
    const items = await withRetry(async () => {
      const response = await fetch(`${FEISHU_API_BASE}/im/v1/chats?page_size=100`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });

      if (!response.ok) {
        throw new Error(`Feishu Get Chats HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result: FeishuChatListResponse = await response.json();

      if (result.code !== 0) {
        throw new Error(`Feishu Get Chats Error [${result.code}]: ${result.msg}`);
      }

      return result.data?.items || [];
    }, { maxAttempts: 3, initialDelayMs: 500 });

    // 3. Transform & Upsert ke Supabase
    if (items.length > 0) {
      const groupsToUpsert = items.map((item) => ({
        chat_id: item.chat_id,
        group_name: item.name || 'Grup Tanpa Nama',
        avatar: item.avatar || null,
        member_count: Number(item.user_count) || 0,
      }));

      await upsertFeishuGroups(groupsToUpsert);
    }

    // 4. Kembalikan data terbaru dari DB
    return this.getGroups();
  }
}

export const feishuChatService = new FeishuChatService();
