import type { TemplateVariablesContext } from './template.types';

export class MessageTemplateEngine {
  /**
   * Format angka dengan titik pemisah ribuan (standar Indonesia)
   */
  private static formatNumber(val: any): string {
    if (val === undefined || val === null || val === '') return '0';
    if (typeof val === 'number') {
      return Number.isInteger(val)
        ? val.toLocaleString('id-ID')
        : val.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // If it already has Indonesian thousand separator like 14.942, return as is
      if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
        return trimmed;
      }
      // If it is integer string like "14942"
      if (/^\d+$/.test(trimmed)) {
        return Number(trimmed).toLocaleString('id-ID');
      }
      // If it is float string like "14942.5"
      if (/^\d+\.\d+$/.test(trimmed)) {
        return Number(trimmed).toLocaleString('id-ID', { maximumFractionDigits: 2 });
      }
      return trimmed;
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
      month: 'long',
      year: 'numeric',
    });
    const shortDateFormatted = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = `${now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })} WIB`;

    const generatedAtStr =
      raw.generated_at ||
      raw.generatedAt ||
      `${dateFormatted} ${timeFormatted}`;

    const city =
      raw.target_city ||
      raw.targetCity ||
      raw.city ||
      raw.targetKota ||
      raw.target_kota ||
      raw.kota ||
      'SEMUA WILAYAH';

    const branch = raw.branch || raw.cabang || 'SEMARANG';

    const dp =
      raw.pickup_dp ||
      raw.pickupDp ||
      raw.drop_point ||
      raw.dropPoint ||
      raw.dp ||
      '-';

    const user =
      raw.user ||
      raw.senderName ||
      raw.generated_by ||
      raw.generatedBy ||
      'Operator LTMS';

    // Metrik INC
    const totalInc =
      raw.total_inc ??
      raw.totalInc ??
      raw.total_package ??
      raw.totalPackage ??
      raw.total ??
      0;

    const clearTtd =
      raw.clear_ttd ??
      raw.clearTtd ??
      raw.clear ??
      raw.selesai_antar ??
      0;

    const pendingTtd =
      raw.pending_ttd ??
      raw.pendingTtd ??
      raw.pending_package ??
      raw.pendingPackage ??
      raw.belum ??
      raw.belum_ttd ??
      raw.sisa_antaran ??
      0;

    const overSla =
      raw.over_sla ??
      raw.overSla ??
      raw.late ??
      raw.lewat_sla ??
      raw.lewatSla ??
      0;

    const slaPercentage =
      raw.sla_percentage ??
      raw.slaPercentage ??
      raw.progress ??
      raw.percent ??
      0;

    // Metrik Delivery
    const totalArrived =
      raw.total_arrived ??
      raw.totalArrived ??
      raw.totalSampai ??
      raw.total_sampai ??
      raw.sampai ??
      0;

    const totalDelivery =
      raw.total_delivery ??
      raw.totalDelivery ??
      raw.totalAntaran ??
      raw.total_antaran ??
      0;

    const deliveryPercentage =
      raw.delivery_percentage ??
      raw.deliveryPercentage ??
      raw.progressDelivery ??
      raw.pencapaian ??
      0;

    // Last Scan
    const lastScanTime = raw.last_scan_time || raw.lastScanTime || raw.scan_time || '';
    const lastScanAwb = raw.last_scan_awb || raw.lastScanAwb || raw.scan_awb || raw.awb || '';
    const lastScanStatus = raw.last_scan_status || raw.lastScanStatus || raw.scan_status || raw.status || '';

    // Kecamatan List
    let districtListStr =
      raw.destination_subdistricts ||
      raw.district_list ||
      raw.top_kecamatan ||
      raw.districtList ||
      '';

    if (Array.isArray(raw.topKecamatan)) {
      districtListStr = raw.topKecamatan
        .map((k: any, i: number) => {
          const name = typeof k === 'string' ? k : k.name || k.kecamatan || `Kecamatan ${i + 1}`;
          const count = typeof k === 'object' && k.count !== undefined ? ` (${k.count} AWB)` : '';
          return `${i + 1}. ${name}${count}`;
        })
        .join('\n');
    }

    const defaultFooter =
      'LTMS\nLong Tail Monitoring System\nGenerated Automatically';

    return {
      // Wilayah
      pickup_dp: String(dp),
      pickupDp: String(dp),
      drop_point: String(dp),
      dropPoint: String(dp),
      dp: String(dp),
      target_city: String(city),
      targetCity: String(city),
      city: String(city),
      target_kota: String(city),
      branch: String(branch),
      cabang: String(branch),
      user: String(user),
      generated_by: String(user),

      // Waktu
      generated_at: generatedAtStr,
      generatedAt: generatedAtStr,
      today: raw.today || shortDateFormatted,
      time: raw.time || timeFormatted,
      generated_date: raw.generated_date || raw.generatedDate || shortDateFormatted,
      generated_time: raw.generated_time || raw.generatedTime || timeFormatted,

      // Metrik INC
      total_inc: this.formatNumber(totalInc),
      totalInc: this.formatNumber(totalInc),
      total_package: this.formatNumber(totalInc),
      total: this.formatNumber(totalInc),
      clear_ttd: this.formatNumber(clearTtd),
      clearTtd: this.formatNumber(clearTtd),
      clear: this.formatNumber(clearTtd),
      pending_ttd: this.formatNumber(pendingTtd),
      pendingTtd: this.formatNumber(pendingTtd),
      pending_package: this.formatNumber(pendingTtd),
      belum: this.formatNumber(pendingTtd),
      over_sla: this.formatNumber(overSla),
      overSla: this.formatNumber(overSla),
      late: this.formatNumber(overSla),
      sla_percentage: String(slaPercentage),
      slaPercentage: String(slaPercentage),
      progress: String(slaPercentage),
      percent: String(slaPercentage),

      // Metrik Delivery
      total_arrived: this.formatNumber(totalArrived),
      totalArrived: this.formatNumber(totalArrived),
      total_delivery: this.formatNumber(totalDelivery),
      totalDelivery: this.formatNumber(totalDelivery),
      delivery_percentage: String(deliveryPercentage),
      deliveryPercentage: String(deliveryPercentage),

      // Last Scan
      last_scan_time: lastScanTime,
      lastScanTime: lastScanTime,
      last_scan_awb: lastScanAwb,
      lastScanAwb: lastScanAwb,
      last_scan_status: lastScanStatus,
      lastScanStatus: lastScanStatus,

      // Kecamatan
      destination_subdistricts: districtListStr || '-',
      district_list: districtListStr || '-',
      top_kecamatan: districtListStr || '-',

      // Image & Footer
      monitoring_image: raw.monitoring_image || raw.monitoringImage || '',
      footer: raw.footer || defaultFooter,
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
      // Cari di normalized dengan exact match atau lowercase
      if (normalized[key] !== undefined) {
        return normalized[key];
      }
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
