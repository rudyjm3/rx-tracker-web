"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getOnboardingProgress } from "@/lib/onboarding";
import { getActiveMedications } from "@/lib/medications";

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

  // Medications can exist for a profile without a completed
  // profile_onboarding row (e.g. a data migration/import that calls
  // createMedication directly instead of going through the onboarding
  // wizard's activateOnboarding). Treat "already has medications" as done
  // too, so the banner doesn't nudge someone to "finish" setup that's
  // already finished.
  const medicationsQuery = useQuery({
    queryKey: ["active-medications", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });

  if (isResolving || progressQuery.isLoading || medicationsQuery.isLoading) return null;
  const hasMedications = (medicationsQuery.data?.length ?? 0) > 0;
  if (progressQuery.data?.status === "completed" || hasMedications) return null;

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
