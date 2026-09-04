"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8 || !/\d/.test(password)) {
      setError("Password must be at least 8 characters and include a number.");
      return;
    }

    if (!acceptedTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSubmitted(true);
  }

  async function handleGoogleSignUp() {
    setError(null);
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/dashboard");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-[1.65rem] font-extrabold text-brand-navy">
          Check your email
        </h1>
        <p className="text-sm leading-6 text-brand-text-muted">
          Confirm your account, then{" "}
          <Link href="/login" className="font-bold text-brand-blue hover:underline">
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-center text-[1.65rem] font-extrabold leading-tight text-brand-navy">
        Create your account
      </h1>
      <p className="mb-6 text-center text-[0.92rem] text-brand-text-muted">
        Join RxTracker and take control of your medications.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[0.87rem] font-bold text-brand-text">
          Full name
          <span className="relative block">
            <User
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              required
              autoComplete="name"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-control border-[1.5px] border-brand-border bg-white py-3 pl-11 pr-4 text-[0.95rem] font-normal text-brand-text outline-none transition placeholder:text-brand-text-muted/75 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
          </span>
        </label>

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
              minLength={8}
              autoComplete="new-password"
              placeholder="Create a password"
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
          <p className="mt-1 text-xs text-brand-text-muted">
            Must be at least 8 characters and include a number.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.87rem] font-bold text-brand-text">
            Confirm password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted"
              aria-hidden="true"
            />
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-control border-[1.5px] border-brand-border bg-white py-3 pl-11 pr-12 text-[0.95rem] text-brand-text outline-none transition placeholder:text-brand-text-muted/75 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute inset-y-0 right-3 flex items-center text-brand-text-muted hover:text-brand-deep-blue"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-xs text-brand-text-muted">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-brand-border text-brand-blue"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-bold text-brand-blue hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-bold text-brand-blue hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
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
        onClick={handleGoogleSignUp}
      >
        <span aria-hidden="true" className="font-bold text-[#4285f4]">
          G
        </span>
        Sign up with Google
      </Button>

      <p className="mt-7 text-center text-sm text-brand-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
