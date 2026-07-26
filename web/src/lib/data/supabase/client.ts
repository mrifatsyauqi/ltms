import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Klien Supabase SERVER-ONLY memakai service_role key (bypass RLS). JANGAN
 * pernah impor ini dari komponen client. Singleton per proses (lambda warm).
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  // Normalkan SUPABASE_URL ke base project ("https://<ref>.supabase.co"):
  // buang path "/rest/v1" bila ter-copy dari halaman Data API, dan trailing
  // slash. Keduanya bikin "Invalid path specified in request URL".
  const url = (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di environment');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
