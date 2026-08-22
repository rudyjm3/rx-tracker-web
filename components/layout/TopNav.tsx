"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/Button";

export function TopNav() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-brand-border bg-brand-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/icons/logo-round.png"
            alt="RxTracker"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="text-lg font-bold text-brand-navy">
            RxTracker
          </span>
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-brand-text hover:text-brand-deep-blue"
            >
              Dashboard
            </Link>
            <Link
              href="/medications"
              className="text-sm font-medium text-brand-text hover:text-brand-deep-blue"
            >
              Medications
            </Link>
            <span className="hidden text-sm text-brand-text-muted sm:inline">
              {user.email}
            </span>
            <Button variant="secondary" size="compact" onClick={signOut}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
