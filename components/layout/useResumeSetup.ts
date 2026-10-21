"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getOnboardingProgress } from "@/lib/onboarding";
import { getActiveMedications } from "@/lib/medications";

// Shared by ResumeSetupBanner and the nav bell so both reflect the same
// "active profile hasn't finished onboarding" state.
export function useResumeSetup(): { needsSetup: boolean; name: string } {
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
  // too, so nobody is nudged to "finish" setup that's already finished.
  const medicationsQuery = useQuery({
    queryKey: ["active-medications", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });

  const loading = isResolving || progressQuery.isLoading || medicationsQuery.isLoading;
  const hasMedications = (medicationsQuery.data?.length ?? 0) > 0;
  const needsSetup =
    !loading && progressQuery.data?.status !== "completed" && !hasMedications;

  return { needsSetup, name: activeProfile?.display_name ?? "your" };
}

export function setupLabel(name: string): string {
  return name === "your" ? "your" : `${name}'s`;
}
