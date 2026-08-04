import type {
  FeishuInteractiveCard,
  MonitoringIncSummaryData,
} from '../../communication.types';
import { FeishuCardBuilder } from './card.builder';

export class FeishuCardService {
  /**
   * Menghasilkan Interactive Card Feishu untuk Laporan Monitoring INC sesuai spesifikasi LTMS.
   */
  public generateMonitoringIncCard(
    data: MonitoringIncSummaryData,
    imageKey?: string
  ): FeishuInteractiveCard {
    return FeishuCardBuilder.createMonitoringIncCard(data, imageKey);
  }
}

export const feishuCardService = new FeishuCardService();
