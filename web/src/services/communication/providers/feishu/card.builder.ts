import type {
  FeishuInteractiveCard,
  MonitoringIncSummaryData,
} from '../../communication.types';

export interface CardHeaderConfig {
  title: string;
  template?: 'red' | 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey';
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
   * Tambah Baris Informasi Target Kota & Waktu Generate
   */
  public addHeaderInfo(targetKota: string, timeStr?: string): this {
    const formattedTime = timeStr || new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    this.card.elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Target Kota:**\n📍 **${targetKota.toUpperCase()}**`,
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
    total: number | string;
    belum: number | string;
    late: number | string;
    percent: number | string;
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
   * Tambah Distribusi Top Kecamatan
   */
  public addTopKecamatan(kecamatanList?: string[]): this {
    const formattedList = kecamatanList && kecamatanList.length > 0
      ? kecamatanList.map((k) => `• ${k}`).join('\n')
      : '• Sesuai data terlampir';

    this.card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**🏙️ Top Kecamatan:**\n${formattedList}`,
      },
    });
    return this;
  }

  /**
   * Tambah Instruksi Tindak Lanjut
   */
  public addInstructionNote(text?: string): this {
    const content = text || 'Mohon segera dilakukan tindak lanjut terhadap seluruh paket yang masih belum TTD, khususnya paket yang telah melewati batas SLA.';
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
        content: altText || 'Laporan Monitoring INC',
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
    const builder = new FeishuCardBuilder();
    return builder
      .setHeader(`LTMS • Monitoring INC ${data.targetKota.toUpperCase()}`, 'red')
      .addHeaderInfo(data.targetKota, data.generateTime)
      .addDivider()
      .addKpiGrid({
        total: data.total,
        belum: data.belum,
        late: data.late,
        percent: data.percent,
      })
      .addDivider()
      .addTopKecamatan(data.topKecamatan)
      .addInstructionNote()
      .addImage(imageKey, `Monitoring INC ${data.targetKota}`)
      .addFooter()
      .build();
  }
}
