import type {
  FeishuInteractiveCard,
  GenericReportData,
  MonitoringIncSummaryData,
} from '../../communication.types';
import { CardCompilerService } from '../../configuration/card-compiler.service';
import { STARTER_PRESETS } from '../../configuration/template-presets';

export class FeishuCardService {
  /**
   * Menghasilkan Interactive Card Feishu untuk Laporan Monitoring INC
   * Menggunakan CardCompilerService sebagai Single Source of Truth.
   */
  public generateMonitoringIncCard(
    data: MonitoringIncSummaryData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const preset = STARTER_PRESETS.find((p) => p.module === 'monitoring_inc') || STARTER_PRESETS[0];
    const cfg = JSON.parse(JSON.stringify(preset.blocksConfig));

    if (data.targetKota) {
      cfg.header.title = `LTMS • Monitoring INC ${data.targetKota.toUpperCase()}`;
    }

    const variables: Record<string, any> = {
      ...data,
      pickup_dp: 'BATANG01',
      target_city: data.targetKota || 'BATANG',
      total_inc: data.total !== undefined ? Number(data.total).toLocaleString('id-ID') : '0',
      clear_ttd: data.clear !== undefined ? Number(data.clear).toLocaleString('id-ID') : '0',
      pending_ttd: data.belum !== undefined ? Number(data.belum).toLocaleString('id-ID') : '0',
      over_sla: data.late !== undefined ? Number(data.late).toLocaleString('id-ID') : '0',
      sla_percentage: data.percent !== undefined ? String(data.percent) : '0',
      generated_at: data.generateTime || new Date().toLocaleString('id-ID'),
      subdistricts: data.topKecamatan
        ? data.topKecamatan.map((k) => ({ name: k, count: 'Perlu Follow Up' }))
        : [],
    };

    return CardCompilerService.compileCard(cfg, variables, imageKey) as FeishuInteractiveCard;
  }

  /**
   * Menghasilkan Interactive Card Feishu secara seragam melalui CardCompilerService.
   */
  public generateCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    const moduleName = data.module || 'monitoring_inc';
    const preset = STARTER_PRESETS.find((p) => p.module === moduleName) || STARTER_PRESETS[0];
    const cfg = JSON.parse(JSON.stringify(preset.blocksConfig));

    if (data.title) {
      cfg.header.title = data.title;
    } else if (data.targetScope?.name) {
      if (moduleName === 'dashboard') {
        cfg.header.title = `LTMS • Ringkasan Dashboard ${data.targetScope.name.toUpperCase()}`;
        cfg.theme = 'indigo';
      } else if (moduleName === 'longtail') {
        cfg.header.title = `LTMS • Laporan Long Tail ${data.targetScope.name.toUpperCase()}`;
        cfg.theme = 'orange';
      } else if (moduleName === 'monitoring_delivery') {
        cfg.header.title = `LTMS • Monitoring Delivery ${data.targetScope.name.toUpperCase()}`;
        cfg.theme = 'blue';
      }
    } else if (data.targetDp) {
      if (moduleName === 'longtail') {
        cfg.header.title = `LTMS • Laporan Long Tail ${data.targetDp.toUpperCase()}`;
        cfg.theme = 'orange';
      } else if (moduleName === 'monitoring_delivery') {
        cfg.header.title = `LTMS • Monitoring Delivery ${data.targetDp.toUpperCase()}`;
        cfg.theme = 'blue';
      }
    }

    if (data.headerTemplate) {
      cfg.theme = data.headerTemplate;
    }

    const variables: Record<string, any> = {
      ...data,
      total_inc: data.total !== undefined ? Number(data.total).toLocaleString('id-ID') : '0',
      total_delivery: data.total !== undefined ? Number(data.total).toLocaleString('id-ID') : '0',
      total_package: data.total !== undefined ? Number(data.total).toLocaleString('id-ID') : '0',
      clear_ttd: data.clear !== undefined ? Number(data.clear).toLocaleString('id-ID') : '0',
      delivered: data.clear !== undefined ? Number(data.clear).toLocaleString('id-ID') : '0',
      pending_ttd: data.belum !== undefined ? Number(data.belum).toLocaleString('id-ID') : '0',
      pending_delivery: data.belum !== undefined ? Number(data.belum).toLocaleString('id-ID') : '0',
      over_sla: data.late !== undefined ? Number(data.late).toLocaleString('id-ID') : '0',
      sla_percentage: data.percent !== undefined ? String(data.percent) : '0',
      delivery_sla: data.percent !== undefined ? String(data.percent) : '0',
      generated_at: data.generateTime || new Date().toLocaleString('id-ID'),
    };

    return CardCompilerService.compileCard(cfg, variables, imageKey) as FeishuInteractiveCard;
  }
}

export const feishuCardService = new FeishuCardService();
