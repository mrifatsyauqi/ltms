import { CardCompilerService } from './card-compiler.service';
import { cardTemplateService } from './card-template.service';
import { mentionService } from './mention.service';
import { STARTER_PRESETS } from './template-presets';
import type { VisualCardBlocksConfig } from './template.types';
import type { MentionMappingRecord } from '@/lib/data/supabase/mention-mapping';
import { findDpByKecamatanBatch } from '@/lib/data/supabase/drop-point-kecamatan';

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
        // Kode DP yang SUDAH di-resolve oleh caller (mis. results-view.tsx,
        // via dp_delivery atau Kecamatan->DP) per key - kalau ada, dipakai
        // LANGSUNG (lihat resolveMonitoringIncMentions) tanpa menebak ulang.
        const keyToKodeDp = new Map<string, string>();
        if (Array.isArray(data?.subdistricts)) {
          data!.subdistricts.forEach((s: any) => {
            if (typeof s === 'object' && s.name) {
              subdistrictKeys.push(s.name);
              if (s.kodeDp) keyToKodeDp.set(String(s.name).trim().toUpperCase(), String(s.kodeDp));
            }
          });
        } else if (data?.destination_subdistricts) {
          const lines = String(data.destination_subdistricts).split('\n');
          lines.forEach((l) => {
            const m = l.match(/^([^:\(\d]+)/);
            if (m) subdistrictKeys.push(m[1].trim().replace(/^📍\s*/, ''));
          });
        }
        if (subdistrictKeys.length > 0) {
          mentionMap = await this.resolveMonitoringIncMentions(subdistrictKeys, keyToKodeDp);
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

  /**
   * Resolusi mention Monitoring INC, dua jalur (urutan prioritas):
   *
   * 1) Kode DP EKSPLISIT dari caller (`keyToKodeDp`, mis. results-view.tsx
   *    yang sudah resolve dp_delivery -> Kode DP sebelum mengirim data ini) -
   *    dipakai LANGSUNG utk lookup scope_type 'drop_point'. WAJIB jalur
   *    utama: `s.name` bisa berisi Nama DP (BATANG_UTARA) ATAU Kecamatan
   *    mentah (WONOTUNGGAL) - keduanya string biasa yg TIDAK BISA dibedakan
   *    lagi di server, jadi menebak ulang dari `s.name` saja tidak reliable
   *    (nama DP yg kebetulan sama dgn nama Kecamatan-nya "beruntung" ketemu,
   *    yg lain diam-diam gagal & fallback ke placeholder generik - regresi
   *    yang pernah terjadi).
   * 2) Utk key TANPA kodeDp eksplisit (caller lama, atau baris yg gagal
   *    resolve DP sama sekali): tetap coba cocokkan `s.name` sbg Kecamatan
   *    lewat drop_point_kecamatan (findDpByKecamatanBatch), lalu fallback ke
   *    mention per-Kecamatan (scope_type 'kecamatan') kalau itu pun gagal -
   *    supaya tidak ada mention yang hilang selama migrasi data belum lengkap.
   */
  private static async resolveMonitoringIncMentions(
    subdistrictKeysRaw: string[],
    keyToKodeDp: Map<string, string> = new Map()
  ): Promise<Map<string, MentionMappingRecord[]>> {
    const result = new Map<string, MentionMappingRecord[]>();
    const normalizedKeys = subdistrictKeysRaw.map((k) => k.trim().toUpperCase());

    // Key tanpa kodeDp eksplisit - jalur lama (tebak dari Kecamatan).
    const keysNeedingGuess = subdistrictKeysRaw.filter(
      (k) => !keyToKodeDp.has(k.trim().toUpperCase())
    );

    let dpByKecamatan = new Map<string, { kodeDp: string; namaDp: string }>();
    try {
      dpByKecamatan = await findDpByKecamatanBatch(keysNeedingGuess);
    } catch {
      // Lookup DP gagal - lanjut dgn fallback kecamatan-only di bawah (non-blocking).
    }

    const resolvedKodeDpSet = new Set<string>(keyToKodeDp.values());
    for (const key of normalizedKeys) {
      const match = dpByKecamatan.get(key);
      if (match) resolvedKodeDpSet.add(match.kodeDp);
    }

    const [dpMentionMap, kecamatanMentionMap] = await Promise.all([
      resolvedKodeDpSet.size > 0
        ? mentionService.getMentionsByKeys('drop_point', [...resolvedKodeDpSet])
        : Promise.resolve(new Map<string, MentionMappingRecord[]>()),
      mentionService.getMentionsByKeys('kecamatan', subdistrictKeysRaw),
    ]);

    for (const key of normalizedKeys) {
      const explicitKodeDp = keyToKodeDp.get(key);
      const kodeDp = explicitKodeDp || dpByKecamatan.get(key)?.kodeDp;
      if (kodeDp) {
        const dpMentions = dpMentionMap.get(kodeDp.trim().toUpperCase());
        if (dpMentions && dpMentions.length > 0) {
          result.set(key, dpMentions);
          continue;
        }
      }
      const kecMentions = kecamatanMentionMap.get(key);
      if (kecMentions) result.set(key, kecMentions);
    }
    return result;
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
