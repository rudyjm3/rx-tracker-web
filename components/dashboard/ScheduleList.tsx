"use client";

import type { BadgeVariant } from "@/components/ui/Badge";
import { isLate } from "@/lib/utils";
import { buildDoseEvents, type DaySlot } from "@/lib/schedule";
import { DoseRow } from "./DoseRow";
import { GroupDoseCard } from "./GroupDoseCard";

// Shared with GroupDoseCard, which needs the same taken/late/missed/
// skipped/snoozed badge logic for each of its member rows.
export function badgeVariantFor(
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

  // Same groupId+due-time collapsing buildDoseEvents already does for the
  // hero/alarm surfaces, just fed every slot instead of only the pending
  // ones — so a group whose members span taken/skipped/missed/pending
  // still renders as one card instead of one DoseRow per member.
  const entries = buildDoseEvents(slots, date);

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => {
        if (entry.kind === "single") {
          const slot = entry.slot;
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
        }

        return (
          <GroupDoseCard
            key={`${entry.groupId}|${entry.time}`}
            groupId={entry.groupId}
            groupName={entry.groupName}
            time={entry.time}
            members={entry.members}
            date={date}
            graceMinutes={graceMinutes}
            onTake={onTake}
            onSkip={onSkip}
            onSnooze={onSnooze}
            defaultSnoozeMinutes={defaultSnoozeMinutes}
            pendingKey={pendingKey}
          />
        );
      })}
    </div>
  );
}
