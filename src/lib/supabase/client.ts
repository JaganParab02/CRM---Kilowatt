import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedBrowserClient: any = null;

/**
 * Browser-side Supabase client singleton.
 * Uses the publishable/anon key — safe to use in client components.
 * Respects RLS policies and reuses a single instance across renders.
 */
export function createBrowserClient() {
  if (cachedBrowserClient) {
    return cachedBrowserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in .env.local'
    );
  }

  cachedBrowserClient = createClient(supabaseUrl, supabaseKey);
  return cachedBrowserClient;
}
