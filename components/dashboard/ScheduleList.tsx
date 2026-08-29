"use client";

import type { BadgeVariant } from "@/components/ui/Badge";
import { isLate } from "@/lib/utils";
import type { DaySlot } from "@/lib/schedule";
import { DoseRow } from "./DoseRow";

function badgeVariantFor(
  slot: DaySlot,
  date: string,
  graceMinutes: number,
): BadgeVariant | null {
  if (slot.status === "pending") {
    if (slot.postponedUntil && new Date(slot.postponedUntil).getTime() > Date.now()) {
      return "snoozed";
    }
    return null;
  }
  if (slot.status === "missed") return "missed";
  if (slot.status === "skipped") return "skipped";
  // taken
  const late = isLate(
    {
      status: slot.status,
      taken_at: slot.takenAt,
      scheduled_for_date: date,
      scheduled_time: slot.scheduledTime,
    },
    graceMinutes,
  );
  return late ? "late" : "taken";
}

interface ScheduleListProps {
  slots: DaySlot[];
  date: string;
  graceMinutes: number;
  onTake: (slot: DaySlot) => void;
  onSkip: (slot: DaySlot) => void;
  onSnooze: (slot: DaySlot, minutes: number) => void;
  defaultSnoozeMinutes?: number;
  pendingKey?: string | null;
}

export function ScheduleList({
  slots,
  date,
  graceMinutes,
  onTake,
  onSkip,
  onSnooze,
  defaultSnoozeMinutes,
  pendingKey,
}: ScheduleListProps) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-brand-text-muted">
        Nothing scheduled today.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot) => {
        const key = `${slot.medicationId}|${slot.scheduledTime}`;
        return (
          <DoseRow
            key={key}
            slot={slot}
            date={date}
            graceMinutes={graceMinutes}
            badgeVariant={badgeVariantFor(slot, date, graceMinutes)}
            onTake={() => onTake(slot)}
            onSkip={() => onSkip(slot)}
            onSnooze={(minutes) => onSnooze(slot, minutes)}
            defaultSnoozeMinutes={defaultSnoozeMinutes}
            disabled={pendingKey === key}
          />
        );
      })}
    </div>
  );
}
