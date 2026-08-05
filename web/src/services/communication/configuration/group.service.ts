import {
  listFeishuGroupsWithConfig,
  setDefaultFeishuGroup,
  toggleFeishuGroupStatus,
  recordGroupSendTimestamp,
  type FeishuGroupConfigRecord,
} from '@/lib/data/supabase/communication-config';
import { feishuChatService } from '../providers/feishu/chat.service';
import { memoryCache } from '../utils/cache';

export class GroupConfigurationService {
  private cacheKey = 'feishu_groups_config_list';

  public async listGroups(): Promise<FeishuGroupConfigRecord[]> {
    const cached = memoryCache.get<FeishuGroupConfigRecord[]>(this.cacheKey);
    if (cached) return cached;

    const list = await listFeishuGroupsWithConfig();
    memoryCache.set(this.cacheKey, list, 30 * 1000); // 30 detik
    return list;
  }

  public async syncFromFeishu(): Promise<FeishuGroupConfigRecord[]> {
    memoryCache.delete(this.cacheKey);
    await feishuChatService.syncChats();
    return this.listGroups();
  }

  public async setDefault(chatId: string): Promise<boolean> {
    memoryCache.delete(this.cacheKey);
    return setDefaultFeishuGroup(chatId);
  }

  public async toggleStatus(chatId: string, status: 'active' | 'disconnected'): Promise<boolean> {
    memoryCache.delete(this.cacheKey);
    return toggleFeishuGroupStatus(chatId, status);
  }

  public async recordSend(chatId: string): Promise<void> {
    memoryCache.delete(this.cacheKey);
    await recordGroupSendTimestamp(chatId);
  }

  public async getDefaultGroup(): Promise<FeishuGroupConfigRecord | null> {
    const list = await this.listGroups();
    const defaultGroup = list.find((g) => g.is_default && g.status === 'active');
    if (defaultGroup) return defaultGroup;
    return list.find((g) => g.status === 'active') || list[0] || null;
  }
}

export const groupService = new GroupConfigurationService();
