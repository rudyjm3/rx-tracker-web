"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
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
      <h1 className="mb-2 text-center text-[1.65rem] font-extrabold leading-tight text-brand-navy">
        Welcome back!
      </h1>
      <p className="mb-8 text-center text-[0.92rem] text-brand-text-muted">
        Sign in to continue tracking your medications.
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
          <span className="relative block">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted"
              aria-hidden="true"
            />
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-control border-[1.5px] border-brand-border bg-white py-3 pl-11 pr-4 text-[0.95rem] font-normal text-brand-text outline-none transition placeholder:text-brand-text-muted/75 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
          </span>
        </label>

        <div>
          <label className="mb-1.5 block text-[0.87rem] font-bold text-brand-text">
            Password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted"
              aria-hidden="true"
            />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-control border-[1.5px] border-brand-border bg-white py-3 pl-11 pr-12 text-[0.95rem] text-brand-text outline-none transition placeholder:text-brand-text-muted/75 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-3 flex items-center text-brand-text-muted hover:text-brand-deep-blue"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
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
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-2 text-xs font-semibold text-brand-text-muted">
        <div className="h-px flex-1 bg-brand-border" />
        or
        <div className="h-px flex-1 bg-brand-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full bg-white"
        onClick={handleGoogleSignIn}
      >
        <span aria-hidden="true" className="font-bold text-[#4285f4]">
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
    </div>
  );
}
