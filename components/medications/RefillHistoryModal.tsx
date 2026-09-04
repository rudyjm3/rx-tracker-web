"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { getRefillHistory } from "@/lib/inventory";
import type { Medication, MedicationRefill } from "@/lib/types/medications";

interface RefillHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function formatAmount(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

// Same-day refills need a stable chronological order — refill_date alone
// ties, and the API returns rows created_at-descending, which would put
// the later same-day refill first and hand it the earlier one's gap.
function byDateThenCreatedAtAsc(a: MedicationRefill, b: MedicationRefill): number {
  const dateCmp = a.refill_date.localeCompare(b.refill_date);
  if (dateCmp !== 0) return dateCmp;
  return a.created_at.localeCompare(b.created_at);
}

export function RefillHistoryModal({
  open,
  onOpenChange,
  medication,
}: RefillHistoryModalProps) {
  const [viewDate, setViewDate] = useState(() => new Date());

  const historyQuery = useQuery({
    queryKey: ["refill-history", medication.id],
    queryFn: () => getRefillHistory(medication.id),
    enabled: open,
  });

  const entries = historyQuery.data ?? [];

  // Chronological pass (ascending) to attach "days since prev refill" —
  // computed across all-time refill entries, not just the viewed month,
  // so a refill at the start of a month still gets an accurate gap from
  // the last refill in the prior month.
  const daysSincePrevById = useMemo(() => {
    const refillsAsc = entries
      .filter((e) => e.entry_type === "refill")
      .slice()
      .sort(byDateThenCreatedAtAsc);
    const map = new Map<string, number>();
    for (let i = 1; i < refillsAsc.length; i++) {
      map.set(refillsAsc[i].id, daysBetween(refillsAsc[i - 1].refill_date, refillsAsc[i].refill_date));
    }
    return map;
  }, [entries]);

  const viewedYear = viewDate.getFullYear();
  const viewedMonth = viewDate.getMonth();

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => {
          const d = parseDate(e.refill_date);
          return d.getFullYear() === viewedYear && d.getMonth() === viewedMonth;
        })
        .sort((a, b) => b.refill_date.localeCompare(a.refill_date)),
    [entries, viewedYear, viewedMonth],
  );

  const yearStats = useMemo(() => {
    const refillsInYear = entries
      .filter((e) => e.entry_type === "refill" && parseDate(e.refill_date).getFullYear() === viewedYear)
      .sort(byDateThenCreatedAtAsc);
    if (refillsInYear.length === 0) return null;
    let avgDays: number | null = null;
    if (refillsInYear.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < refillsInYear.length; i++) {
        gaps.push(daysBetween(refillsInYear[i - 1].refill_date, refillsInYear[i].refill_date));
      }
      avgDays = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
    }
    return { count: refillsInYear.length, avgDays };
  }, [entries, viewedYear]);

  function shiftMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  const prevMonthLabel = new Date(viewedYear, viewedMonth - 1, 1).toLocaleDateString(undefined, {
    month: "long",
  });
  const nextMonthLabel = new Date(viewedYear, viewedMonth + 1, 1).toLocaleDateString(undefined, {
    month: "long",
  });
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>Refill History</DialogTitle>
          <p className="text-sm font-semibold text-brand-text-muted">{medication.name}</p>
        </DialogHeader>

        {historyQuery.isLoading ? (
          <p className="text-sm text-brand-text-muted">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {yearStats && (
              <div className="rounded-control bg-brand-bg px-4 py-3 text-sm text-brand-text">
                {yearStats.count} refill{yearStats.count === 1 ? "" : "s"} in {viewedYear}
                {yearStats.avgDays != null && ` · avg every ${yearStats.avgDays} day${yearStats.avgDays === 1 ? "" : "s"}`}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="text-sm font-medium text-brand-deep-blue hover:underline"
              >
                ‹ {prevMonthLabel}
              </button>
              <span className="text-sm font-bold text-brand-navy">{monthLabel}</span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="text-sm font-medium text-brand-deep-blue hover:underline"
              >
                {nextMonthLabel} ›
              </button>
            </div>

            {monthEntries.length === 0 ? (
              <p className="text-sm text-brand-text-muted">No refill activity this month.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-brand-border">
                {monthEntries.map((entry) => (
                  <RefillHistoryRow
                    key={entry.id}
                    entry={entry}
                    unit={medication.inventory_unit}
                    daysSincePrev={daysSincePrevById.get(entry.id) ?? null}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RefillHistoryRow({
  entry,
  unit,
  daysSincePrev,
}: {
  entry: MedicationRefill;
  unit: string;
  daysSincePrev: number | null;
}) {
  const dateLabel = parseDate(entry.refill_date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isAdjustment = entry.entry_type === "adjustment";
  const sign = entry.amount >= 0 ? "+" : "";

  return (
    <li className="py-3">
      <p className="text-sm font-semibold text-brand-navy">{dateLabel}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {isAdjustment && (
          <span className="rounded-full bg-brand-bg px-2 py-0.5 font-semibold text-brand-text-muted">
            ADJUSTMENT
          </span>
        )}
        <span className="rounded-full bg-status-success/10 px-2 py-0.5 font-semibold text-status-success">
          {isAdjustment ? "" : "Refill: "}
          {sign}
          {formatAmount(entry.amount)} {unit}
        </span>
        <span className="text-brand-text-muted">
          {formatAmount(entry.pills_on_hand)} on hand after
        </span>
        {!isAdjustment && daysSincePrev != null && (
          <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-text-muted">
            {daysSincePrev} day{daysSincePrev === 1 ? "" : "s"} since prev
          </span>
        )}
      </div>
      {entry.note && <p className="mt-1 text-xs italic text-brand-text-muted">{entry.note}</p>}
    </li>
  );
}
