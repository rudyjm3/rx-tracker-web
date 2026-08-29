"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getOnboardingProgress } from "@/lib/onboarding";

// Persistent nudge for whichever profile is currently active (owner or a
// family member) — shown wherever it's mounted (TopNav, everywhere except
// /settings) whenever that profile hasn't finished onboarding. Distinct
// from the middleware's hard redirect, which only ever applies to the
// account owner on / and /dashboard; this banner is the only mechanism
// nudging a family member (or an owner who explicitly skipped) back in.
export function ResumeSetupBanner() {
  const { activeProfileId, activeProfile, isResolving } = useActiveProfile();

  const progressQuery = useQuery({
    queryKey: ["onboarding-progress", activeProfileId],
    queryFn: () => getOnboardingProgress(activeProfileId),
    enabled: !isResolving,
  });

  if (isResolving || progressQuery.isLoading) return null;
  if (progressQuery.data?.status === "completed") return null;

  const name = activeProfile?.display_name ?? "your";

  return (
    <div className="border-b border-brand-border bg-status-warning/10">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm text-brand-text">
        <ClipboardList size={16} className="shrink-0 text-status-warning" />
        <span className="flex-1">Finish setting up {name === "your" ? "your" : `${name}'s`} medications.</span>
        <Link href="/onboarding" className="font-medium text-brand-deep-blue hover:underline">
          Resume setup
        </Link>
      </div>
    </div>
  );
}
