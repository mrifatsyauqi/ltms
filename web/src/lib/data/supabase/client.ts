import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Klien Supabase SERVER-ONLY memakai service_role key (bypass RLS). JANGAN
 * pernah impor ini dari komponen client. Singleton per proses (lambda warm).
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  // Buang trailing slash: "https://x.supabase.co/" -> jadi "//rest/v1" (double
  // slash) yang ditolak Supabase ("Invalid path specified in request URL").
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di environment');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
