import type {
  VisualCardBlocksConfig,
  CardTheme,
  TemplateVariablesContext,
} from './template.types';
import { MessageTemplateEngine } from './message-template.engine';

export class CardCompilerService {
  /**
   * Pemetaan tema visual ke warna header resmi Feishu Card
   */
  private static themeToFeishuColor(theme: CardTheme): string {
    switch (theme) {
      case 'red':
        return 'red';
      case 'dark':
        return 'grey';
      case 'blue':
        return 'blue';
      case 'green':
        return 'green';
      default:
        return 'red';
    }
  }

  /**
   * Mengompilasi konfigurasi visual blok menjadi struktur JSON Feishu Interactive Card 2.0
   */
  public static compile(
    config: VisualCardBlocksConfig,
    variables: TemplateVariablesContext | Record<string, any> = {},
    imageKey?: string | null,
    appBaseUrl = 'https://ltms.jt-express.id'
  ): Record<string, any> {
    const ctx = MessageTemplateEngine.normalizeContext(variables);
    const elements: any[] = [];

    // 1. Header (Title Template)
    const rawTitle = config.title || 'LTMS • Monitoring Report {{city}}';
    const compiledTitle = MessageTemplateEngine.render(rawTitle, ctx);

    // 2. Summary / Wilayah & Waktu
    if (config.showSummary) {
      const branchText = ctx.branch && ctx.branch !== 'SEMARANG' ? ` (${ctx.branch})` : '';
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `📌 **Target Wilayah:** **${ctx.city}**${branchText}\n⏰ **Update Laporan:** ${ctx.generated_date} ${ctx.generated_time}`,
        },
      });
    }

    // 3. Grid Statistik KPI
    if (config.showKpiGrid) {
      if (elements.length > 0) elements.push({ tag: 'hr' });

      if (config.kpiStyle === '4_column') {
        elements.push({
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `📦 **Total Paket**\n${ctx.total_package}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `⏳ **Belum TTD**\n<font color='red'>**${ctx.pending_package}**</font>`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `🚨 **Lewat SLA**\n<font color='red'>**${ctx.over_sla}**</font>`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `📈 **Progress SLA**\n**${ctx.progress}%**`,
              },
            },
          ],
        });
      } else {
        // 2 Column Style
        elements.push({
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `📦 **Total Paket:** ${ctx.total_package}\n⏳ **Belum TTD:** <font color='red'>**${ctx.pending_package}**</font>`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `🚨 **Lewat SLA:** <font color='red'>**${ctx.over_sla}**</font>\n📈 **Progress:** **${ctx.progress}%**`,
              },
            },
          ],
        });
      }
    }

    // 4. Top Kecamatan
    if (config.showTopKecamatan && ctx.district_list && ctx.district_list !== '-') {
      if (elements.length > 0) elements.push({ tag: 'hr' });

      const limit = config.topKecamatanLimit || 5;
      const lines = ctx.district_list.split('\n').filter(Boolean);
      const limitedLines = lines.slice(0, limit).join('\n');

      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `🔥 **Top Kecamatan Tertinggi (Max ${limit}):**\n${limitedLines}`,
        },
      });
    }

    // 5. Image Block
    if (config.showImage && imageKey) {
      if (elements.length > 0) elements.push({ tag: 'hr' });
      elements.push({
        tag: 'img',
        img_key: imageKey,
        alt: {
          tag: 'plain_text',
          content: `Bukti Monitoring ${ctx.city}`,
        },
        mode: 'fit_horizontal',
        preview: true,
      });
    }

    // 6. Action Button
    if (config.actionButton === 'open_dashboard') {
      if (elements.length > 0) elements.push({ tag: 'hr' });
      elements.push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '🚀 Buka Dashboard LTMS',
            },
            type: config.theme === 'red' ? 'primary' : 'default',
            url: appBaseUrl,
          },
        ],
      });
    }

    // 7. Footer Note
    if (config.showFooter) {
      elements.push({
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: config.footerText || ctx.footer || 'Logistics Traceability & Monitoring System (LTMS)',
          },
        ],
      });
    }

    return {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: compiledTitle,
        },
        template: this.themeToFeishuColor(config.theme),
      },
      elements,
    };
  }
}

export const cardCompilerService = CardCompilerService;
