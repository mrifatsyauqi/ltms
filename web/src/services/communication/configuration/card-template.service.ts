import {
  listCardTemplates,
  getCardTemplateById,
  getDefaultCardTemplate,
  createCardTemplate,
  updateCardTemplate,
  archiveCardTemplate,
  restoreCardTemplate,
  setDefaultCardTemplate,
  listCardTemplateVersions,
  getCardTemplateVersionById,
  type CardTemplateRecord,
  type CardTemplateVersionRecord,
  type TemplateStatus,
} from '@/lib/data/supabase/communication-config';
import { memoryCache } from '../utils/cache';
import { STARTER_PRESETS } from './template-presets';
import type { VisualCardBlocksConfig } from './template.types';

export class CardTemplateService {
  private cacheKey(suffix: string): string {
    return `card_template_${suffix}`;
  }

  public async listTemplates(options?: {
    module?: string;
    status?: TemplateStatus;
  }): Promise<CardTemplateRecord[]> {
    const key = this.cacheKey(`list_${options?.module || 'all'}_${options?.status || 'all'}`);
    const cached = memoryCache.get<CardTemplateRecord[]>(key);
    if (cached) return cached;

    const list = await listCardTemplates(options);

    // Auto seed from presets if empty
    if (list.length === 0 && (!options?.status || options.status === 'active')) {
      const preset = STARTER_PRESETS.find((p) => p.module === options?.module);
      if (preset) {
        try {
          const created = await createCardTemplate({
            module: preset.module,
            template_name: `Kartu ${preset.name}`,
            blocks_config: preset.blocksConfig,
            is_default: true,
            version_note: 'Auto-seeded from preset',
          });
          list.push(created);
        } catch {
          // ignore
        }
      }
    }

    memoryCache.set(key, list, 60 * 1000);
    return list;
  }

  public async getById(id: string): Promise<CardTemplateRecord | null> {
    const key = this.cacheKey(`id_${id}`);
    const cached = memoryCache.get<CardTemplateRecord>(key);
    if (cached) return cached;

    const tpl = await getCardTemplateById(id);
    if (tpl) {
      memoryCache.set(key, tpl, 60 * 1000);
    }
    return tpl;
  }

  public async getDefault(module: string): Promise<CardTemplateRecord | null> {
    const key = this.cacheKey(`default_${module}`);
    const cached = memoryCache.get<CardTemplateRecord>(key);
    if (cached) return cached;

    let tpl = await getDefaultCardTemplate(module);

    if (!tpl) {
      const preset = STARTER_PRESETS.find((p) => p.module === module) || STARTER_PRESETS[0];
      try {
        tpl = await createCardTemplate({
          module: preset.module,
          template_name: `Kartu ${preset.name}`,
          blocks_config: preset.blocksConfig,
          is_default: true,
          version_note: 'Initial default card preset',
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

  public async createFromBlocks(input: {
    module: string;
    template_name: string;
    blocks_config: VisualCardBlocksConfig;
    is_default?: boolean;
    version_note?: string;
  }): Promise<CardTemplateRecord> {
    const result = await createCardTemplate({
      module: input.module,
      template_name: input.template_name,
      blocks_config: input.blocks_config,
      is_default: input.is_default,
      version_note: input.version_note,
    });

    memoryCache.clear();
    return result;
  }

  public async updateFromBlocks(
    id: string,
    input: {
      template_name?: string;
      blocks_config?: VisualCardBlocksConfig;
      is_default?: boolean;
      version_note?: string;
    }
  ): Promise<CardTemplateRecord> {
    const result = await updateCardTemplate(id, {
      template_name: input.template_name,
      blocks_config: input.blocks_config,
      is_default: input.is_default,
      version_note: input.version_note,
    });

    memoryCache.clear();
    return result;
  }

  public async archive(id: string): Promise<boolean> {
    const success = await archiveCardTemplate(id);
    if (success) memoryCache.clear();
    return success;
  }

  public async restore(id: string): Promise<boolean> {
    const success = await restoreCardTemplate(id);
    if (success) memoryCache.clear();
    return success;
  }

  public async setDefault(id: string): Promise<boolean> {
    const success = await setDefaultCardTemplate(id);
    if (success) memoryCache.clear();
    return success;
  }

  public async duplicate(id: string): Promise<CardTemplateRecord> {
    const original = await this.getById(id);
    if (!original) throw new Error('Card template tidak ditemukan');

    const copy = await this.createFromBlocks({
      module: original.module,
      template_name: `${original.template_name} (Salinan)`,
      blocks_config: original.blocks_config as VisualCardBlocksConfig,
      is_default: false,
      version_note: `Duplikasi dari ${original.template_name} (${original.version})`,
    });

    return copy;
  }

  public async getVersions(cardTemplateId: string): Promise<CardTemplateVersionRecord[]> {
    return listCardTemplateVersions(cardTemplateId);
  }

  /** Kembalikan blocks_config template ke isi versi lama - dicatat sbg versi
   *  BARU (bukan menghapus riwayat), konsisten dgn semantik updateFromBlocks
   *  yang lain (setiap perubahan blocks_config = versi baru). */
  public async rollbackToVersion(
    cardTemplateId: string,
    versionId: string
  ): Promise<CardTemplateRecord> {
    const version = await getCardTemplateVersionById(versionId);
    if (!version || version.card_template_id !== cardTemplateId) {
      throw new Error('Versi template tidak ditemukan');
    }
    return this.updateFromBlocks(cardTemplateId, {
      blocks_config: version.blocks_config as VisualCardBlocksConfig,
      version_note: `Rollback ke v${version.version}`,
    });
  }
}

export const cardTemplateService = new CardTemplateService();
