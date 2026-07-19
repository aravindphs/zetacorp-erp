/**
 * Supabase admin client using the service-role key (spec §46, §14).
 *
 * SERVER-ONLY. Bypasses Row Level Security, so it must never be imported into
 * client code. Used for privileged operations: creating user accounts,
 * admin-only password resets, and signed Storage URLs (spec §71).
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';

export function createSupabaseAdminClient() {
  const pub = publicEnv();
  const srv = serverEnv();

  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
