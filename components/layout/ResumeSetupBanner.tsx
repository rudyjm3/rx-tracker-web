"use client";

import Link from "next/link";
import { ClipboardList, X } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { setupLabel, useResumeSetup } from "@/components/layout/useResumeSetup";
import { useSessionDismissal } from "@/components/layout/useSessionDismissal";

// Persistent nudge for whichever profile is currently active (owner or a
// family member) — shown wherever it's mounted (TopNav, everywhere except
// /settings) whenever that profile hasn't finished onboarding. Distinct
// from the middleware's hard redirect, which only ever applies to the
// account owner on / and /dashboard; this banner is the only mechanism
// nudging a family member (or an owner who explicitly skipped) back in.
// The X hides it until the app is next opened; the matching notification
// in the bell stays until setup is finished.
export function ResumeSetupBanner() {
  const { user } = useAuth();
  const { activeProfileId } = useActiveProfile();
  const { needsSetup, name } = useResumeSetup();
  const [dismissed, dismiss] = useSessionDismissal(
    `rxtracker-resume-setup-dismissed:${activeProfileId ?? user?.id ?? "self"}`,
  );

  if (!needsSetup || dismissed) return null;

  return (
    <div className="border-b border-brand-border bg-status-warning/10">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm text-brand-text">
        <ClipboardList size={16} className="shrink-0 text-status-warning" />
        <span className="flex-1">Finish setting up {setupLabel(name)} medications.</span>
        <Link href="/onboarding" className="font-medium text-brand-deep-blue hover:underline">
          Resume setup
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup reminder"
          className="rounded-full p-1 text-brand-text-muted hover:bg-brand-bg"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
