"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-center text-sm text-brand-text">
        Check your email to confirm your account, then{" "}
        <Link href="/login" className="text-brand-deep-blue hover:underline">
          sign in
        </Link>
        .
      </p>
    );
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-control border border-brand-border px-3 py-2 outline-none focus:border-brand-blue"
          />
        </label>
        {error && <p className="text-sm text-status-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-brand-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-deep-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
