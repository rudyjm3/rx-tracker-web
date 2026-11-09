import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin, safeRedirectPath } from "@/lib/auth-redirect";
import type { EmailOtpType } from "@supabase/supabase-js";

// Exchanges the PKCE `code` from an OAuth or email-link redirect for a
// session *before* the destination page loads, so proxy.ts's route guard
// sees an authenticated session by the time it evaluates the next request.
// Also handles token_hash-based flows (e.g. password recovery emails).
//
// Redirects are built from publicOrigin(), not request.url: behind
// Hostinger's reverse proxy request.url's origin is the Node bind address
// (https://0.0.0.0:3000), which the browser can't reach. `next` is limited
// to same-site paths so it can't be used as an open redirect.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Supabase appends error/error_description when the provider step fails
  // (e.g. the user cancelled on Google's consent screen); pass it through
  // so /login can show something more specific than a generic failure.
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth-callback-failed");
  const providerError = searchParams.get("error_description");
  if (providerError) loginUrl.searchParams.set("error_description", providerError);
  return NextResponse.redirect(loginUrl);
}
