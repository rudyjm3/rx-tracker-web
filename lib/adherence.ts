import type { DoseLogStatus } from "@/lib/types/medications";

interface AdherenceLog {
  status: DoseLogStatus;
}

/**
 * pct = round(taken / (taken + missed + skipped) * 100), 0 if no logs.
 * There is no separate "late" bucket — a late-but-taken dose still
 * counts as taken (lateness is a UI/badge concern via isLate(), never
 * fed into this formula). Callers must pre-filter out as_needed
 * medications' logs before calling this.
 */
export function computeAdherence(logs: AdherenceLog[]): number {
  const taken = logs.filter((l) => l.status === "taken").length;
  const denom = logs.length;
  return denom === 0 ? 0 : Math.round((taken / denom) * 100);
}
