import type {
  FeishuInteractiveCard,
  GenericReportData,
  MonitoringIncSummaryData,
  ReportMetricItem,
} from '../../communication.types';

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
 * Fluent Type-Safe Feishu Interactive Card Builder
 * Menjamin pembentukan struktur Card JSON 2.0 Feishu terstandarisasi dan tervalidasi.
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

  /**
   * Set Header Card (Judul & Warna Banner)
   */
  public setHeader(title: string, template: CardHeaderConfig['template'] = 'red'): this {
    this.card.header = {
      title: {
        tag: 'plain_text',
        content: title,
      },
      template,
    };
    return this;
  }

  /**
   * Tambah Baris Pemisah (Horizontal Rule)
   */
  public addDivider(): this {
    this.card.elements.push({ tag: 'hr' });
    return this;
  }

  /**
   * Tambah Baris Informasi Target Scope & Waktu Generate
   */
  public addHeaderInfo(targetName?: string, timeStr?: string, scopeLabel = 'Target'): this {
    const formattedTime =
      timeStr ||
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());

    const scopeText = targetName ? `📍 **${targetName.toUpperCase()}**` : '🏢 **Seluruh Cabang**';

    this.card.elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**${scopeLabel}:**\n${scopeText}`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Waktu Generate:**\n🕒 ${formattedTime} WIB`,
          },
        },
      ],
    });
    return this;
  }

  /**
   * Tambah Grid KPI 4 Kartu (Total Resi, Belum TTD, Lewat SLA, Progress %)
   */
  public addKpiGrid(data: {
    total?: number | string;
    belum?: number | string;
    late?: number | string;
    percent?: number | string;
  }): this {
    const formattedTotal = Number(data.total || 0).toLocaleString('id-ID');
    const formattedBelum = Number(data.belum || 0).toLocaleString('id-ID');
    const formattedLate = Number(data.late || 0).toLocaleString('id-ID');
    const percent = Math.round(Number(data.percent || 0));

    this.card.elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**📦 Total Resi:**\n**${formattedTotal}**`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**⏳ Belum TTD:**\n**${formattedBelum}**`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**🚨 Lewat SLA:**\n<font color='red'>**${formattedLate}**</font>`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**📈 Progress:**\n<font color='green'>**${percent}%**</font>`,
          },
        },
      ],
    });
    return this;
  }

  /**
   * Tambah Dynamic Metrics Grid dari array ReportMetricItem
   */
  public addDynamicMetrics(metrics: ReportMetricItem[]): this {
    if (!metrics || metrics.length === 0) return this;

    const fields: CardField[] = metrics.map((m) => {
      let valStr = String(m.value);
      if (m.color === 'red') valStr = `<font color='red'>**${valStr}**</font>`;
      else if (m.color === 'green') valStr = `<font color='green'>**${valStr}**</font>`;
      else if (m.color === 'yellow' || m.color === 'orange')
        valStr = `<font color='orange'>**${valStr}**</font>`;
      else valStr = `**${valStr}**`;

      const sub = m.subValue ? ` _(${m.subValue})_` : '';

      return {
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `**${m.label}:**\n${valStr}${sub}`,
        },
      };
    });

    this.card.elements.push({
      tag: 'div',
      fields,
    });
    return this;
  }

  /**
   * Tambah Distribusi Top Item / Kecamatan
   */
  public addTopList(items?: string[], title = 'Top Wilayah'): this {
    if (!items || items.length === 0) return this;

    const formattedList = items.map((k) => `• ${k}`).join('\n');

    this.card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**🏙️ ${title}:**\n${formattedList}`,
      },
    });
    return this;
  }

  /**
   * Tambah Instruksi Tindak Lanjut / Catatan
   */
  public addInstructionNote(text?: string): this {
    const content =
      text ||
      'Mohon segera dilakukan tindak lanjut terhadap seluruh paket yang masih belum TTD, khususnya paket yang telah melewati batas SLA.';
    this.card.elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content,
        },
      ],
    });
    return this;
  }

  /**
   * Tambah Elemen Gambar Laporan (Fit Horizontal) jika imageKey tersedia
   */
  public addImage(imageKey?: string, altText?: string): this {
    if (!imageKey) return this;

    this.card.elements.push({
      tag: 'img',
      img_key: imageKey,
      alt: {
        tag: 'plain_text',
        content: altText || 'Laporan LTMS Enterprise',
      },
      mode: 'fit_horizontal',
    });
    return this;
  }

  /**
   * Tambah Footer Note Sistem
   */
  public addFooter(footerText?: string): this {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const text = footerText || `Generated by LTMS Enterprise • ${time} WIB`;

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

  /**
   * Validasi & Kembalikan Objek FeishuInteractiveCard JSON
   */
  public build(): FeishuInteractiveCard {
    if (!this.card.header?.title?.content) {
      throw new Error('FeishuCardBuilder: Header title is required.');
    }
    return JSON.parse(JSON.stringify(this.card));
  }

  /**
   * Static Factory untuk Monitoring INC
   */
  public static createMonitoringIncCard(
    data: MonitoringIncSummaryData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const target = data.targetKota || data.targetScope?.name || 'Cabang';
    const builder = new FeishuCardBuilder();
    return builder
      .setHeader(`LTMS • Monitoring INC ${target.toUpperCase()}`, 'red')
      .addHeaderInfo(target, data.generateTime, 'Target Kota')
      .addDivider()
      .addKpiGrid({
        total: data.total,
        belum: data.belum,
        late: data.late,
        percent: data.percent,
      })
      .addDivider()
      .addTopList(data.topKecamatan, 'Top Kecamatan')
      .addInstructionNote()
      .addImage(imageKey, `Monitoring INC ${target}`)
      .addFooter()
      .build();
  }

  /**
   * Static Factory untuk Monitoring Delivery
   */
  public static createDeliveryCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const target = data.targetDp || data.targetKota || data.targetScope?.name || 'Cabang';
    const builder = new FeishuCardBuilder();
    const b = builder
      .setHeader(`LTMS • Monitoring Delivery ${target.toUpperCase()}`, 'blue')
      .addHeaderInfo(target, data.generateTime, 'Cakupan DP / Wilayah')
      .addDivider();

    if (data.metrics && data.metrics.length > 0) {
      b.addDynamicMetrics(data.metrics);
    } else {
      b.addKpiGrid({
        total: data.total,
        belum: data.belum,
        late: data.late,
        percent: data.percent,
      });
    }

    return b
      .addInstructionNote(data.notes || 'Laporan Pengiriman Delivery Sprinter JMS.')
      .addImage(imageKey, `Monitoring Delivery ${target}`)
      .addFooter()
      .build();
  }

  /**
   * Static Factory untuk Dashboard Summary
   */
  public static createDashboardCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const target = data.targetScope?.name || data.targetKota || 'Cabang';
    const builder = new FeishuCardBuilder();
    const b = builder
      .setHeader(`LTMS • Ringkasan Dashboard ${target.toUpperCase()}`, 'indigo')
      .addHeaderInfo(target, data.generateTime, 'Cakupan Scope')
      .addDivider();

    if (data.metrics && data.metrics.length > 0) {
      b.addDynamicMetrics(data.metrics);
    } else {
      b.addKpiGrid({
        total: data.total,
        belum: data.belum,
        late: data.late,
        percent: data.percent,
      });
    }

    return b
      .addInstructionNote(data.notes || 'Ringkasan performa operasional harian LTMS.')
      .addImage(imageKey, `Ringkasan Dashboard ${target}`)
      .addFooter()
      .build();
  }

  /**
   * Static Factory untuk Long Tail Report
   */
  public static createLongtailCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const target = data.targetDp || data.targetKota || data.targetScope?.name || 'Cabang';
    const builder = new FeishuCardBuilder();
    const b = builder
      .setHeader(`LTMS • Laporan Long Tail ${target.toUpperCase()}`, 'orange')
      .addHeaderInfo(target, data.generateTime, 'Cakupan Data')
      .addDivider();

    if (data.metrics && data.metrics.length > 0) {
      b.addDynamicMetrics(data.metrics);
    } else {
      b.addKpiGrid({
        total: data.total,
        belum: data.belum,
        late: data.late,
        percent: data.percent,
      });
    }

    return b
      .addInstructionNote(data.notes || 'Laporan paket status Long Tail yang memerlukan penanganan.')
      .addImage(imageKey, `Laporan Long Tail ${target}`)
      .addFooter()
      .build();
  }

  /**
   * Static Factory untuk Generic / Multi-Module Report
   */
  public static createGenericReportCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const title = data.title || `LTMS • Laporan ${data.module?.toUpperCase() || 'OPERASIONAL'}`;
    const template = data.headerTemplate || 'red';
    const target = data.targetDp || data.targetKota || data.targetScope?.name || 'Cabang';

    const builder = new FeishuCardBuilder();
    const b = builder
      .setHeader(title, template)
      .addHeaderInfo(target, data.generateTime, 'Cakupan')
      .addDivider();

    if (data.metrics && data.metrics.length > 0) {
      b.addDynamicMetrics(data.metrics);
    } else if (data.total !== undefined || data.belum !== undefined) {
      b.addKpiGrid({
        total: data.total,
        belum: data.belum,
        late: data.late,
        percent: data.percent,
      });
    }

    if (data.topKecamatan && data.topKecamatan.length > 0) {
      b.addTopList(data.topKecamatan, 'Top Wilayah');
    }

    return b
      .addInstructionNote(data.notes)
      .addImage(imageKey, title)
      .addFooter()
      .build();
  }
}
