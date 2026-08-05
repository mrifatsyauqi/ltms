import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MessageTemplateEngine } from '../message-template.engine.ts';
import { CardCompilerService } from '../card-compiler.service.ts';
import { STARTER_PRESETS } from '../template-presets.ts';
import type { VisualCardBlocksConfig } from '../template.types.ts';

describe('Phase 2.6 Communication Center Configuration', () => {
  describe('MessageTemplateEngine', () => {
    it('should replace standard variables correctly', () => {
      const template = 'Monitoring INC {{city}} - Total: {{total_package}}, Belum: {{pending_package}}';
      const context = {
        city: 'Batang',
        total_package: 1200,
        pending_package: 50,
      };

      const result = MessageTemplateEngine.render(template, context);
      assert.equal(result, 'Monitoring INC Batang - Total: 1.200, Belum: 50');
    });

    it('should preserve unknown variables placeholders if not provided', () => {
      const template = 'Halo {{unknown_var}} di {{city}}';
      const result = MessageTemplateEngine.render(template, { city: 'Pekalongan' });
      assert.equal(result, 'Halo {{unknown_var}} di Pekalongan');
    });

    it('should format progress and package counts accurately', () => {
      const template = 'Progress: {{progress}}% (Clear: {{clear_ttd}}/{{total_package}})';
      const context = {
        total_package: 100,
        clear_ttd: 85,
        progress: 85,
      };

      const result = MessageTemplateEngine.render(template, context);
      assert.ok(result.includes('Progress: 85%'));
      assert.ok(result.includes('Clear: 85/100'));
    });
  });

  describe('CardCompilerService', () => {
    it('should compile visual blocks into valid Feishu Interactive Card JSON', () => {
      const config: VisualCardBlocksConfig = {
        title: 'LTMS • {{city}} Report',
        theme: 'red',
        showLogo: true,
        showSummary: true,
        showKpiGrid: true,
        kpiStyle: '4_column',
        showTopKecamatan: true,
        topKecamatanLimit: 5,
        showImage: true,
        showFooter: true,
        footerText: 'Custom Footer Note',
        actionButton: 'open_dashboard',
      };

      const context = {
        city: 'Semarang',
        total_package: 2500,
        pending_package: 120,
        over_sla: 15,
        clear_ttd: 2365,
        image_key: 'img_test_123',
      };

      const card = CardCompilerService.compile(config, context, 'img_test_123');

      assert.ok(card.header?.title?.content.includes('Semarang'));
      assert.equal(card.header?.template, 'red');
      assert.ok(Array.isArray(card.elements) && card.elements.length > 0);

      // Verify action block and button exist
      const actionElement = card.elements.find((el: any) => el.tag === 'action');
      assert.ok(actionElement);
      const button = actionElement.actions?.find((a: any) => a.tag === 'button');
      assert.ok(button);
      assert.ok(button?.text?.content.includes('Buka Dashboard LTMS'));
    });

    it('should respect 2-column vs 4-column KPI style and theme colors', () => {
      const config2Col: VisualCardBlocksConfig = {
        title: 'Report {{city}}',
        theme: 'dark',
        showLogo: false,
        showSummary: false,
        showKpiGrid: true,
        kpiStyle: '2_column',
        showTopKecamatan: false,
        showImage: false,
        showFooter: false,
        actionButton: 'none',
      };

      const card = CardCompilerService.compile(config2Col, { city: 'Solo' });
      assert.equal(card.header?.template, 'grey');
      // No action element
      const actionElement = card.elements.find((el: any) => el.tag === 'action');
      assert.equal(actionElement, undefined);
    });
  });

  describe('Starter Presets Catalog', () => {
    it('should provide presets for all core modules', () => {
      assert.ok(STARTER_PRESETS.length >= 4);
      const modules = STARTER_PRESETS.map((p) => p.module);
      assert.ok(modules.includes('monitoring_inc'));
      assert.ok(modules.includes('monitoring_delivery'));
      assert.ok(modules.includes('longtail'));
      assert.ok(modules.includes('dashboard'));
    });

    it('should have valid starter configurations without empty strings', () => {
      STARTER_PRESETS.forEach((preset) => {
        assert.ok(preset.name);
        assert.ok(preset.messageContent);
        assert.ok(preset.blocksConfig.title);
        assert.ok(preset.blocksConfig.theme);
      });
    });
  });
});
