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

      assert.ok(card.header?.title?.content.includes('MONITORING INC'));
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

    it('should NOT mention a Drop Point whose hasPending is false (all AWB already Clear TTD), but still list the row', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const context = {
        pickup_dp: 'BATANG01',
        target_city: 'KOTA BATANG',
        subdistricts: [
          { name: 'BATANG', count: '10 AWB', hasPending: true },
          { name: 'WARUNGASEM', count: '8 AWB', hasPending: false },
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
        WARUNGASEM: {
          id: '3',
          scope_type: 'kecamatan',
          scope_key: 'WARUNGASEM',
          pic_name: 'Dimas Prasetyo',
          feishu_open_id: 'ou_dimas_warungasem',
          feishu_user_id: null,
          role: 'Admin DP Warungasem',
          phone: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const card = CardCompilerService.compileCard(incPreset.blocksConfig, context, undefined, mentionMap);
      const elementsStr = JSON.stringify(card.elements);

      // BATANG masih ada AWB pending -> tetap di-mention.
      assert.ok(elementsStr.includes('<at id=\\"ou_agus_batang_123\\">Agus Supriyanto</at>'));
      // WARUNGASEM sudah Clear TTD semua -> baris tetap tampil (nama DP & count-nya)...
      assert.ok(elementsStr.includes('WARUNGASEM'));
      assert.ok(elementsStr.includes('8 AWB'));
      // ...tapi TIDAK boleh ada mention Dimas sama sekali di kartu ini.
      assert.ok(!elementsStr.includes('Dimas Prasetyo'), 'DP yang sudah Clear TTD semua tidak boleh di-mention');
      assert.ok(!elementsStr.includes('ou_dimas_warungasem'), 'Open ID DP yang sudah Clear TTD semua tidak boleh muncul di kartu');
    });

    it('should still mention a Drop Point when hasPending is omitted (backward-compat with old callers)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const context = {
        pickup_dp: 'BATANG01',
        target_city: 'KOTA BATANG',
        subdistricts: [{ name: 'TULIS', count: '3 AWB' }], // tanpa field hasPending sama sekali
      };

      const mentionMap: Record<string, MentionMappingRecord> = {
        TULIS: {
          id: '4',
          scope_type: 'kecamatan',
          scope_key: 'TULIS',
          pic_name: 'Budi Hartono',
          feishu_open_id: 'ou_budi_tulis',
          feishu_user_id: null,
          role: 'Admin DP Tulis',
          phone: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const card = CardCompilerService.compileCard(incPreset.blocksConfig, context, undefined, mentionMap);
      const elementsStr = JSON.stringify(card.elements);

      assert.ok(elementsStr.includes('<at id=\\"ou_budi_tulis\\">Budi Hartono</at>'));
    });

    it('should compile Monitoring Delivery Assignment preset correctly (header, KPI grid, no assignment list)', () => {
      const deliveryPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_delivery')!;
      const context = {
        drop_point: 'BATANG01',
        total_delivery: '3.240',
        delivered: '3.198',
        pending_delivery: '42',
        delivery_sla: '98.0',
      };

      const card = CardCompilerService.compileCard(deliveryPreset.blocksConfig, context);
      assert.ok(card.header?.title?.content.includes('MONITORING DELIVERY'));
      assert.ok(card.header?.title?.content.includes('BATANG01'));
      assert.equal(card.header?.template, 'grey'); // Dark theme maps to grey header template in Feishu

      const elementsStr = JSON.stringify(card.elements);
      // KPI values resolved correctly (delivered/pending_delivery/delivery_sla)
      assert.ok(elementsStr.includes('3.198'), 'delivered should resolve, not leak {{delivered}}');
      assert.ok(elementsStr.includes('42'), 'pending_delivery should resolve');
      assert.ok(elementsStr.includes('98.0%'), 'delivery_sla should resolve');
      // Design has no assignment list, no kurir section, no action button
      assert.equal(card.elements.find((el: any) => el.tag === 'action'), undefined);
    });

    it('should compile kurirFollowUp assignment list with per-item mentions when explicitly enabled', () => {
      const deliveryPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_delivery')!;
      const config: VisualCardBlocksConfig = {
        ...deliveryPreset.blocksConfig,
        kurirFollowUp: { ...deliveryPreset.blocksConfig.kurirFollowUp!, show: true },
      };
      const context = {
        kurirList: [
          { name: 'Andi Setiawan', count: '12 Paket' },
          { name: 'Rudi Hermawan', count: '8 Paket' },
        ],
      };

      const card = CardCompilerService.compileCard(config, context);
      const elementsStr = JSON.stringify(card.elements);
      assert.ok(elementsStr.includes('Andi Setiawan'));
      assert.ok(elementsStr.includes('Rudi Hermawan'));
    });

    it('should render subdistricts as a numbered list with indented mention when listStyle is "numbered"', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const config: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        subdistricts: {
          ...incPreset.blocksConfig.subdistricts!,
          listStyle: 'numbered',
        },
      };
      const context = {
        subdistricts: [
          { name: 'BATANG', count: '10 AWB', picName: 'Agus' },
          { name: 'WARUNGASEM', count: '8 AWB', picName: 'Dimas' },
        ],
      };

      const card = CardCompilerService.compileCard(config, context);
      const elementsStr = JSON.stringify(card.elements);

      assert.ok(elementsStr.includes('1. **BATANG**'), 'first row should be numbered 1.');
      assert.ok(elementsStr.includes('2. **WARUNGASEM**'), 'second row should be numbered 2.');
      assert.ok(!elementsStr.includes('━━━'), 'numbered style should not include dividers between rows');
    });

    it('should keep the default divided list style unchanged when listStyle is not set (backward-compat)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const config: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        subdistricts: { ...incPreset.blocksConfig.subdistricts!, listStyle: undefined },
      };
      const context = {
        subdistricts: [{ name: 'BATANG', count: '10 AWB', picName: 'Agus' }],
      };

      const card = CardCompilerService.compileCard(config, context);
      const elementsStr = JSON.stringify(card.elements);

      assert.ok(!elementsStr.includes('1. **BATANG**'), 'default style should not be numbered');
    });

    it('should never leave an unresolved {{dashboard_url}} placeholder in the action button url (Feishu rejects non-URL strings with 400)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const config: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        actionButton: { ...incPreset.blocksConfig.actionButton, enabled: true },
      };
      // dashboard_url intentionally omitted - this is the exact condition that
      // produced "Feishu Send Message HTTP Error: 400 Bad Request" in production.
      const context = { pickup_dp: 'BATANG01', target_city: 'KOTA BATANG' };

      const card = CardCompilerService.compileCard(config, context);
      const actionEl = card.elements.find((el: any) => el.tag === 'action');
      const url = actionEl?.actions?.[0]?.url;

      assert.ok(url, 'action button url should be present');
      assert.match(url, /^https?:\/\//, `url must be a real link, got: ${url}`);
      assert.doesNotMatch(url, /\{\{.*\}\}/, 'url must not contain an unresolved {{placeholder}}');
    });

    it('should render each section title emoji exactly ONCE, not doubled (kpiGrid, subdistricts, kurirFollowUp)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const deliveryPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_delivery')!;

      const incCard = CardCompilerService.compileCard(
        incPreset.blocksConfig,
        { subdistricts: [{ name: 'BATANG', count: '10 AWB' }] }
      );
      const incStr = JSON.stringify(incCard.elements);
      assert.ok(incStr.includes('📊 Ringkasan Monitoring'), 'kpiGrid title should render once');
      assert.ok(!incStr.includes('📊 📊'), 'kpiGrid title emoji must not be doubled');
      assert.ok(incStr.includes('📍 Drop Point Tujuan'), 'subdistricts title should render once');
      assert.ok(!incStr.includes('📍 📍'), 'subdistricts title emoji must not be doubled');

      const deliveryConfig: VisualCardBlocksConfig = {
        ...deliveryPreset.blocksConfig,
        kurirFollowUp: { ...deliveryPreset.blocksConfig.kurirFollowUp!, show: true },
      };
      const deliveryCard = CardCompilerService.compileCard(deliveryConfig, {
        kurirList: [{ name: 'Andi Setiawan', count: '12 Paket' }],
      });
      const deliveryStr = JSON.stringify(deliveryCard.elements);
      assert.ok(deliveryStr.includes('🛵 Kurir Perlu Follow Up'), 'kurirFollowUp title should render once');
      assert.ok(!deliveryStr.includes('🛵 🛵'), 'kurirFollowUp title emoji must not be doubled');
    });

    it('should place the KPI icon on the value line (left of the number), not on the label line', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const card = CardCompilerService.compileCard(incPreset.blocksConfig, {
        total_inc: '81',
        clear_ttd: '70',
        pending_ttd: '11',
        sla_percentage: '86.4',
      });
      // NOTE: header block juga bisa punya `fields` (mis. label "Generate") -
      // cari field KPI spesifik lintas SEMUA div berfield, bukan div pertama.
      const allFields = card.elements.flatMap((el: any) => (Array.isArray(el.fields) ? el.fields : []));
      const totalField = allFields.find((f: any) => f.text.content.includes('Total AWB INC'));
      assert.ok(totalField, 'Total AWB INC field should exist');
      const content = totalField.text.content as string;
      const [labelLine, valueLine] = content.split('\n');
      assert.doesNotMatch(labelLine, /📦/, 'label line must NOT contain the icon');
      assert.match(valueLine, /^\*\*📦 /, 'value line must start (right after markdown bold) with the icon immediately before the number');
      assert.ok(valueLine.includes('81'), 'value line must contain the actual number');
    });

    it('should render the Teks Bebas (free text) block right after Drop Point Tujuan, only when non-empty', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;

      // Kosong (default preset) -> blok tidak muncul sama sekali
      const emptyCard = CardCompilerService.compileCard(incPreset.blocksConfig, {
        subdistricts: [{ name: 'BATANG', count: '10 AWB' }],
      });
      assert.ok(
        !JSON.stringify(emptyCard.elements).includes('Tambahkan catatan'),
        'empty freeText must not render any block'
      );

      // Terisi -> muncul, posisinya tepat setelah blok Drop Point Tujuan
      const filledConfig: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        freeText: { show: true, text: 'Mohon prioritaskan area rawan macet hari ini.' },
      };
      const filledCard = CardCompilerService.compileCard(filledConfig, {
        subdistricts: [{ name: 'BATANG', count: '10 AWB' }],
      });
      const elements = filledCard.elements;
      const subdistrictIdx = elements.findIndex(
        (el: any) => el.text?.content?.includes('Drop Point Tujuan')
      );
      const freeTextIdx = elements.findIndex(
        (el: any) => el.text?.content === 'Mohon prioritaskan area rawan macet hari ini.'
      );
      assert.ok(subdistrictIdx >= 0, 'subdistricts title block should exist');
      assert.ok(freeTextIdx > subdistrictIdx, 'freeText block must come after the Drop Point Tujuan block');

      // show: false paksa sembunyi walau text terisi
      const hiddenConfig: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        freeText: { show: false, text: 'Catatan yang sengaja disembunyikan.' },
      };
      const hiddenCard = CardCompilerService.compileCard(hiddenConfig, {
        subdistricts: [{ name: 'BATANG', count: '10 AWB' }],
      });
      assert.ok(
        !JSON.stringify(hiddenCard.elements).includes('Catatan yang sengaja disembunyikan'),
        'show:false must hide freeText even when text is non-empty'
      );
    });

    it('should render freeText AFTER the screenshot image when position is "after_screenshot" (Laporan Harian: Header -> gambar -> teks bebas -> footer)', () => {
      const laporanPreset = STARTER_PRESETS.find((p) => p.id === 'preset_laporan_harian')!;
      assert.equal(laporanPreset.blocksConfig.freeText?.position, 'after_screenshot');

      const config: VisualCardBlocksConfig = {
        ...laporanPreset.blocksConfig,
        freeText: { ...laporanPreset.blocksConfig.freeText, show: true, text: 'Catatan harian.' },
      };
      const card = CardCompilerService.compileCard(config, { pickup_dp: 'BATANG01' }, 'img_key_123');
      const elements = card.elements as Array<Record<string, any>>;

      const imgIdx = elements.findIndex((el) => el.tag === 'img');
      const freeTextIdx = elements.findIndex(
        (el) => el.tag === 'div' && el.text?.content?.includes('Catatan harian.')
      );

      assert.ok(imgIdx >= 0, 'screenshot image should be present');
      assert.ok(freeTextIdx >= 0, 'freeText block should be present');
      assert.ok(freeTextIdx > imgIdx, 'freeText must come AFTER the screenshot image');
    });

    it('should hide the KPI grid entirely when showKpiGrid is false and kpiGrid is omitted (Laporan Harian: no KPI cards)', () => {
      const laporanPreset = STARTER_PRESETS.find((p) => p.id === 'preset_laporan_harian')!;
      assert.equal(laporanPreset.blocksConfig.kpiGrid, undefined, 'preset should not define kpiGrid at all');
      assert.equal(laporanPreset.blocksConfig.showKpiGrid, false);

      const card = CardCompilerService.compileCard(laporanPreset.blocksConfig, { pickup_dp: 'BATANG01' }, 'img_key_123');
      const elementsStr = JSON.stringify(card.elements);
      assert.ok(!elementsStr.includes('Ringkasan'), 'no KPI grid title should render');
    });

    it('should render footer.text VERBATIM as a single field (no more split title+description)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const config: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        footer: { text: 'Baris pertama custom\nBaris kedua custom', show: true },
      };
      const card = CardCompilerService.compileCard(config, {});
      const noteEl = card.elements.find((el: any) => el.tag === 'note');
      assert.ok(noteEl, 'footer note element should exist');
      assert.equal(noteEl.elements[0].content, 'Baris pertama custom\nBaris kedua custom');
    });

    it('should fall back to legacy title+description ONLY when footer.text is absent (old templates keep rendering)', () => {
      const incPreset = STARTER_PRESETS.find((p) => p.id === 'preset_monitoring_inc')!;
      const config: VisualCardBlocksConfig = {
        ...incPreset.blocksConfig,
        // Simulasi template lama dari sebelum footer disatukan - tidak ada `text`.
        footer: { title: 'Judul Lama', description: 'Deskripsi Lama', show: true },
      };
      const card = CardCompilerService.compileCard(config, {});
      const noteEl = card.elements.find((el: any) => el.tag === 'note');
      assert.equal(noteEl.elements[0].content, 'Judul Lama\nDeskripsi Lama');
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
