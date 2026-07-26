/**
 * Error domain generik yang dipahami oleh errorResponse() (lib/api-response).
 * Dipakai lapisan data Supabase; `code` dipetakan ke status HTTP yang tepat.
 * (Layer Apps Script lama memakai AppsScriptError yang bentuknya sama.)
 */
export class ApiError extends Error {
  code: string;
  data?: unknown;

  constructor(code: string, message?: string, data?: unknown) {
    super(message || code);
    this.code = code;
    this.data = data;
    this.name = 'ApiError';
  }
}
