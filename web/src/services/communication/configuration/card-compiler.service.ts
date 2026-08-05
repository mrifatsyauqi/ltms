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
  private static themeToFeishuColor(theme: CardTheme = 'red'): string {
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

    // 1. Header (Title & Subtitle)
    const rawTitle = config.header?.title || config.title || 'LTMS | Monitoring INC';
    const compiledTitle = MessageTemplateEngine.render(rawTitle, ctx);
    const rawSubtitle = config.header?.subtitle || '';
    const compiledSubtitle = rawSubtitle ? MessageTemplateEngine.render(rawSubtitle, ctx) : '';

    // 2. Header Info Fields (Sub Header Info)
    const showPickup = config.header?.showPickupDp ?? (config.showSummary || true);
    const showTarget = config.header?.showTargetCity ?? (config.showSummary || true);
    const showUpdate = config.header?.showUpdate ?? (config.showSummary || true);

    const headerFields: any[] = [];

    if (showPickup && (config.header?.pickupDpValue || ctx.pickup_dp !== '-')) {
      const label = config.header?.pickupDpLabel || 'Pickup DP';
      const val = config.header?.pickupDpValue
        ? MessageTemplateEngine.render(config.header.pickupDpValue, ctx)
        : ctx.pickup_dp;
      headerFields.push({
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `📦 **${label}:**\n${val}`,
        },
      });
    }

    if (showTarget && (config.header?.targetCityValue || ctx.target_city)) {
      const label = config.header?.targetCityLabel || (config.lastScan ? 'Drop Point' : 'Kota Tujuan Delivery');
      const val = config.header?.targetCityValue
        ? MessageTemplateEngine.render(config.header.targetCityValue, ctx)
        : (config.lastScan ? ctx.drop_point : ctx.target_city);
      headerFields.push({
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `🎯 **${label}:**\n**${val}**`,
        },
      });
    }

    if (showUpdate) {
      const label = config.header?.updateLabel || 'Waktu Generate';
      const val = config.header?.updateValue
        ? MessageTemplateEngine.render(config.header.updateValue, ctx)
        : ctx.generated_at;
      headerFields.push({
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `⏰ **${label}:**\n${val}`,
        },
      });
    }

    if (headerFields.length > 0) {
      elements.push({
        tag: 'div',
        fields: headerFields,
      });
    }

    // 3. Last Scan Block (Khusus Monitoring Delivery / jika di-enable)
    if (config.lastScan && config.lastScan.show) {
      if (elements.length > 0) elements.push({ tag: 'hr' });

      const lastScanTitle = config.lastScan.title || 'Last Scan';
      const scanTime = ctx.last_scan_time || (config.lastScan.scanTimeValue ? MessageTemplateEngine.render(config.lastScan.scanTimeValue, ctx) : '');
      const scanAwb = ctx.last_scan_awb || (config.lastScan.awbValue ? MessageTemplateEngine.render(config.lastScan.awbValue, ctx) : '');
      const scanStatus = ctx.last_scan_status || (config.lastScan.statusValue ? MessageTemplateEngine.render(config.lastScan.statusValue, ctx) : '');

      if (scanTime || scanAwb) {
        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `⏱️ **${lastScanTitle}**\n• ${config.lastScan.scanTimeLabel || 'Waktu Scan'}: **${scanTime}**\n• ${config.lastScan.awbLabel || 'AWB'}: **${scanAwb}**\n• ${config.lastScan.statusLabel || 'Status'}: **${scanStatus}**`,
          },
        });
      } else {
        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `⏱️ **${lastScanTitle}**\n*${config.lastScan.fallbackText || 'Belum ada aktivitas scan hari ini.'}*`,
          },
        });
      }
    }

    // 4. Grid KPI (Ringkasan Monitoring INC / Delivery / Custom)
    const showKpi = config.kpiGrid ? true : (config.showKpiGrid ?? true);
    if (showKpi) {
      if (elements.length > 0) elements.push({ tag: 'hr' });

      const kpiTitle = config.kpiGrid?.title || 'Ringkasan Operasional';
      if (kpiTitle) {
        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `📊 **${kpiTitle}**`,
          },
        });
      }

      // Format list of KPIs
      const items = config.kpiGrid?.items || [];
      if (items.length > 0) {
        const kpiFields: any[] = [];
        items.forEach((item) => {
          const val = MessageTemplateEngine.render(item.valueTemplate, ctx);
          let formattedContent = `**${item.label}**\n`;
          if (item.color === 'red') {
            formattedContent += `<font color='red'>**${val}**</font>`;
          } else if (item.color === 'green') {
            formattedContent += `<font color='green'>**${val}**</font>`;
          } else {
            formattedContent += `**${val}**`;
          }

          kpiFields.push({
            is_short: true,
            text: {
              tag: 'lark_md',
              content: formattedContent,
            },
          });
        });

        elements.push({
          tag: 'div',
          fields: kpiFields,
        });
      } else {
        // Fallback default 5/4/2 column KPI
        elements.push({
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `📦 **Total AWB INC**\n**${ctx.total_inc}**`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `✅ **Clear TTD**\n**${ctx.clear_ttd}**`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `⏳ **Belum TTD**\n<font color='red'>**${ctx.pending_ttd}**</font>`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `🚨 **Melebihi SLA**\n<font color='red'>**${ctx.over_sla}**</font>`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `📈 **Persentase SLA**\n**${ctx.sla_percentage}%**`,
              },
            },
          ],
        });
      }
    }

    // 5. 📍 Kecamatan Tujuan (Khusus Monitoring INC / jika di-enable)
    const showSubdistricts = config.subdistricts ? config.subdistricts.show : (config.showTopKecamatan ?? true);
    if (showSubdistricts && ctx.destination_subdistricts && ctx.destination_subdistricts !== '-') {
      if (elements.length > 0) elements.push({ tag: 'hr' });

      const title = config.subdistricts?.title || '📍 Kecamatan Tujuan';
      const maxLimit = config.subdistricts?.maxItems === '10' ? 10 : config.subdistricts?.maxItems === 'all' ? 999 : 5;
      
      const rawLines = ctx.destination_subdistricts.split('\n').filter(Boolean);
      const limitedLines = rawLines.slice(0, maxLimit).join('\n');

      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `📍 **${title}**\n${limitedLines}`,
        },
      });
    }

    // 6. Lampiran Screenshot Monitoring
    const showScreenshot = config.screenshot ? config.screenshot.show : (config.showImage ?? true);
    if (showScreenshot && imageKey) {
      if (elements.length > 0) elements.push({ tag: 'hr' });
      elements.push({
        tag: 'img',
        img_key: imageKey,
        alt: {
          tag: 'plain_text',
          content: `Lampiran Monitoring ${ctx.target_city || ctx.drop_point}`,
        },
        mode: 'fit_horizontal',
        preview: true,
      });
    }

    // 7. Tombol Action Dashboard
    const btnEnabled = config.actionButton ? config.actionButton.enabled : (config.actionButton === 'open_dashboard');
    if (btnEnabled) {
      if (elements.length > 0) elements.push({ tag: 'hr' });
      const btnLabel = config.actionButton?.label || '🚀 Buka Dashboard LTMS';
      const btnUrl = config.actionButton?.url || appBaseUrl;

      elements.push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: btnLabel,
            },
            type: config.theme === 'red' ? 'primary' : 'default',
            url: btnUrl,
          },
        ],
      });
    }

    // 8. Footer
    const showFooter = config.footer ? config.footer.show : (config.showFooter ?? true);
    if (showFooter) {
      const footerTitle = config.footer?.title || 'LTMS';
      const footerDesc = config.footer?.description || config.footerText || 'Long Tail Monitoring System\nGenerated Automatically';
      const footerContent = footerTitle ? `${footerTitle}\n${footerDesc}` : footerDesc;

      elements.push({
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: footerContent,
          },
        ],
      });
    }

    // Return Feishu Card 2.0 object
    const result: Record<string, any> = {
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

    if (compiledSubtitle) {
      (result.header as any).subtitle = {
        tag: 'plain_text',
        content: compiledSubtitle,
      };
    }

    return result;
  }
}

export const cardCompilerService = CardCompilerService;
