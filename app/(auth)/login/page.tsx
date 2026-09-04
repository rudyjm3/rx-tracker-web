"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", redirectTo);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div>
      <h1 className="mb-1 text-[1.65rem] font-extrabold text-brand-text">
        Welcome back!
      </h1>
      <p className="mb-7 text-[0.92rem] text-brand-text-muted">
        Sign in to your account
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-[1.1rem]">
        <label className="flex flex-col gap-1.5 text-[0.87rem] font-bold text-brand-text">
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-control border-[1.5px] border-brand-border bg-brand-bg px-4 py-3 text-[0.95rem] font-normal text-brand-text outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
          />
        </label>

        <div>
          <label className="mb-1.5 block text-[0.87rem] font-bold text-brand-text">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-control border-[1.5px] border-brand-border bg-brand-bg px-4 py-3 pr-12 text-[0.95rem] text-brand-text outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-3 flex items-center text-brand-text-muted hover:text-brand-deep-blue"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <Link
            href="/forgot-password"
            className="mt-1.5 block text-right text-[0.84rem] font-semibold text-brand-blue hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[0.88rem] font-semibold text-brand-text">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-brand-border text-brand-blue"
          />
          Remember me for 30 days
        </label>

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-2 text-xs font-semibold uppercase text-brand-text-muted">
        <div className="h-px flex-1 bg-brand-border" />
        or
        <div className="h-px flex-1 bg-brand-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGoogleSignIn}
      >
        <span aria-hidden="true" className="font-bold">
          G
        </span>
        Continue with Google
      </Button>

      <p className="mt-7 text-center text-sm text-brand-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-bold text-brand-blue hover:underline">
          Sign up
        </Link>
      </p>

      <p className="mt-2 text-center text-xs text-brand-text-muted">
        <Link href="/terms" className="text-brand-blue hover:underline">
          Terms of Use
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="text-brand-blue hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
