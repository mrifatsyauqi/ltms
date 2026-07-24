type AppsScriptEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string; data?: unknown };

export class AppsScriptError extends Error {
  code: string;
  /** Payload opsional dari backend, mis. baris terkini pada VERSION_CONFLICT. */
  data?: unknown;

  constructor(code: string, message?: string, data?: unknown) {
    super(message || code);
    this.code = code;
    this.data = data;
    this.name = 'AppsScriptError';
  }
}

/**
 * Calls the Fase 2 doPost dispatcher in apps-script/Code.gs. Server-side only
 * — the shared secret never reaches the browser. `params.email` must always
 * be the caller's own session email (never client-supplied), since Code.gs
 * re-derives role/Drop Point from the Users sheet using that email.
 */
export async function callAppsScript<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const baseUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!baseUrl || !secret) {
    throw new Error('APPS_SCRIPT_URL / APPS_SCRIPT_SHARED_SECRET belum diset di environment');
  }

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...params, action, secret }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new AppsScriptError('HTTP_ERROR', `Apps Script merespons HTTP ${res.status}`);
  }

  const envelope = (await res.json()) as AppsScriptEnvelope<T>;
  if (!envelope.ok) {
    throw new AppsScriptError(envelope.error, envelope.message, envelope.data);
  }
  return envelope.data;
}
