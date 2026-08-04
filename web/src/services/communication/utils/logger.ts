import { insertCommunicationLog } from '@/lib/data/supabase/communication';
import { CommunicationChannel, CommunicationMessageType } from '../communication.types';

export interface CommunicationLogParams {
  channel: CommunicationChannel;
  chatId: string;
  messageType: CommunicationMessageType;
  status: 'SUCCESS' | 'FAILED';
  error?: string | null;
  responseTimeMs: number;
  senderEmail?: string | null;
  payloadSummary?: Record<string, any> | null;
}

export class CommunicationLogger {
  /**
   * Mencatat aktivitas pengiriman pesan ke konsol dan database Supabase.
   */
  static async log(params: CommunicationLogParams): Promise<void> {
    const timestamp = new Date().toISOString();
    const prefix = `[CommunicationCenter][${params.channel.toUpperCase()}][${params.status}]`;

    if (params.status === 'SUCCESS') {
      console.log(
        `${prefix} Message sent to chatId: ${params.chatId} in ${params.responseTimeMs}ms (${timestamp})`
      );
    } else {
      console.error(
        `${prefix} Failed to send message to chatId: ${params.chatId} after ${params.responseTimeMs}ms. Error: ${params.error} (${timestamp})`
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
        payload_summary: params.payloadSummary || null,
      });
    } catch (dbErr) {
      console.warn('[CommunicationLogger] Could not persist log to DB:', dbErr);
    }
  }
}
