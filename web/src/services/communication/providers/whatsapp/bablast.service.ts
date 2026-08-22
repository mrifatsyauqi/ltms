import { getBablastCredentials } from '../../communication.config';
import { ApiError } from '@/lib/errors';
import { fetchWithTimeout } from '../../utils/fetch-timeout';

export interface BablastBulkContact {
  nama: string;
  phone: string;
  variables: { key: string; value: string }[];
}

export interface BablastBulkRequest {
  group_name?: string;
  message: string;
  delay?: number;
  kode?: string;
  contacts: BablastBulkContact[];
}

export interface BablastBulkResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export class BablastService {
  private getHeaders() {
    const { apiKey, isConfigured } = getBablastCredentials();
    if (!isConfigured) {
      throw new ApiError('500', 'Bablast API Key is not configured');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  async checkStatus(): Promise<boolean> {
    const { baseUrl } = getBablastCredentials();
    try {
      const response = await fetchWithTimeout(`${baseUrl}/connector/status`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data?.status === 'connected' || data?.data?.status === 'connected';
    } catch (error) {
      console.error('Failed to check Bablast status:', error);
      return false;
    }
  }

  async sendBulk(payload: BablastBulkRequest): Promise<BablastBulkResponse> {
    const { baseUrl } = getBablastCredentials();
    try {
      const response = await fetchWithTimeout(`${baseUrl}/send/bulk`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data.message || 'Failed to send bulk message via Bablast', response.status);
      }

      return {
        success: true,
        message: data.message,
        data: data.data
      };
    } catch (error) {
      console.error('Bablast bulk send error:', error);
      throw error;
    }
  }
}

export const bablastService = new BablastService();
