import {
  toCardTemplateDTO,
  normalizeFeishuGroup,
  toMentionDTO,
  type CardTemplateDTO,
  type CardTemplateCreateDTO,
  type CardTemplateUpdateDTO,
  type CardTemplateVersionDTO,
  type NormalizedFeishuGroup,
  type MentionDTO,
} from './dto';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
  status: number;
}

export class CommunicationApiClient {
  /**
   * Generic request handler that guarantees a normalized ApiResponse envelope.
   */
  public async request<T = any>(
    endpoint: string,
    init?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
        ...init,
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      const isHttpOk = res.ok;
      const isPayloadSuccess = json?.success !== undefined ? Boolean(json.success) : (json?.ok !== undefined ? Boolean(json.ok) : isHttpOk);
      const success = isHttpOk && isPayloadSuccess;
      const data = json?.data !== undefined ? json.data : (json?.result !== undefined ? json.result : json);
      const error = !success ? (json?.error || json?.message || `HTTP ${res.status}: ${res.statusText}`) : undefined;
      const message = json?.message;

      return {
        success,
        data: (data as T),
        error,
        message,
        status: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: err.message || 'Kesalahan jaringan atau server tidak merespons',
        status: 0,
      };
    }
  }

  public async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public async put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return this.request<T>(url, { method: 'DELETE' });
  }

  // ==========================================================================
  // Domain Specific Endpoints
  // ==========================================================================

  public cardTemplates = {
    list: async (params?: { module?: string; status?: string; include_archived?: boolean }): Promise<ApiResponse<CardTemplateDTO[]>> => {
      const queryParams: Record<string, any> = {};
      if (params?.module && params.module !== 'all') queryParams.module = params.module;
      if (params?.status) queryParams.status = params.status;
      if (params?.include_archived) queryParams.status = 'all';

      const res = await this.get<any[]>('/api/communication/templates/card', queryParams);
      if (res.success && Array.isArray(res.data)) {
        return {
          ...res,
          data: res.data.map(toCardTemplateDTO),
        };
      }
      return { ...res, data: [] };
    },

    get: async (id: string): Promise<ApiResponse<CardTemplateDTO | null>> => {
      const res = await this.get<any>(`/api/communication/templates/card/${id}`);
      if (res.success && res.data) {
        return { ...res, data: toCardTemplateDTO(res.data) };
      }
      return { ...res, data: null };
    },

    create: async (dto: CardTemplateCreateDTO): Promise<ApiResponse<CardTemplateDTO>> => {
      const res = await this.post<any>('/api/communication/templates/card', dto);
      if (res.success && res.data) {
        return { ...res, data: toCardTemplateDTO(res.data) };
      }
      return res;
    },

    update: async (id: string, dto: CardTemplateUpdateDTO): Promise<ApiResponse<CardTemplateDTO>> => {
      const res = await this.put<any>(`/api/communication/templates/card/${id}`, { id, ...dto });
      if (res.success && res.data) {
        return { ...res, data: toCardTemplateDTO(res.data) };
      }
      return res;
    },

    setDefault: async (id: string): Promise<ApiResponse<boolean>> => {
      return this.post<boolean>(`/api/communication/templates/card/${id}/set-default`);
    },

    archive: async (id: string): Promise<ApiResponse<boolean>> => {
      return this.post<boolean>(`/api/communication/templates/card/${id}/archive`);
    },

    restore: async (id: string): Promise<ApiResponse<boolean>> => {
      return this.post<boolean>(`/api/communication/templates/card/${id}/restore`);
    },

    duplicate: async (id: string): Promise<ApiResponse<CardTemplateDTO>> => {
      const res = await this.post<any>(`/api/communication/templates/card/${id}/duplicate`);
      if (res.success && res.data) {
        return { ...res, data: toCardTemplateDTO(res.data) };
      }
      return res;
    },

    getVersions: async (id: string): Promise<ApiResponse<CardTemplateVersionDTO[]>> => {
      const res = await this.get<any[]>(`/api/communication/templates/card/${id}/versions`);
      if (res.success && Array.isArray(res.data)) {
        return {
          ...res,
          data: res.data.map((v) => ({
            id: v.id,
            card_template_id: v.card_template_id,
            version: v.version || v.version_number || 'v1.0',
            version_number: v.version || v.version_number || 'v1.0',
            blocks_config: v.blocks_config || {},
            note: v.note || v.version_note || v.change_summary || '',
            created_at: v.created_at,
          })),
        };
      }
      return { ...res, data: [] };
    },

    rollback: async (id: string, versionId: string): Promise<ApiResponse<boolean>> => {
      return this.post<boolean>(`/api/communication/templates/card/${id}/rollback/${versionId}`);
    },
  };

  public groups = {
    list: async (): Promise<ApiResponse<NormalizedFeishuGroup[]>> => {
      const res = await this.get<any[]>('/api/communication/groups');
      if (res.success && Array.isArray(res.data)) {
        return {
          ...res,
          data: res.data.map(normalizeFeishuGroup),
        };
      }
      return { ...res, data: [] };
    },

    sync: async (): Promise<ApiResponse<NormalizedFeishuGroup[]>> => {
      const res = await this.post<any[]>('/api/communication/groups');
      if (res.success && Array.isArray(res.data)) {
        return {
          ...res,
          data: res.data.map(normalizeFeishuGroup),
        };
      }
      return { ...res, data: [] };
    },

    setDefault: async (chatId: string): Promise<ApiResponse<boolean>> => {
      return this.put<boolean>('/api/communication/groups', { chatId, isDefault: true });
    },

    toggleStatus: async (chatId: string, status: 'active' | 'disconnected'): Promise<ApiResponse<boolean>> => {
      return this.put<boolean>('/api/communication/groups', { chatId, status });
    },
  };

  public mentions = {
    list: async (params?: { scope_type?: string; search?: string; is_active?: boolean }): Promise<ApiResponse<MentionDTO[]>> => {
      const res = await this.get<any[]>('/api/communication/mentions', params);
      if (res.success && Array.isArray(res.data)) {
        return {
          ...res,
          data: res.data.map(toMentionDTO),
        };
      }
      return { ...res, data: [] };
    },

    create: async (dto: Partial<MentionDTO>): Promise<ApiResponse<MentionDTO>> => {
      const res = await this.post<any>('/api/communication/mentions', dto);
      if (res.success && res.data) {
        return { ...res, data: toMentionDTO(res.data) };
      }
      return res;
    },

    update: async (id: string, dto: Partial<MentionDTO>): Promise<ApiResponse<MentionDTO>> => {
      const res = await this.put<any>(`/api/communication/mentions/${id}`, dto);
      if (res.success && res.data) {
        return { ...res, data: toMentionDTO(res.data) };
      }
      return res;
    },

    delete: async (id: string): Promise<ApiResponse<boolean>> => {
      return this.delete<boolean>(`/api/communication/mentions/${id}`);
    },

    bulkCreate: async (items: Partial<MentionDTO>[]): Promise<ApiResponse<MentionDTO[]>> => {
      const res = await this.post<any[]>('/api/communication/mentions', { bulk: true, items });
      if (res.success && Array.isArray(res.data)) {
        return { ...res, data: res.data.map(toMentionDTO) };
      }
      return { ...res, data: [] };
    },

    validateOpenId: async (openId: string): Promise<ApiResponse<{ valid: boolean; name?: string; message?: string }>> => {
      return this.post('/api/communication/mentions/validate', { openId });
    },
  };

  public logs = {
    list: async (params?: { limit?: number }): Promise<ApiResponse<any[]>> => {
      return this.get<any[]>('/api/communication/logs', params);
    },
  };

  public send = {
    sendCard: async (payload: {
      channel?: string;
      chatId: string;
      messageType?: string;
      cardConfig?: any;
      cardTemplateId?: string;
      data?: Record<string, any>;
      textContent?: string;
    }): Promise<ApiResponse<any>> => {
      return this.post('/api/communication/send', payload);
    },
  };
}

export const communicationApi = new CommunicationApiClient();
