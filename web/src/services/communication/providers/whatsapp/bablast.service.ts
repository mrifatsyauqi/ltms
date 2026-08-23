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

export interface BablastBulkResponseData {
  blast_id: number;
  group_id: number;
  group_code: string;
  total_contacts: number;
  imported: number;
  failed: number;
  status: string;
  active_senders: number;
  sender_distribution: any;
}

export interface BablastBulkResponse {
  success: boolean;
  message?: string;
  data?: BablastBulkResponseData;
}

export class BablastService {
  private async getHeaders() {
    const { apiKey, isConfigured } = await getBablastCredentials();
    if (!isConfigured) {
      throw new ApiError('500', 'Bablast API Key is not configured');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  private async getSdkClient(): Promise<BablastClient> {
    const { apiKey, isConfigured } = await getBablastCredentials();
    if (!isConfigured) {
      throw new ApiError('500', 'Bablast API Key is not configured');
    }
    return new BablastClient({ apiKey });
  }

  private handleBablastError(status: number, message: string = ''): Error {
    switch (status) {
      case 401: return new ApiError('401', 'API Key invalid');
      case 403: return new ApiError('403', 'API Key tidak memiliki scope yang cukup');
      case 404: return new ApiError('404', 'Endpoint atau resource tidak ditemukan');
      case 409: return new ApiError('409', 'Sender atau proses pairing konflik');
      case 429: return new ApiError('429', 'Terlalu banyak request (Rate limit)');
      case 500: return new ApiError('500', 'Bablast server error');
      default: return new ApiError(String(status), message || 'Bablast provider error');
    }
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      // Use SDK to verify API Key scope & validity instead of guessing REST endpoint
      const client = new BablastClient({ apiKey });
      const senders = await client.wa.senders.list();
      
      // If no error is thrown, the API Key is valid
      return true;
    } catch (error: any) {
      console.error('Bablast test connection error:', error.message);
      
      // Attempt to map error message if possible
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('401') || msg.includes('unauthorized')) {
        throw this.handleBablastError(401);
      } else if (msg.includes('403') || msg.includes('forbidden')) {
        throw this.handleBablastError(403);
      }
      
      throw new ApiError('500', 'Gagal memvalidasi API Key ke Bablast: ' + (error.message || 'Unknown Error'));
    }
  }

  async listSenders(): Promise<any[]> {
    const { baseUrl } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const response = await fetchWithTimeout(`${baseUrl}/senders`, {
        method: 'GET',
        headers
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw this.handleBablastError(response.status, data.message);
      return data.data || [];
    } catch (error: any) {
      console.error('Failed to list Bablast senders via REST API:', error.message);
      throw new ApiError('500', 'Failed to fetch senders from Bablast');
    }
  }

  // =========================================================================
  // CORE CONNECTOR API
  // =========================================================================

  async requestPairing(phone: string, method: 'qr' | 'code'): Promise<any> {
    const { baseUrl } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const response = await fetchWithTimeout(`${baseUrl}/connector/pairing`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ method, phone })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw this.handleBablastError(response.status, data.message);
      }
      
      // Normalize PairingResponse -> PairingResult for frontend
      // Bablast returns the raw string in `data` (e.g. "https://wa.me/...")
      const result: any = { method };
      
      if (method === 'qr' && data.data) {
        result.qr = data.data; // Raw string to be rendered as QR Code by frontend
      } else if (method === 'code' && data.data) {
        result.pairing_code = data.data; // Assuming code is also returned here
      } else {
        // Fallback if structure is different
        result.qr = data.qr || data.qrCode || data.data;
        result.pairing_code = data.pairing_code || data.pairingCode || data.data;
      }
      
      return result;
    } catch (error) {
      console.error('Bablast pairing error:', error);
      throw error;
    }
  }

  async getSenderStatus(phone?: string): Promise<any> {
    const { baseUrl } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const url = phone ? `${baseUrl}/connector/status?phone=${phone}` : `${baseUrl}/connector/status`;
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw this.handleBablastError(response.status, data.message);
      return data;
    } catch (error) {
      console.error('Bablast status check error:', error);
      throw error;
    }
  }

  async logout(phone?: string): Promise<any> {
    const { baseUrl } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const response = await fetchWithTimeout(`${baseUrl}/connector/logout`, {
        method: 'POST',
        headers,
        body: phone ? JSON.stringify({ phone }) : undefined
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw this.handleBablastError(response.status, data.message);
      return data;
    } catch (error) {
      console.error('Bablast logout error:', error);
      throw error;
    }
  }

  // Legacy fallback status check
  async checkStatus(): Promise<boolean> {
    const { baseUrl, senderId } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const response = await fetchWithTimeout(`${baseUrl}/device/status?senderId=${senderId}`, {
        method: 'GET',
        headers
      });
      const data = await response.json().catch(() => ({}));
      return data?.status === 'connected' || data?.data?.status === 'connected';
    } catch (error) {
      console.error('Failed to check Bablast legacy status:', error);
      return false;
    }
  }

  async sendBulk(payload: BablastBulkRequest): Promise<BablastBulkResponse> {
    const { baseUrl } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const response = await fetchWithTimeout(`${baseUrl}/send/bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw this.handleBablastError(response.status, data.message);
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

  async sendTestMessage(payload: { phone: string, message: string, sender_code: string }): Promise<any> {
    const { baseUrl } = await getBablastCredentials();
    try {
      const headers = await this.getHeaders();
      const response = await fetchWithTimeout(`${baseUrl}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const data = await response.json().catch(() => ({}));
      
      // Do not throw Bablast error natively so the frontend can catch the exact 404
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data.message || `API Request failed with status ${response.status}`,
          data
        };
      }

      return {
        ok: true,
        status: response.status,
        data
      };
    } catch (error: any) {
      console.error('Bablast test send error:', error);
      return {
        ok: false,
        status: 500,
        error: error.message || 'Internal error'
      };
    }
  }
}

export const bablastService = new BablastService();
