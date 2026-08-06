import type {
  VisualCardBlocksConfig,
  CardTheme,
  TemplateVariablesContext,
} from './template.types';
import { MessageTemplateEngine } from './message-template.engine';
import type { MentionMappingRecord } from '@/lib/data/supabase/mention-mapping';

export class CardCompilerService {
  /**
   * Pemetaan tema visual ke warna header resmi Feishu Card
   */
  private static themeToFeishuColor(theme: any = 'red'): string {
    switch (theme) {
      case 'red':
      case 'blue':
      case 'wathet':
      case 'turquoise':
      case 'green':
      case 'yellow':
      case 'orange':
      case 'carmine':
      case 'violet':
      case 'purple':
      case 'indigo':
      case 'grey':
        return theme;
      case 'dark':
        return 'grey';
      default:
        return 'red';
    }
  }

  /**
   * SINGLE SOURCE OF TRUTH:
   * Mengompilasi konfigurasi visual blok menjadi struktur JSON Feishu Interactive Card 2.0 resmi
   * Digunakan seragam untuk Card Builder Preview, Share Dialog Preview, dan Feishu API Send.
   */
  public static compileCard(
    config: VisualCardBlocksConfig,
    variables: TemplateVariablesContext | Record<string, any> = {},
    imageKey?: string | null,
    mentionMap?: Map<string, MentionMappingRecord[]> | Record<string, any>,
    appBaseUrl = 'https://ltms.jt-express.id'
  ): Record<string, any> {
    const ctx = MessageTemplateEngine.normalizeContext(variables);
    const elements: any[] = [];

    // 1. Header (Title & Subtitle)
    const rawTitle = config.header?.title || config.title || 'LTMS | Monitoring INC';
    const compiledTitle = MessageTemplateEngine.render(rawTitle, ctx);
    const rawSubtitle = config.header?.subtitle || '';
    const compiledSubtitle = rawSubtitle ? MessageTemplateEngine.render(rawSubtitle, ctx) : '';

    // 2. Sub Header Operational Information Fields
    const showPickup = config.header?.showPickupDp ?? true;
    const showTarget = config.header?.showTargetCity ?? true;
    const showUpdate = config.header?.showUpdate ?? true;

    const headerFields: any[] = [];

    if (showPickup && (config.header?.pickupDpValue || ctx.pickup_dp || ctx.drop_point)) {
      const label = config.header?.pickupDpLabel || 'Pickup DP';
      const val = config.header?.pickupDpValue
        ? MessageTemplateEngine.render(config.header.pickupDpValue, ctx)
        : (ctx.pickup_dp !== '-' ? ctx.pickup_dp : ctx.drop_point);
      if (val && val !== '-') {
        headerFields.push({
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `🏢 **${label}:**\n**${val}**`,
          },
        });
      }
    }

