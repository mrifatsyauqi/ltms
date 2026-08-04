import { insertCommunicationLog } from '@/lib/data/supabase/communication';
import type { CommunicationChannel, CommunicationMessageType } from '../communication.types';

export interface CommunicationLogParams {
  channel: CommunicationChannel;
  chatId: string;
  messageType: CommunicationMessageType;
  status: 'SUCCESS' | 'FAILED';
  error?: string | null;
  responseTimeMs: number;
  senderEmail?: string | null;
  payloadSummary?: Record<string, any> | null;
  requestId?: string;
  endpoint?: string;
  statusCode?: number;
  retryCount?: number;
  messageId?: string;
}

export class CommunicationLogger {
  /**
   * Mencatat aktivitas pengiriman pesan ke konsol dan database Supabase dengan metadata lengkap.
   */
  static async log(params: CommunicationLogParams): Promise<void> {
    const timestamp = new Date().toISOString();
    const prefix = `[CommunicationCenter][${params.channel.toUpperCase()}][${params.status}]`;

    const summary: Record<string, any> = {
      ...(params.payloadSummary || {}),
      requestId: params.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      endpoint: params.endpoint || '/im/v1/messages',
      statusCode: params.statusCode ?? (params.status === 'SUCCESS' ? 200 : 500),
      retryCount: params.retryCount || 0,
      messageId: params.messageId || null,
      timestamp,
    };

    if (params.status === 'SUCCESS') {
      console.log(
        `${prefix} Message ${summary.messageId || ''} to chat ${params.chatId} via ${summary.endpoint} [Status: ${summary.statusCode}] in ${params.responseTimeMs}ms (Req: ${summary.requestId})`
      );
    } else {
      console.error(
        `${prefix} Failed to send message to chat ${params.chatId} via ${summary.endpoint} [Status: ${summary.statusCode}] in ${params.responseTimeMs}ms (Req: ${summary.requestId}). Error: ${params.error}`
      );
    }

    try {
      await insertCommunicationLog({
        channel: params.channel,
        chat_id: params.chatId,
        message_type: params.messageType,
        status: params.status,
        error_message: params.error || null,
        response_time_ms: params.responseTimeMs,
        sender_email: params.senderEmail || null,
        payload_summary: summary,
      });
    } catch (dbErr) {
      console.warn('[CommunicationLogger] Could not persist log to DB:', dbErr);
    }
  }
}
