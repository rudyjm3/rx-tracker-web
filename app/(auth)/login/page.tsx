"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-brand-text">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-control border border-brand-border px-3 py-2 outline-none focus:border-brand-blue"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-text">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-control border border-brand-border px-3 py-2 outline-none focus:border-brand-blue"
          />
        </label>
        <div className="text-right text-sm">
          <Link
            href="/forgot-password"
            className="text-brand-deep-blue hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-sm text-status-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-2 text-xs text-brand-text-muted">
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
        Continue with Google
      </Button>

      <p className="text-center text-sm text-brand-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-brand-deep-blue hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
