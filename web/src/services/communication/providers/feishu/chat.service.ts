import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuChatListResponseSchema } from '../../communication.schemas';
import {
  listFeishuGroups,
  upsertFeishuGroups,
} from '@/lib/data/supabase/communication';
import type {
  FeishuGroup,
} from '../../communication.types';

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
   * Menyinkronkan seluruh daftar Group dari Feishu Open Platform ke database Supabase
   * Menggunakan pagination loop lengkap (page_token) sesuai dokumentasi resmi IM v1.
   */
  public async syncChats(): Promise<FeishuGroup[]> {
    const { baseUrl } = getFeishuCredentials();

    // 1. Ambil Token
    const token = await feishuAuthService.getTenantAccessToken();

    const allItems: Array<{
      chat_id: string;
      name?: string | null;
      avatar?: string | null;
      user_count?: string | number | null;
    }> = [];

    let hasMore = true;
    let pageToken: string | undefined = undefined;

    // 2. Loop pagination hingga seluruh grup terambil
    while (hasMore) {
      const currentToken = pageToken;
      const url = new URL(`${baseUrl}/im/v1/chats`);
      url.searchParams.set('page_size', '100');
      if (currentToken) {
        url.searchParams.set('page_token', currentToken);
      }

      const pageResult = await withRetry(
        async () => {
          const response = await fetchWithTimeout(url.toString(), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            timeoutMs: COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS,
          });

          if (!response.ok) {
            throw new Error(`Feishu Get Chats HTTP Error: ${response.status} ${response.statusText}`);
          }

          const rawJson = await response.json();
          const parsed = FeishuChatListResponseSchema.safeParse(rawJson);

          if (!parsed.success) {
            throw new Error(`Feishu Chat List Schema Mismatch: ${parsed.error.message}`);
          }

          const result = parsed.data;

          if (result.code !== 0) {
            throw new Error(`Feishu Get Chats Error [Code ${result.code}]: ${result.msg || 'Gagal memuat grup'}`);
          }

          return result.data;
        },
        { maxAttempts: 3, initialDelayMs: 500 }
      );

      if (pageResult?.items && pageResult.items.length > 0) {
        allItems.push(...pageResult.items);
      }

      hasMore = Boolean(pageResult?.has_more && pageResult?.page_token);
      pageToken = pageResult?.page_token;
    }

    // 3. Transform & Upsert ke Supabase
    if (allItems.length > 0) {
      const groupsToUpsert = allItems.map((item) => ({
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
