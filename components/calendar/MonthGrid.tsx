"use client";

import { ChevronLeft, ChevronRight, Flag, PillBottle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  calendarDayColor,
  monthBounds,
  summarizeDay,
  type CalendarMonthSummary,
  type CalendarDayColor,
  type CalendarDayDetail,
} from "@/lib/calendar";
import type { CalendarDayMarker } from "@/lib/dose-logs";
import type { RunoutEntry } from "@/lib/schedule";

// Run-out within this many days of today reads as urgent (danger color).
const RUNOUT_URGENT_DAYS = 7;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Only the day-cell background is driven by its "worst status" color —
// the day number itself stays neutral, and each T/S/M count below is
// colored individually (see COUNT_CLASSES) rather than inheriting one
// color for the whole cell.
const COLOR_CLASSES: Record<CalendarDayColor, string> = {
  future: "bg-brand-bg text-brand-text-muted",
  missed: "bg-status-danger/20 text-brand-text",
  skipped: "bg-status-warning/20 text-brand-text",
  taken: "bg-status-success/20 text-brand-text",
  empty: "bg-brand-card text-brand-text-muted",
};

const COUNT_CLASSES = {
  taken: "text-status-success",
  skipped: "text-status-warning",
  missed: "text-status-danger",
  late: "text-orange-600 dark:text-orange-400",
};

interface MonthGridProps {
  month: string; // "YYYY-MM"
  todayDate: string; // "YYYY-MM-DD"
  markers: Record<string, CalendarDayMarker>;
  dayDetails: Record<string, CalendarDayDetail>;
  asNeededIds: ReadonlySet<string>;
  summary: CalendarMonthSummary;
  runoutByDate: Record<string, RunoutEntry[]>;
  onNavigate: (month: string) => void;
  onSelectDay: (date: string) => void;
}

export function MonthGrid({
  month,
  todayDate,
  markers,
  dayDetails,
  asNeededIds,
  summary,
  runoutByDate,
  onNavigate,
  onSelectDay,
}: MonthGridProps) {
  const bounds = monthBounds(month);
  const cells: (number | null)[] = [
    ...Array(bounds.firstDow).fill(null),
    ...Array.from({ length: bounds.daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4 shadow-card sm:p-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate(bounds.prevMonth)}
          className="rounded-control p-2 text-brand-deep-blue hover:bg-brand-bg"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-brand-navy">{bounds.label}</h2>
        <button
          type="button"
          onClick={() => onNavigate(bounds.nextMonth)}
          className="rounded-control p-2 text-brand-deep-blue hover:bg-brand-bg"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <MonthSummaryRow summary={summary} />

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-brand-text-muted sm:gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;

          const dateStr = `${month}-${String(day).padStart(2, "0")}`;
          const detail = dayDetails[dateStr];
          const isFuture = detail ? detail.isFuture : dateStr > todayDate;
          const isToday = dateStr === todayDate;
          const marker = markers[dateStr];
          const color = calendarDayColor(isFuture, marker);
          const clickable = !!detail;
          const hasMarkerCounts =
            !isFuture &&
            marker &&
            (marker.taken > 0 || marker.skipped > 0 || marker.missed > 0);
          const lateCount = detail && !isFuture ? summarizeDay(detail, asNeededIds, true).late : 0;
          const endingMedications = detail?.endingMedications ?? [];
          const runouts = dateStr >= todayDate ? (runoutByDate[dateStr] ?? []) : [];
          const runoutUrgent = runouts.some((r) => r.daysLeft <= RUNOUT_URGENT_DAYS);

          return (
            <button
              type="button"
              key={dateStr}
              disabled={!clickable}
              onClick={() => onSelectDay(dateStr)}
              className={cn(
                "flex min-h-20 flex-col items-start justify-start gap-0.5 rounded-control p-1.5 text-left text-sm transition disabled:cursor-default sm:min-h-24",
                COLOR_CLASSES[color],
                isToday && "ring-2 ring-brand-blue",
                clickable && "cursor-pointer hover:opacity-80",
              )}
            >
              <span className="font-semibold">{day}</span>
              {hasMarkerCounts && (
                <span className="flex flex-wrap gap-x-1.5 text-[10px] font-medium">
                  {marker!.taken > 0 && (
                    <span className={COUNT_CLASSES.taken}>{marker!.taken}T</span>
                  )}
                  {marker!.skipped > 0 && (
                    <span className={COUNT_CLASSES.skipped}>{marker!.skipped}S</span>
                  )}
                  {marker!.missed > 0 && (
                    <span className={COUNT_CLASSES.missed}>{marker!.missed}M</span>
                  )}
                  {lateCount > 0 && (
                    <span className={COUNT_CLASSES.late} title="Late">
                      {lateCount}L
                    </span>
                  )}
                </span>
              )}
              {endingMedications.length > 0 && (
                <Flag
                  size={12}
                  className="text-status-warning"
                  fill="currentColor"
                  role="img"
                  aria-label="Medication ends"
                />
              )}
              {runouts.length > 0 && (
                <PillBottle
                  size={14}
                  className={runoutUrgent ? "text-status-danger" : "text-status-warning"}
                  role="img"
                  aria-label="Medication runs out"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-brand-text-muted">
        <LegendDot colorClass="bg-status-success" label="Taken" />
        <LegendDot colorClass="bg-status-warning" label="Skipped" />
        <LegendDot colorClass="bg-status-danger" label="Missed" />
        <span className="flex items-center gap-1.5">
          <span className={cn("font-semibold", COUNT_CLASSES.late)}>L</span>
          Late = taken after grace period
        </span>
        <span className="flex items-center gap-1.5">
          <PillBottle size={14} className="text-status-danger" aria-hidden="true" />
          Refill needed (projected run-out, estimate)
        </span>
      </div>
    </div>
  );
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", colorClass)} />
      {label}
    </span>
  );
}

function MonthSummaryRow({ summary }: { summary: CalendarMonthSummary }) {
  const items = [
    { label: "Adherence", value: summary.adherencePct === null ? "—" : `${summary.adherencePct}%` },
    { label: "Missed", value: summary.missed, className: COUNT_CLASSES.missed },
    { label: "Late", value: summary.late, className: COUNT_CLASSES.late },
    { label: "Skipped", value: summary.skipped, className: COUNT_CLASSES.skipped },
  ];
  return (
    <dl className="-mt-1 grid grid-cols-4 gap-1 rounded-control bg-brand-bg px-2 py-1.5 text-center">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dd className={cn("text-sm font-bold leading-tight text-brand-navy", item.className)}>
            {item.value}
          </dd>
          <dt className="truncate text-[10px] text-brand-text-muted">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}
