"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { getDrafts } from "@/lib/drafts";
import {
  getOnboardingProgress,
  saveOnboardingStep,
  skipOnboarding,
  type ReconcileMark,
} from "@/lib/onboarding";
import type { MedicationFormValues } from "@/components/medications/wizard/schema";
import type { OnboardingStep } from "@/lib/types/profile";
import { OnboardingProvider } from "./OnboardingContext";
import { buildTodayReconcileSlots } from "./reconcile";
import { StepMedications } from "./StepMedications";
import { StepTracking } from "./StepTracking";
import { StepSchedule } from "./StepSchedule";
import { StepInventory } from "./StepInventory";
import { StepReconcile } from "./StepReconcile";
import { StepActivate } from "./StepActivate";

const STEP_KEYS: OnboardingStep[] = [
  "medications",
  "tracking",
  "schedule",
  "inventory",
  "reconcile",
  "activate",
];
const STEP_LABELS = ["Medications", "Tracking", "Schedule", "Inventory", "Today", "Activate"];
const STEP_COMPONENTS = [
  StepMedications,
  StepTracking,
  StepSchedule,
  StepInventory,
  StepReconcile,
  StepActivate,
];

export function OnboardingShell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeProfileId, activeProfile, isResolving } = useActiveProfile();
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [reconcileMarks, setReconcileMarks] = useState<ReconcileMark[]>([]);
  const hasRedirected = useRef(false);

  const progressQuery = useQuery({
    queryKey: ["onboarding-progress", activeProfileId],
    queryFn: () => getOnboardingProgress(activeProfileId),
    enabled: !isResolving,
  });

  const draftsQuery = useQuery({
    queryKey: ["onboarding-drafts", activeProfileId],
    queryFn: () => getDrafts<MedicationFormValues>(activeProfileId),
    enabled: !isResolving,
  });

  // A direct revisit after finishing should bounce back to the dashboard
  // rather than re-showing a finished wizard. A "skipped" status is left
  // alone here — that's exactly the case the ResumeSetupBanner links
  // back into this page for.
  useEffect(() => {
    if (hasRedirected.current) return;
    if (progressQuery.data?.status === "completed") {
      hasRedirected.current = true;
      router.replace("/dashboard");
    }
  }, [progressQuery.data, router]);

  // Resume at the persisted step once progress loads, rather than always
  // restarting at Medications. furthestStep isn't itself persisted (only
  // current_step is), so it's set to the same resumed step — reasonable,
  // since it only controls which step-dots read as reachable, and the
  // user has necessarily reached at least this one before. Adjusted
  // during render, guarded by state (not a ref — refs can't be read
  // during render) — the same technique DailyMedAutocomplete.tsx uses for
  // deriving state from data that arrives after mount, rather than a
  // useEffect, which would call setState after an extra commit instead of
  // before this render paints.
  const [hydratedProgressId, setHydratedProgressId] = useState<string | undefined>(undefined);
  if (progressQuery.data && progressQuery.data.id !== hydratedProgressId) {
    setHydratedProgressId(progressQuery.data.id);
    const idx = STEP_KEYS.indexOf(progressQuery.data.current_step as OnboardingStep);
    if (idx >= 0) {
      setStep(idx + 1);
      setFurthestStep(idx + 1);
    }
  }

  const drafts = useMemo(
    () =>
      (draftsQuery.data ?? [])
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [draftsQuery.data],
  );

  function refreshDrafts() {
    queryClient.invalidateQueries({ queryKey: ["onboarding-drafts", activeProfileId] });
  }

  const hasInventory = drafts.some((d) => d.formData.inventoryEnabled);
  const hasPastSlotsToday = useMemo(() => buildTodayReconcileSlots(drafts).length > 0, [drafts]);

  const applicable = useMemo(
    () =>
      STEP_KEYS.map((key) => {
        if (key === "inventory") return hasInventory;
        if (key === "reconcile") return hasPastSlotsToday;
        return true;
      }),
    [hasInventory, hasPastSlotsToday],
  );

  function clampToApplicable(candidate: number, direction: 1 | -1): number {
    let s = candidate;
    while (s >= 1 && s <= STEP_KEYS.length && !applicable[s - 1]) {
      s += direction;
    }
    return Math.min(Math.max(s, 1), STEP_KEYS.length);
  }

  async function goToStep(target: number, direction: 1 | -1) {
    const clamped = clampToApplicable(target, direction);
    setStep(clamped);
    setFurthestStep((f) => Math.max(f, clamped));
    try {
      await saveOnboardingStep(STEP_KEYS[clamped - 1], activeProfileId);
    } catch {
      // Best-effort — don't block navigation over a transient save failure.
    }
  }

  function handleNext() {
    void goToStep(step + 1, 1);
  }

  function handleBack() {
    void goToStep(step - 1, -1);
  }

  async function handleSkip() {
    try {
      await skipOnboarding(activeProfileId);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't skip setup");
    }
  }

  if (isResolving || progressQuery.isLoading || draftsQuery.isLoading) {
    return <p className="text-brand-text-muted">Loading…</p>;
  }

  // Every non-PRN draft needs at least one saved schedule time before
  // moving past the schedule step — there's no DB constraint backstopping
  // this (only the full medicationFormSchema does, and only in the
  // single-medication wizard), so this is the only client-side gate;
  // activateOnboarding's safeParse is the second, later gate.
  const scheduleReady = drafts.every(
    (d) => d.formData.asNeeded || d.formData.scheduleTimes.length > 0,
  );
  const nextDisabled =
    (step === 1 && drafts.length === 0) || (step === 3 && !scheduleReady);

  const StepComponent = STEP_COMPONENTS[step - 1];
  const profileName = activeProfile?.display_name ?? "your";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-navy">
          Set up {activeProfile ? `${profileName}'s` : "your"} medications
        </h1>
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-brand-text-muted hover:text-brand-deep-blue"
        >
          Skip setup
        </button>
      </div>

      <div className="mb-6 mt-4 flex items-center gap-2">
        {STEP_KEYS.map((key, i) => {
          if (!applicable[i]) return null;
          const stepNumber = i + 1;
          const isActive = stepNumber === step;
          const isDone = stepNumber < step || stepNumber <= furthestStep;
          return (
            <button
              key={key}
              type="button"
              disabled={!isDone}
              onClick={() => void goToStep(stepNumber, stepNumber >= step ? 1 : -1)}
              className="flex flex-1 flex-col items-center gap-1 disabled:cursor-default"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  isActive
                    ? "bg-gradient-brand text-white"
                    : isDone
                      ? "bg-brand-bg text-brand-deep-blue"
                      : "bg-brand-bg text-brand-text-muted",
                )}
              >
                {stepNumber}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isActive ? "text-brand-text" : "text-brand-text-muted",
                )}
              >
                {STEP_LABELS[i]}
              </span>
            </button>
          );
        })}
      </div>

      <OnboardingProvider
        value={{
          profileId: activeProfileId,
          drafts,
          refreshDrafts,
          reconcileMarks,
          setReconcileMarks,
        }}
      >
        <div className="rounded-card border border-brand-border bg-brand-card p-6 shadow-card">
          <StepComponent />

          {step < STEP_KEYS.length && (
            <div className="mt-8 flex justify-between">
              <Button type="button" variant="secondary" onClick={handleBack} disabled={step === 1}>
                Back
              </Button>
              <Button type="button" onClick={handleNext} disabled={nextDisabled}>
                Next
              </Button>
            </div>
          )}
          {step === STEP_KEYS.length && (
            <div className="mt-8">
              <Button type="button" variant="secondary" onClick={handleBack}>
                Back
              </Button>
            </div>
          )}
        </div>
      </OnboardingProvider>
    </div>
  );
}
