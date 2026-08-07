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

/**
 * Preview-only placeholder attachment. The compile-preview endpoint never
 * has a real Feishu-uploaded image (that only exists on the actual send
 * path, after uploading to Feishu - see message.service.ts), so without
 * SOME truthy imageKey, CardCompilerService silently omits the screenshot
 * block entirely (not even a placeholder) whenever `showScreenshot` is on.
 * Passing this mock key/url pair to compileCardPreview() + InteractiveCardPreview
 * keeps Card Builder and Share Dialog "Live Preview Card" visually
 * representative of what a real send will look like, without claiming to
 * be a real report screenshot. The actual value of imageKey is otherwise
 * unused by the preview renderer (it only reads imagePreviewUrl).
 */
export const PREVIEW_MOCK_IMAGE_KEY = 'preview_mock_attachment';
export const PREVIEW_MOCK_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="338" viewBox="0 0 600 338">
    <rect width="600" height="338" fill="#0f172a"/>
    <g fill="none" stroke="#64748b" stroke-width="2">
      <rect x="220" y="120" width="160" height="110" rx="8"/>
      <circle cx="255" cy="150" r="10"/>
      <path d="M220 210 l40-40 30 30 40-50 50 60"/>
    </g>
    <text x="300" y="270" font-family="sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">Preview Lampiran Monitoring</text>
  </svg>`
)}`;

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
