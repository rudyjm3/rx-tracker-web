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

export interface AdherenceStats {
  percent: number;
  requiredTaken: number;
  requiredTotal: number;
  onTime: number;
  late: number;
  skipped: number;
  missed: number;
}

/**
 * Full adherence breakdown for the dashboard's "Today's Adherence" card:
 * the same percent as computeAdherence() plus the on-time/late/skipped
 * counts shown beneath the ring. requiredTotal is every required slot
 * that's due to be resolved today (taken/skipped/missed), not the day's
 * full schedule — a still-pending slot isn't counted either way yet.
 */
export function computeAdherenceStats(
  logs: (AdherenceLog & { late: boolean })[],
): AdherenceStats {
  const requiredTaken = logs.filter((l) => l.status === "taken").length;
  const onTime = logs.filter((l) => l.status === "taken" && !l.late).length;
  const late = logs.filter((l) => l.status === "taken" && l.late).length;
  const skipped = logs.filter((l) => l.status === "skipped").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const requiredTotal = logs.length;
  return {
    percent: requiredTotal === 0 ? 0 : Math.round((requiredTaken / requiredTotal) * 100),
    requiredTaken,
    requiredTotal,
    onTime,
    late,
    skipped,
    missed,
  };
}
