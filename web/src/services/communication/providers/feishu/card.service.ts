import type {
  FeishuInteractiveCard,
  GenericReportData,
  MonitoringIncSummaryData,
} from '../../communication.types';
import { FeishuCardBuilder } from './card.builder';

export class FeishuCardService {
  /**
   * Menghasilkan Interactive Card Feishu untuk Laporan Monitoring INC.
   */
  public generateMonitoringIncCard(
    data: MonitoringIncSummaryData,
    imageKey?: string
  ): FeishuInteractiveCard {
    return FeishuCardBuilder.createMonitoringIncCard(data, imageKey);
  }

  /**
   * Menghasilkan Interactive Card Feishu secara modular dan dinamis sesuai module pemanggil.
   */
  public generateCard(
    data: GenericReportData,
    imageKey?: string
  ): FeishuInteractiveCard {
    switch (data.module) {
      case 'monitoring_inc':
        return FeishuCardBuilder.createMonitoringIncCard(data, imageKey);
      case 'monitoring_delivery':
        return FeishuCardBuilder.createDeliveryCard(data, imageKey);
      case 'dashboard':
        return FeishuCardBuilder.createDashboardCard(data, imageKey);
      case 'longtail':
        return FeishuCardBuilder.createLongtailCard(data, imageKey);
      default:
        // Default / Generic Report Card
        if (data.total !== undefined && data.targetKota && !data.title) {
          return FeishuCardBuilder.createMonitoringIncCard(data, imageKey);
        }
        return FeishuCardBuilder.createGenericReportCard(data, imageKey);
    }
  }
}

export const feishuCardService = new FeishuCardService();
