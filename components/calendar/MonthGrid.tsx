"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { calendarDayColor, monthBounds, type CalendarDayColor } from "@/lib/calendar";
import type { CalendarDayMarker } from "@/lib/dose-logs";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLOR_CLASSES: Record<CalendarDayColor, string> = {
  future: "bg-brand-bg text-brand-text-muted",
  missed: "bg-status-danger/10 text-status-danger",
  skipped: "bg-status-warning/10 text-status-warning",
  taken: "bg-status-success/10 text-status-success",
  empty: "bg-brand-card text-brand-text-muted",
};

interface MonthGridProps {
  month: string; // "YYYY-MM"
  todayDate: string; // "YYYY-MM-DD"
  markers: Record<string, CalendarDayMarker>;
  hasDetail: (date: string) => boolean;
  onNavigate: (month: string) => void;
  onSelectDay: (date: string) => void;
}

export function MonthGrid({
  month,
  todayDate,
  markers,
  hasDetail,
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

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-brand-text-muted sm:gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;

          const dateStr = `${month}-${String(day).padStart(2, "0")}`;
          const isFuture = dateStr > todayDate;
          const isToday = dateStr === todayDate;
          const marker = markers[dateStr];
          const color = calendarDayColor(isFuture, marker);
          const clickable = !isFuture && hasDetail(dateStr);
          const hasMarkerCounts =
            !isFuture &&
            marker &&
            (marker.taken > 0 || marker.skipped > 0 || marker.missed > 0);

          return (
            <button
              type="button"
              key={dateStr}
              disabled={!clickable}
              onClick={() => onSelectDay(dateStr)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-control text-sm transition disabled:cursor-default",
                COLOR_CLASSES[color],
                isToday && "ring-2 ring-brand-blue",
                clickable && "cursor-pointer hover:opacity-80",
              )}
            >
              <span className="font-semibold">{day}</span>
              {hasMarkerCounts && (
                <span className="flex gap-1 text-[10px] font-medium">
                  {marker!.taken > 0 && <span>{marker!.taken}T</span>}
                  {marker!.skipped > 0 && <span>{marker!.skipped}S</span>}
                  {marker!.missed > 0 && <span>{marker!.missed}M</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-brand-text-muted">
        <LegendDot colorClass="bg-status-success" label="Taken" />
        <LegendDot colorClass="bg-status-warning" label="Skipped" />
        <LegendDot colorClass="bg-status-danger" label="Missed" />
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
