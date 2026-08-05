'use client';

import { useEffect, useState } from 'react';

/** Fetch helper seragam utk Communication Center - SEMUA route
 *  api/communication/* mengembalikan amplop { ok, data, error } (konsisten
 *  dgn lib/api-response.ts yang dipakai seluruh app) - throw kalau ok=false
 *  supaya React Query onError/isError bekerja tanpa perlu cek manual di
 *  tiap caller. */
export async function commApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || body.message || 'Request gagal');
  return body.data as T;
}

export interface CardPreviewRequest {
  module: string;
  cardConfig?: Record<string, any>;
  cardTemplateId?: string;
  data?: Record<string, any>;
  imageKey?: string;
}

export interface CardPreviewResult {
  cardJson: Record<string, any>;
  blocksConfig: Record<string, any>;
}

/** Calls the single server-side compiler (CardRenderPipeline -> CardCompilerService).
 *  Used identically by Card Builder Preview, Share Dialog Preview, and History Preview
 *  so the compiled JSON they render can never diverge. */
export function compileCardPreview(req: CardPreviewRequest): Promise<CardPreviewResult> {
  return commApi<CardPreviewResult>('/api/communication/card-templates/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

/** Debounces a fast-changing value (e.g. Builder form state) so dependent
 *  effects/queries (like calling /preview) don't fire on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