    if (showTarget && (config.header?.targetCityValue || ctx.target_city || ctx.city)) {
      const label = config.header?.targetCityLabel || (config.lastScan ? 'Area Delivery' : 'Kota Tujuan');
      const val = config.header?.targetCityValue
        ? MessageTemplateEngine.render(config.header.targetCityValue, ctx)
        : (ctx.target_city !== '-' ? ctx.target_city : ctx.city);
      if (val && val !== '-') {
        headerFields.push({
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `🎯 **${label}:**\n**${val}**`,
          },
        });
      }
    }

    if (showUpdate) {
      const label = config.header?.updateLabel || 'Generate';
      const val = config.header?.updateValue
        ? MessageTemplateEngine.render(config.header.updateValue, ctx)
        : ctx.generated_at;
      headerFields.push({
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `🕒 **${label}:**\n${val}`,
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

      const lastScanTitle = config.lastScan.title || 'Last Scan Activity';
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

    // 4. Grid KPI Summary (Ringkasan Monitoring INC / Delivery / Custom)
    const showKpi = config.kpiGrid ? true : (config.showKpiGrid ?? true);
    if (showKpi) {
      if (elements.length > 0) elements.push({ tag: 'hr' });

      const kpiTitle = config.kpiGrid?.title || 'Ringkasan Monitoring';
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
      }

      const rawMetrics = (variables as any).metrics || (ctx as any).metrics;
      if (Array.isArray(rawMetrics) && rawMetrics.length > 0) {
        const metricFields = rawMetrics.map((m: any) => ({
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**${m.label}:**\n**${m.value}**`,
          },
        }));
        elements.push({
          tag: 'div',
          fields: metricFields,
        });
      }

      const rawNotes = (variables as any).notes || (ctx as any).notes;
      if (rawNotes) {
        elements.push({
          tag: 'note',
          elements: [{ tag: 'plain_text', content: String(rawNotes) }],
        });
      }
    }

    // 5. OPERATIONAL ASSIGNMENT: 📍 Kecamatan Tujuan (Monitoring INC)
    const showSubdistricts = config.subdistricts ? config.subdistricts.show : (config.showTopKecamatan ?? true);
    if (showSubdistricts) {
      const subdistrictItems: Array<{ name: string; count: number | string; pic?: string; openId?: string }> = [];

      // Parse from structured array or destination_subdistricts string
      if (Array.isArray(variables.subdistricts)) {
        variables.subdistricts.forEach((item: any) => {
          if (typeof item === 'object' && item.name) {
            subdistrictItems.push({
              name: String(item.name),
              count: item.count || 0,
              pic: item.picName,
              openId: item.openId,
            });
          }
        });
      } else if (ctx.destination_subdistricts && ctx.destination_subdistricts !== '-') {
        const lines = ctx.destination_subdistricts.split('\n').filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          // Parse format "BATANG: 10 AWB" or "BATANG (10 AWB)" or multiline
          const match = line.match(/^([^:\(\d]+)(?::|\(|\s+-\s+)?\s*(\d+)?/);
          if (match) {
            const name = match[1].trim().replace(/^📍\s*/, '');
            const count = match[2] ? `${match[2]} AWB` : (lines[i + 1]?.includes('AWB') ? lines[++i].trim() : 'Perlu Follow Up');
            subdistrictItems.push({ name, count });
          } else {
            subdistrictItems.push({ name: line, count: 'Perlu Follow Up' });
          }
        }
      }

      if (subdistrictItems.length > 0) {
        if (elements.length > 0) elements.push({ tag: 'hr' });

        const title = config.subdistricts?.title || '📍 Kecamatan Tujuan';
        const maxLimit =
          config.subdistricts?.maxItems === '10'
            ? 10
            : config.subdistricts?.maxItems === '15'
            ? 15
            : config.subdistricts?.maxItems === 'all'
            ? 999
            : 5;

        const limitedItems = subdistrictItems.slice(0, maxLimit);

        // Header Assignment Block
        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `📍 **${title}**`,
          },
        });

        // Render each Kecamatan as an Assignment Card row with Mention.
        // listStyle: 'divided' (default, backward-compatible w/ existing
        // presets) separates rows with a horizontal divider; 'numbered'
        // renders "1. Name (count)" with the mention indented underneath.
        const listStyle = config.subdistricts?.listStyle || 'divided';
        const rowsText = limitedItems
          .map((item, idx) => {
            const kecKey = item.name.trim().toUpperCase();

            // Lookup mentions from map
            let mentionText = '';
            if (config.subdistricts?.showMention !== false) {
              const prefix = config.subdistricts?.mentionPrefix || '👤';
              let mappings: MentionMappingRecord[] = [];

              if (mentionMap instanceof Map) {
                const found = mentionMap.get(kecKey);
                mappings = Array.isArray(found) ? found : (found ? [found] : []);
              } else if (mentionMap && typeof mentionMap === 'object') {
                const found = (mentionMap as any)[kecKey];
                mappings = Array.isArray(found) ? found : (found ? [found] : []);
              }

              if (mappings.length > 0) {
                const mentions = mappings.map((m) => {
                  if (m.feishu_open_id) {
                    return `<at id="${m.feishu_open_id.trim()}">${m.pic_name.trim()}</at>`;
                  }
                  return `@${m.pic_name.trim()}`;
                });
                mentionText = `${prefix} ${mentions.join(' ')}`;
              } else if (item.openId) {
                mentionText = `${prefix} <at id="${item.openId.trim()}">${(item.pic || 'Admin DP').trim()}</at>`;
              } else if (item.pic) {
                mentionText = `${prefix} @${item.pic.trim()}`;
              } else {
                mentionText = `${prefix} @Admin DP ${item.name}`;
              }
            }

            const countText = typeof item.count === 'number' || /^\d+$/.test(String(item.count))
              ? `${item.count} AWB`
              : item.count;

            if (listStyle === 'numbered') {
              const mentionLine = mentionText ? `\n     ${mentionText}` : '';
              return `${idx + 1}. **${item.name}** (${countText})${mentionLine}`;
            }

            const mentionTag = mentionText ? `\n${mentionText}` : '';
            return `**${item.name}**\n${countText}${mentionTag}`;
          })
          .join(listStyle === 'numbered' ? '\n' : '\n\n━━━━━━━━━━━━━━━━━━\n\n');

        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: rowsText,
          },
        });
      }
    }

    // 6. OPERATIONAL ASSIGNMENT: 🛵 Kurir Perlu Follow Up (Monitoring Delivery)
    if (config.kurirFollowUp && config.kurirFollowUp.show) {
      const kurirItems: Array<{ name: string; count: number | string; pic?: string; openId?: string }> = [];

      if (Array.isArray(variables.kurirList)) {
        variables.kurirList.forEach((item: any) => {
          if (typeof item === 'object' && item.name) {
            kurirItems.push({
              name: String(item.name),
              count: item.count || 0,
              pic: item.picName || item.name,
              openId: item.openId,
            });
          }
        });
      }

      if (kurirItems.length > 0) {
        if (elements.length > 0) elements.push({ tag: 'hr' });

        const title = config.kurirFollowUp.title || '🛵 Kurir Perlu Follow Up';
        const maxLimit =
          config.kurirFollowUp.maxItems === '10'
            ? 10
            : config.kurirFollowUp.maxItems === '15'
            ? 15
            : config.kurirFollowUp.maxItems === 'all'
            ? 999
            : 5;

        const limitedKurir = kurirItems.slice(0, maxLimit);

        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `🛵 **${title}**`,
          },
        });

        const rowsText = limitedKurir
          .map((item) => {
            const kurirKey = item.name.trim();

            let mentionTag = '';
            if (config.kurirFollowUp?.showMention !== false) {
              const prefix = config.kurirFollowUp?.mentionPrefix || '👉';
              let mappings: MentionMappingRecord[] = [];

              if (mentionMap instanceof Map) {
                mappings = mentionMap.get(kurirKey.toUpperCase()) || [];
              } else if (mentionMap && typeof mentionMap === 'object') {
                mappings = mentionMap[kurirKey.toUpperCase()] || [];
              }

              if (mappings.length > 0) {
                const mentions = mappings.map((m) => {
                  if (m.feishu_open_id) {
                    return `<at id="${m.feishu_open_id.trim()}">${m.pic_name.trim()}</at>`;
                  }
                  return `@${m.pic_name.trim()}`;
                });
                mentionTag = `\n${prefix} ${mentions.join(' ')}`;
              } else if (item.openId) {
                mentionTag = `\n${prefix} <at id="${item.openId.trim()}">${item.name}</at>`;
              } else {
                mentionTag = `\n${prefix} @${item.name}`;
              }
            }

            const countText = typeof item.count === 'number' || /^\d+$/.test(String(item.count))
              ? `${item.count} Paket Belum Selesai`
              : item.count;

            return `👤 **${item.name}**\n📦 ${countText}${mentionTag}`;
          })
          .join('\n\n━━━━━━━━━━━━━━━━━━\n\n');

        elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: rowsText,
          },
        });
      }
    }

    // 7. Lampiran Screenshot Monitoring (Offscreen Canvas Rendered)
    const showScreenshot = config.screenshot ? config.screenshot.show : (config.showImage ?? true);
    if (showScreenshot && imageKey) {
      if (elements.length > 0) elements.push({ tag: 'hr' });
      const imgTitle = config.screenshot?.title || '🖼 Lampiran Monitoring';
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**${imgTitle}**`,
        },
      });
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

    // 8. Tombol Action Dashboard
    const btnEnabled = config.actionButton ? config.actionButton.enabled : (config.actionButton === 'open_dashboard');
    if (btnEnabled) {
      if (elements.length > 0) elements.push({ tag: 'hr' });
      const btnLabel = config.actionButton?.label || '🚀 Buka LTMS Dashboard';
      const renderedBtnUrl = config.actionButton?.url
        ? MessageTemplateEngine.render(config.actionButton.url, ctx)
        : (ctx.dashboard_url || appBaseUrl);
      // render() leaves unresolved {{placeholders}} in place (e.g. dashboard_url
      // is never provided by any caller) — Feishu rejects a non-URL string here
      // with 400 Bad Request, so guard against ever sending one.
      const btnUrl = /^https?:\/\//.test(renderedBtnUrl) ? renderedBtnUrl : (ctx.dashboard_url || appBaseUrl);

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

    // 9. Footer
    const showFooter = config.footer ? config.footer.show : (config.showFooter ?? true);
    if (showFooter) {
      const footerTitle = config.footer?.title || 'Generated Automatically by LTMS';
      const footerDesc = config.footer?.description || config.footerText || 'Long Tail Monitoring System • Real-Time Operational Reminder';
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

    // Return official Feishu Card 2.0 object
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
