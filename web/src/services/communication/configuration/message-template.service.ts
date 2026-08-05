import {
  listMessageTemplates,
  getMessageTemplateById,
  getDefaultMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  archiveMessageTemplate,
  restoreMessageTemplate,
  setDefaultMessageTemplate,
  listMessageTemplateVersions,
  type MessageTemplateRecord,
  type MessageTemplateVersionRecord,
  type TemplateStatus,
} from '@/lib/data/supabase/communication-config';
import { memoryCache } from '../utils/cache';
import { STARTER_PRESETS } from './template-presets';

export class MessageTemplateService {
  private cacheKey(suffix: string): string {
    return `msg_template_${suffix}`;
  }

  public async listTemplates(options?: {
    module?: string;
    status?: TemplateStatus;
  }): Promise<MessageTemplateRecord[]> {
    const key = this.cacheKey(`list_${options?.module || 'all'}_${options?.status || 'all'}`);
    const cached = memoryCache.get<MessageTemplateRecord[]>(key);
    if (cached) return cached;

    const list = await listMessageTemplates(options);

    // Jika kosong di database dan modul ada preset-nya, fallback seed dari starter presets
    if (list.length === 0 && (!options?.status || options.status === 'active')) {
      const preset = STARTER_PRESETS.find((p) => p.module === options?.module);
      if (preset) {
        try {
          const created = await createMessageTemplate({
            module: preset.module,
            template_name: `Standar ${preset.name}`,
            content: preset.messageContent,
            is_default: true,
            version_note: 'Auto-seeded from preset',
          });
          list.push(created);
        } catch {
          // ignore error if race condition
        }
      }
    }

    memoryCache.set(key, list, 60 * 1000); // 1 menit
    return list;
  }

  public async getById(id: string): Promise<MessageTemplateRecord | null> {
    const key = this.cacheKey(`id_${id}`);
    const cached = memoryCache.get<MessageTemplateRecord>(key);
    if (cached) return cached;

    const tpl = await getMessageTemplateById(id);
    if (tpl) {
      memoryCache.set(key, tpl, 60 * 1000);
    }
    return tpl;
  }

  public async getDefault(module: string): Promise<MessageTemplateRecord | null> {
    const key = this.cacheKey(`default_${module}`);
    const cached = memoryCache.get<MessageTemplateRecord>(key);
    if (cached) return cached;

    let tpl = await getDefaultMessageTemplate(module);

    // Fallback: auto-create from preset if none exists
    if (!tpl) {
      const preset = STARTER_PRESETS.find((p) => p.module === module) || STARTER_PRESETS[0];
      try {
        tpl = await createMessageTemplate({
          module: preset.module,
          template_name: `Standar ${preset.name}`,
          content: preset.messageContent,
          is_default: true,
          version_note: 'Initial default preset',
        });
      } catch {
        // ignore
      }
    }

    if (tpl) {
      memoryCache.set(key, tpl, 60 * 1000);
    }
    return tpl;
  }

  public async create(input: {
    module: string;
    template_name: string;
    content: string;
    is_default?: boolean;
    version_note?: string;
  }): Promise<MessageTemplateRecord> {
    const result = await createMessageTemplate(input);
    memoryCache.clear();
    return result;
  }

  public async update(
    id: string,
    input: {
      template_name?: string;
      content?: string;
      is_default?: boolean;
      version_note?: string;
    }
  ): Promise<MessageTemplateRecord> {
    const result = await updateMessageTemplate(id, input);
    memoryCache.clear();
    return result;
  }

  public async archive(id: string): Promise<boolean> {
    const success = await archiveMessageTemplate(id);
    if (success) memoryCache.clear();
    return success;
  }

  public async restore(id: string): Promise<boolean> {
    const success = await restoreMessageTemplate(id);
    if (success) memoryCache.clear();
    return success;
  }

  public async setDefault(id: string): Promise<boolean> {
    const success = await setDefaultMessageTemplate(id);
    if (success) memoryCache.clear();
    return success;
  }

  public async duplicate(id: string): Promise<MessageTemplateRecord> {
    const original = await this.getById(id);
    if (!original) throw new Error('Template asli tidak ditemukan');

    const copy = await this.create({
      module: original.module,
      template_name: `${original.template_name} (Salinan)`,
      content: original.content,
      is_default: false,
      version_note: `Duplikasi dari ${original.template_name} (${original.version})`,
    });

    return copy;
  }

  public async getVersions(templateId: string): Promise<MessageTemplateVersionRecord[]> {
    return listMessageTemplateVersions(templateId);
  }
}

export const messageTemplateService = new MessageTemplateService();
