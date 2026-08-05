import type {
  FeishuInteractiveCard,
  GenericReportData,
  MonitoringIncSummaryData,
} from '../../communication.types';
import { CardCompilerService } from '../../configuration/card-compiler.service';
import { STARTER_PRESETS } from '../../configuration/template-presets';

export interface CardHeaderConfig {
  title: string;
  template?:
    | 'red'
    | 'blue'
    | 'wathet'
    | 'turquoise'
    | 'green'
    | 'yellow'
    | 'orange'
    | 'carmine'
    | 'violet'
    | 'purple'
    | 'indigo'
    | 'grey';
}

export interface CardField {
  is_short: boolean;
  text: {
    tag: 'lark_md' | 'plain_text';
    content: string;
  };
}

/**
 * FeishuCardBuilder (Compatibility Wrapper)
 * Seluruh pembentukan Interactive Card didelegasikan ke CardCompilerService sebagai Single Source of Truth.
 */
export class FeishuCardBuilder {
  private card: FeishuInteractiveCard;

  constructor() {
    this.card = {
      config: {
        wide_screen_mode: true,
        enable_forward: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: 'LTMS Enterprise Report',
        },
        template: 'red',
      },
      elements: [],
    };
  }

  public setHeader(title: string, template: CardHeaderConfig['template'] = 'red'): this {
    if (this.card.header) {
      this.card.header.title.content = title;
      this.card.header.template = template;
    }
    return this;
  }

  public addHeaderInfo(targetName: string, generateTime?: string, label = 'Target Kota'): this {
    const time = generateTime || new Date().toLocaleString('id-ID');
    this.card.elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**${label}:**\n**${targetName}**`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Generate:**\n${time}`,
          },
        },
      ],
    });
    return this;
  }

  public addDivider(): this {
    this.card.elements.push({ tag: 'hr' });
    return this;
  }

  public addKpiGrid(kpi: {
    total?: number | string;
    belum?: number | string;
    late?: number | string;
    percent?: number | string;
  }): this {
    this.card.elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Total AWB:**\n**${kpi.total ?? 0}**`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Belum Selesai:**\n<font color='red'>**${kpi.belum ?? 0}**</font>`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Late / Over SLA:**\n<font color='red'>**${kpi.late ?? 0}**</font>`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**SLA:**\n**${kpi.percent ?? 0}%**`,
          },
        },
      ],
    });
    return this;
  }

  public addTopList(items?: Array<{ name: string; count: number }>, title = 'Top Wilayah'): this {
    if (!items || items.length === 0) return this;
    const lines = items.map((it, idx) => `${idx + 1}. **${it.name}**: ${it.count} AWB`);
    this.card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**${title}**\n${lines.join('\n')}`,
      },
    });
    return this;
  }

  public addInstructionNote(customText?: string): this {
    this.card.elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: customText || 'Laporan ringkasan operasional harian LTMS.',
        },
      ],
    });
    return this;
  }

  public addImage(imageKey?: string, altText = 'Lampiran Monitoring'): this {
    if (!imageKey) return this;
    this.card.elements.push({
      tag: 'img',
      img_key: imageKey,
      alt: {
        tag: 'plain_text',
        content: altText,
      },
      mode: 'fit_horizontal',
    });
    return this;
  }

  public addFooter(footerText?: string): this {
    const text = footerText || 'Generated Automatically by LTMS';
    this.card.elements.push(
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: text,
          },
        ],
      }
    );
    return this;
  }

  public build(): FeishuInteractiveCard {
    return JSON.parse(JSON.stringify(this.card));
  }

  // ==========================================
  // SINGLE SOURCE OF TRUTH STATIC FACTORIES:
  // ==========================================

  public static createMonitoringIncCard(
    data: MonitoringIncSummaryData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const preset = STARTER_PRESETS.find((p) => p.module === 'monitoring_inc') || STARTER_PRESETS[0];
    return CardCompilerService.compileCard(preset.blocksConfig, data, imageKey) as FeishuInteractiveCard;
  }

  public static createDeliveryCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const preset = STARTER_PRESETS.find((p) => p.module === 'monitoring_delivery') || STARTER_PRESETS[0];
    return CardCompilerService.compileCard(preset.blocksConfig, data, imageKey) as FeishuInteractiveCard;
  }

  public static createDashboardCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const preset = STARTER_PRESETS.find((p) => p.module === 'dashboard') || STARTER_PRESETS[0];
    return CardCompilerService.compileCard(preset.blocksConfig, data, imageKey) as FeishuInteractiveCard;
  }

  public static createLongtailCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const preset = STARTER_PRESETS.find((p) => p.module === 'longtail') || STARTER_PRESETS[0];
    return CardCompilerService.compileCard(preset.blocksConfig, data, imageKey) as FeishuInteractiveCard;
  }

  public static createGenericReportCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const moduleName = data.module || 'monitoring_inc';
    const preset = STARTER_PRESETS.find((p) => p.module === moduleName) || STARTER_PRESETS[0];
    return CardCompilerService.compileCard(preset.blocksConfig, data, imageKey) as FeishuInteractiveCard;
  }
}
