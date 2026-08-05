import type { TemplateVariablesContext } from './template.types';

export class MessageTemplateEngine {
  /**
   * Format angka dengan titik pemisah ribuan (standar Indonesia)
   */
  private static formatNumber(val: any): string {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'number') {
      return val.toLocaleString('id-ID');
    }
    return String(val);
  }

  /**
   * Menstandarisasi context variabel dari berbagai macam payload (camelCase / snake_case)
   */
  public static normalizeContext(raw: Record<string, any> = {}): Record<string, string> {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = `${now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })} WIB`;

    const city = raw.city || raw.targetKota || raw.target_kota || raw.kota || 'SEMUA WILAYAH';
    const branch = raw.branch || raw.cabang || 'SEMARANG';
    const dp = raw.dp || raw.dropPoint || raw.drop_point || '-';
    const user = raw.user || raw.senderName || raw.generated_by || raw.generatedBy || 'Operator LTMS';

    const total = raw.total_package ?? raw.total ?? raw.totalPackage ?? 0;
    const pending = raw.pending_package ?? raw.belum ?? raw.pendingPackage ?? raw.belumTtd ?? 0;
    const clear = raw.clear_ttd ?? raw.clear ?? raw.clearTtd ?? 0;
    const late = raw.over_sla ?? raw.late ?? raw.overSla ?? raw.lewatSla ?? 0;
    const progressVal = raw.progress ?? raw.percent ?? raw.sla_percentage ?? raw.slaPercentage ?? 0;

    let districtListStr = raw.district_list || raw.top_kecamatan || raw.districtList || '';
    if (Array.isArray(raw.topKecamatan)) {
      districtListStr = raw.topKecamatan
        .map((k: any, i: number) => {
          const name = typeof k === 'string' ? k : k.name || k.kecamatan || `Kecamatan ${i + 1}`;
          const count = typeof k === 'object' && k.count !== undefined ? ` (${k.count})` : '';
          return `${i + 1}. ${name}${count}`;
        })
        .join('\n');
    }

    return {
      city: String(city),
      target_kota: String(city),
      branch: String(branch),
      cabang: String(branch),
      dp: String(dp),
      drop_point: String(dp),
      user: String(user),
      generated_by: String(user),

      today: raw.today || dateFormatted,
      time: raw.time || timeFormatted,
      generated_date: raw.generated_date || raw.generatedDate || dateFormatted,
      generated_time: raw.generated_time || raw.generatedTime || timeFormatted,

      total_package: this.formatNumber(total),
      total: this.formatNumber(total),
      pending_package: this.formatNumber(pending),
      belum: this.formatNumber(pending),
      clear_ttd: this.formatNumber(clear),
      clear: this.formatNumber(clear),
      over_sla: this.formatNumber(late),
      late: this.formatNumber(late),
      progress: String(progressVal),
      percent: String(progressVal),
      sla_percentage: String(progressVal),

      district_list: districtListStr || '-',
      top_kecamatan: districtListStr || '-',

      footer: raw.footer || 'Logistics Traceability & Monitoring System (LTMS)',
    };
  }

  /**
   * Merender template string dengan mengganti tag {{variable}} berdasarkan context
   */
  public static render(
    templateContent: string,
    variables: TemplateVariablesContext | Record<string, any> = {}
  ): string {
    if (!templateContent) return '';

    const normalized = this.normalizeContext(variables);

    return templateContent.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
      const lowerKey = key.toLowerCase();
      if (normalized[lowerKey] !== undefined) {
        return normalized[lowerKey];
      }
      if (variables[key] !== undefined) {
        return String(variables[key]);
      }
      // Jika variabel tidak ditemukan, biarkan placeholder aslinya
      return match;
    });
  }

  /**
   * Mengambil daftar seluruh tag variabel unik yang digunakan dalam sebuah template
   */
  public static extractVariables(templateContent: string): string[] {
    if (!templateContent) return [];
    const matches = templateContent.match(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g) || [];
    const cleanKeys = matches.map((m) => m.replace(/[\{\}\s]/g, '').toLowerCase());
    return Array.from(new Set(cleanKeys));
  }
}

export const messageTemplateEngine = MessageTemplateEngine;
