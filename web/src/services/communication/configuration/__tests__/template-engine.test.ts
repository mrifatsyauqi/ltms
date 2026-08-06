import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MessageTemplateEngine } from '../message-template.engine.ts';
import { CardCompilerService } from '../card-compiler.service.ts';
import { STARTER_PRESETS } from '../template-presets.ts';
import type { VisualCardBlocksConfig } from '../template.types.ts';
import type { MentionMappingRecord } from '../../../../lib/data/supabase/mention-mapping.ts';

describe('Phase 2.6.2 Communication Center Single Source Compiler & Mentions', () => {
  describe('MessageTemplateEngine', () => {
    it('should replace standard variables correctly', () => {
      const template = 'Monitoring INC {{pickup_dp}} ke {{target_city}} - Total: {{total_inc}}, Belum: {{pending_ttd}}';
      const context = {
        pickup_dp: 'BATANG01',
        target_city: 'KOTA BATANG',
        total_inc: 14942,
        pending_ttd: 72,
      };

      const result = MessageTemplateEngine.render(template, context);
      assert.equal(result, 'Monitoring INC BATANG01 ke KOTA BATANG - Total: 14.942, Belum: 72');
    });

    it('should preserve unknown variables placeholders if not provided', () => {
      const template = 'Halo {{unknown_var}} di {{target_city}}';
      const result = MessageTemplateEngine.render(template, { target_city: 'KOTA PEKALONGAN' });
      assert.equal(result, 'Halo {{unknown_var}} di KOTA PEKALONGAN');
    });

    it('should format percentage and numerical values cleanly', () => {
      const template = 'SLA: {{sla_percentage}}% (Clear: {{clear_ttd}}/{{total_inc}})';
      const context = {
        total_inc: 100,
        clear_ttd: 99,
        sla_percentage: 99.0,
      };

      const result = MessageTemplateEngine.render(template, context);
      assert.ok(result.includes('SLA: 99%'));
      assert.ok(result.includes('Clear: 99/100'));
    });
  });

  describe('CardCompilerService (Single Source of Truth)', () => {
    it('should compile operational assignment card with header columns and KPI grid', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      assert.ok(incPreset, 'preset_monitoring_inc must exist');

      const context = {
        pickup_dp: 'BATANG01',
        target_city: 'KOTA BATANG',
        generated_at: '05/08/2026, 08:30 WIB',
        total_inc: '14.942',
        clear_ttd: '14.816',
        pending_ttd: '72',
        over_sla: '54',
        sla_percentage: '99.1',
        subdistricts: [
          { name: 'BATANG', count: '10 AWB', picName: 'Agus' },
          { name: 'WARUNGASEM', count: '8 AWB', picName: 'Dimas' },
        ],
      };

      const card = CardCompilerService.compileCard(incPreset.blocksConfig, context, 'img_test_inc_01');

      assert.ok(card.header?.title?.content.includes('Monitoring INC'));
      assert.equal(card.header?.template, 'red');
      assert.ok(Array.isArray(card.elements) && card.elements.length > 0);

      // Verify subdistrict list has compiled
      const elementsStr = JSON.stringify(card.elements);
      assert.ok(elementsStr.includes('BATANG'));
      assert.ok(elementsStr.includes('WARUNGASEM'));
    });

    it('should resolve Feishu mentions with <at id="..."> tag when Open ID exists', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const context = {
        pickup_dp: 'BATANG01',
        target_city: 'KOTA BATANG',
        subdistricts: [
          { name: 'BATANG', count: '10 AWB' },
          { name: 'WARUNGASEM', count: '8 AWB' },
        ],
      };

      const mentionMap: Record<string, MentionMappingRecord> = {
        BATANG: {
          id: '1',
          scope_type: 'kecamatan',
          scope_key: 'BATANG',
          pic_name: 'Agus Supriyanto',
          feishu_open_id: 'ou_agus_batang_123',
          feishu_user_id: null,
          role: 'Admin DP Batang',
          phone: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const card = CardCompilerService.compileCard(incPreset.blocksConfig, context, undefined, mentionMap);
      const elementsStr = JSON.stringify(card.elements);

      // Verify <at id="ou_..."> is rendered for BATANG
      assert.ok(elementsStr.includes('<at id=\\"ou_agus_batang_123\\">Agus Supriyanto</at>'));
      // Verify WARUNGASEM is present
      assert.ok(elementsStr.includes('WARUNGASEM'));
    });

    it('should fallback to @Nama PIC gracefully when Open ID is absent or null', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const context = {
        pickup_dp: 'BATANG01',
        target_city: 'KOTA BATANG',
        subdistricts: [{ name: 'LIMPUNG', count: '5 AWB' }],
      };

      const mentionMap: Record<string, MentionMappingRecord> = {
        LIMPUNG: {
          id: '2',
          scope_type: 'kecamatan',
          scope_key: 'LIMPUNG',
          pic_name: 'Rian Hidayat',
          feishu_open_id: null,
          feishu_user_id: null,
          role: 'Admin DP Limpung',
          phone: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const card = CardCompilerService.compileCard(incPreset.blocksConfig, context, undefined, mentionMap);
      const elementsStr = JSON.stringify(card.elements);

      // Should contain text @Rian Hidayat instead of breaking
      assert.ok(elementsStr.includes('@Rian Hidayat'));
    });

    it('should compile Monitoring Delivery Assignment preset correctly', () => {
      const deliveryPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_delivery')!;
      const context = {
        drop_point: 'BATANG01',
        total_delivery: '3.240',
        delivered: '3.198',
        pending_delivery: '42',
        delivery_sla: '98.0',
        last_scan_time: '08:21 WIB',
        last_scan_awb: 'JT1234567890',
        last_scan_status: 'Delivery',
        kurirList: [
          { name: 'Andi Setiawan', count: '12 Paket' },
          { name: 'Rudi Hermawan', count: '8 Paket' },
        ],
      };

      const card = CardCompilerService.compileCard(deliveryPreset.blocksConfig, context);
      assert.ok(card.header?.title?.content.includes('Monitoring Delivery'));
      assert.equal(card.header?.template, 'grey'); // Dark theme maps to grey header template in Feishu

      const elementsStr = JSON.stringify(card.elements);
      assert.ok(elementsStr.includes('Andi Setiawan'));
      assert.ok(elementsStr.includes('Rudi Hermawan'));
    });

    it('should never leave an unresolved {{dashboard_url}} placeholder in the action button url (Feishu rejects non-URL strings with 400)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      // dashboard_url intentionally omitted - this is the exact condition that
      // produced "Feishu Send Message HTTP Error: 400 Bad Request" in production.
      const context = { pickup_dp: 'BATANG01', target_city: 'KOTA BATANG' };

      const card = CardCompilerService.compileCard(incPreset.blocksConfig, context);
      const actionEl = card.elements.find((el: any) => el.tag === 'action');
      const url = actionEl?.actions?.[0]?.url;

      assert.ok(url, 'action button url should be present');
      assert.match(url, /^https?:\/\//, `url must be a real link, got: ${url}`);
      assert.doesNotMatch(url, /\{\{.*\}\}/, 'url must not contain an unresolved {{placeholder}}');
    });
  });

  describe('Starter Presets Catalog', () => {
    it('should provide presets for operational assignment cards', () => {
      assert.ok(STARTER_PRESETS.length >= 3);
      const ids = STARTER_PRESETS.map((p) => p.id);
      assert.ok(ids.includes('preset_monitoring_inc'));
      assert.ok(ids.includes('preset_monitoring_delivery'));
      assert.ok(ids.includes('preset_longtail'));
    });
  });
});
