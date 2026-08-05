import { CardCompilerService } from './card-compiler.service';
import { cardTemplateService } from './card-template.service';
import { mentionService } from './mention.service';
import { STARTER_PRESETS } from './template-presets';
import type { VisualCardBlocksConfig } from './template.types';
import type { MentionMappingRecord } from '@/lib/data/supabase/mention-mapping';

export interface CardRenderRequest {
  module: string;
  cardConfig?: VisualCardBlocksConfig;
  cardTemplateId?: string;
  data?: Record<string, any>;
  imageKey?: string | null;
  appBaseUrl?: string;
}

export interface CardRenderResult {
  cardJson: Record<string, any>;
  blocksConfig: VisualCardBlocksConfig;
}

/**
 * Single render pipeline shared by Card Builder Preview, Share Dialog Preview,
 * the real Feishu send path, and History Preview. Resolving blocksConfig and
 * mention mappings here (instead of duplicating this logic per caller) guarantees
 * that Preview and Send can never disagree about which template/mentions render
 * for a given request.
 */
export class CardRenderPipeline {
  public static async resolveBlocksConfig(
    moduleName: string,
    cardConfig?: VisualCardBlocksConfig,
    cardTemplateId?: string
  ): Promise<VisualCardBlocksConfig> {
    if (cardConfig) return cardConfig;

    if (cardTemplateId) {
      const tpl = await cardTemplateService.getById(cardTemplateId);
      if (tpl?.blocks_config) return tpl.blocks_config as VisualCardBlocksConfig;
    }

    try {
      const defaultTpl = await cardTemplateService.getDefault(moduleName);
      if (defaultTpl?.blocks_config) return defaultTpl.blocks_config as VisualCardBlocksConfig;
    } catch {
      // fall through to starter preset
    }

    const preset = STARTER_PRESETS.find((p) => p.module === moduleName) || STARTER_PRESETS[0];
    return preset.blocksConfig;
  }

  public static async resolveMentionMap(
    moduleName: string,
    data?: Record<string, any>
  ): Promise<Map<string, MentionMappingRecord[]>> {
    let mentionMap: Map<string, MentionMappingRecord[]> = new Map();
    try {
      if (moduleName === 'monitoring_inc') {
        const subdistrictKeys: string[] = [];
        if (Array.isArray(data?.subdistricts)) {
          data!.subdistricts.forEach((s: any) => {
            if (typeof s === 'object' && s.name) subdistrictKeys.push(s.name);
          });
        } else if (data?.destination_subdistricts) {
          const lines = String(data.destination_subdistricts).split('\n');
          lines.forEach((l) => {
            const m = l.match(/^([^:\(\d]+)/);
            if (m) subdistrictKeys.push(m[1].trim().replace(/^📍\s*/, ''));
          });
        }
        if (subdistrictKeys.length > 0) {
          mentionMap = await mentionService.getMentionsByKeys('kecamatan', subdistrictKeys);
        }
      } else if (moduleName === 'monitoring_delivery') {
        const kurirKeys: string[] = [];
        if (Array.isArray(data?.kurirList)) {
          data!.kurirList.forEach((k: any) => {
            if (typeof k === 'object' && k.name) kurirKeys.push(k.name);
          });
        }
        if (kurirKeys.length > 0) {
          mentionMap = await mentionService.getMentionsByKeys('kurir', kurirKeys);
        }
      }
    } catch {
      // Non-blocking fallback if mention database lookup fails
    }
    return mentionMap;
  }

  public static async compile(req: CardRenderRequest): Promise<CardRenderResult> {
    const blocksConfig = await this.resolveBlocksConfig(req.module, req.cardConfig, req.cardTemplateId);
    const mentionMap = await this.resolveMentionMap(req.module, req.data);
    const cardJson = CardCompilerService.compileCard(
      blocksConfig,
      req.data || {},
      req.imageKey ?? undefined,
      mentionMap,
      req.appBaseUrl
    );
    return { cardJson, blocksConfig };
  }
}
