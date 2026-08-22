import { getBablastCredentials } from '../../communication.config';
import { ApiError } from '@/lib/errors';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { BablastClient } from '@bablast/client';

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
  sender_code?: string;
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

  private getSdkClient(): BablastClient {
    const { apiKey, isConfigured } = getBablastCredentials();
    if (!isConfigured) {
      throw new ApiError('500', 'Bablast API Key is not configured');
    }
    return new BablastClient({ apiKey });
  }

  async listSenders(): Promise<any[]> {
    try {
      const client = this.getSdkClient();
      const senders = await client.wa.senders.list();
      return senders || [];
    } catch (error) {
      console.error('Failed to list Bablast senders via SDK:', error);
      throw new ApiError('500', 'Failed to fetch senders from Bablast');
    }
  }

  // =========================================================================
  // CORE CONNECTOR API
  // =========================================================================

  async requestPairing(phone: string, method: 'qr' | 'code'): Promise<any> {
    const { baseUrl } = getBablastCredentials();
    try {
      const response = await fetchWithTimeout(`${baseUrl}/connector/pairing`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ method, phone })
      });
      const data = await response.json();
      if (!response.ok) throw new ApiError(String(response.status), data.message || 'Failed to request pairing');
      return data;
    } catch (error) {
      console.error('Bablast pairing error:', error);
      throw error;
    }
  }

  async getSenderStatus(phone?: string): Promise<any> {
    const { baseUrl } = getBablastCredentials();
    try {
      // API rule states GET /connector/status 
      // If the API requires phone, we append it, otherwise just hit the endpoint
      const url = phone ? `${baseUrl}/connector/status?phone=${phone}` : `${baseUrl}/connector/status`;
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Bablast status check error:', error);
      throw new ApiError('500', 'Failed to fetch sender status from Bablast');
    }
  }

  async logout(phone?: string): Promise<any> {
    const { baseUrl } = getBablastCredentials();
    try {
      const response = await fetchWithTimeout(`${baseUrl}/connector/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: phone ? JSON.stringify({ phone }) : undefined
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Bablast logout error:', error);
      throw error;
    }
  }

  // Legacy fallback status check
  async checkStatus(): Promise<boolean> {
    const { baseUrl, senderId } = getBablastCredentials();
    try {
      const response = await fetchWithTimeout(`${baseUrl}/device/status?senderId=${senderId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data?.status === 'connected' || data?.data?.status === 'connected';
    } catch (error) {
      console.error('Failed to check Bablast legacy status:', error);
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
        throw new ApiError(String(response.status), data.message || 'Failed to send bulk message via Bablast');
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
