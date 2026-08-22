import { createBrowserClient } from "@supabase/ssr";

// Falls back to placeholder values when Supabase isn't configured yet, so
// the client can always be constructed. Calls against the placeholder URL
// fail as a normal network error (surfaced via each method's `error`
// return value) rather than throwing at construction time.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
  );
}
