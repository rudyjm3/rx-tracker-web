// Helpers for building post-auth redirects. Kept free of Next/Supabase
// imports so they can be unit-tested with `node --test`.

export const DEFAULT_AUTH_REDIRECT = "/dashboard";

/**
 * Returns `raw` only if it is a same-site absolute path ("/medications",
 * "/profile?tab=x"); otherwise the default. Rejects protocol-relative
 * ("//evil.com"), backslash ("/\\evil.com"), absolute ("https://…"),
 * and userinfo-style ("@evil.com") values, which would otherwise turn
 * `${origin}${next}` into a redirect to another host.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = DEFAULT_AUTH_REDIRECT): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Control characters (tabs/newlines) are stripped by URL parsers and can
  // turn "/\t/evil.com" into "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

/**
 * The public origin the browser used to reach the app. Behind a reverse
 * proxy (Hostinger), `new URL(request.url).origin` is the Node server's
 * bind address (e.g. https://0.0.0.0:3000), not the public host, so an
 * absolute redirect built from it sends the user somewhere unreachable.
 *
 * Order: NEXT_PUBLIC_SITE_URL (if set) → X-Forwarded-Host/Proto → Host →
 * request.url's origin.
 */
export function publicOrigin(request: Request, siteUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      // Misconfigured env value — fall through to the request headers.
    }
  }

  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host")?.trim();
  if (host) {
    const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const requestProto = new URL(request.url).protocol.replace(":", "");
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : requestProto;
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
