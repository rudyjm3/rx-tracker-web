import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Only the account owner's onboarding gates these two entry points — a
// brand-new account has zero medications and nothing useful to show on
// /dashboard. Family-member onboarding never hard-blocks navigation (see
// ResumeSetupBanner instead); the rest of the app stays fully usable
// while a family member's setup is incomplete.
const ONBOARDING_GATED_PATHS = ["/", "/dashboard"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase isn't configured yet — skip the redirect so the app stays
    // navigable until real credentials are set.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && ONBOARDING_GATED_PATHS.includes(request.nextUrl.pathname)) {
    const [{ data: onboarding }, { count: activeCount }] = await Promise.all([
      supabase
        .from("profile_onboarding")
        .select("status")
        .is("profile_id", null)
        .maybeSingle(),
      supabase
        .from("medications")
        .select("id", { count: "exact", head: true })
        .is("profile_id", null)
        .eq("active", true),
    ]);

    const status = onboarding?.status ?? "not_started";
    const needsOnboarding = status !== "completed" && status !== "skipped" && !activeCount;

    if (needsOnboarding) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      const redirectResponse = NextResponse.redirect(onboardingUrl);
      // Carry over any session cookie rotated by getUser() above — unlike
      // the !user branch (nothing to carry for an anonymous request),
      // this redirect is for an authenticated request and dropping a
      // just-rotated cookie here would desync the client's session.
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      }
      return redirectResponse;
    }
  }

  return response;
}
