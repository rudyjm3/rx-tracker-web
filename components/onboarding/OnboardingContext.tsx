"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ParsedDraft } from "@/lib/drafts";
import type { MedicationFormValues } from "@/components/medications/wizard/schema";
import type { ReconcileMark } from "@/lib/onboarding";

export interface OnboardingContextValue {
  profileId: string | null;
  drafts: ParsedDraft<MedicationFormValues>[];
  refreshDrafts: () => void;
  reconcileMarks: ReconcileMark[];
  setReconcileMarks: (marks: ReconcileMark[] | ((prev: ReconcileMark[]) => ReconcileMark[])) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  value,
  children,
}: {
  value: OnboardingContextValue;
  children: ReactNode;
}) {
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
