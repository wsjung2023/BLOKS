// @bloks/db — singleton Supabase service-role client for server-side DB access
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url =
    process.env['SUPABASE_URL'] ??
    process.env['NEXT_PUBLIC_SUPABASE_URL'];

  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anonKey =
    process.env['SUPABASE_ANON_KEY'] ??
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ??
    process.env['SUPABASE_PUBLISHABLE_KEY'];

  const key = serviceRoleKey ?? anonKey;

  if (!url || !key) {
    throw new Error(
      '[db] Missing Supabase credentials. Set SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY.'
    );
  }

  if (!serviceRoleKey) {
    console.warn('[db] SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to anon/publishable key; write operations may fail due to RLS.');
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export type { SupabaseClient };
