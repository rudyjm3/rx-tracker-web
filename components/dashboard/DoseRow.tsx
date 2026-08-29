"use client";

import { Clock, Layers } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { formatClockTime, formatLate, minutesLate, to12h } from "@/lib/utils";
import { SNOOZE_OPTIONS, type DaySlot } from "@/lib/schedule";

interface DoseRowProps {
  slot: DaySlot;
  date: string;
  badgeVariant: BadgeVariant | null;
  graceMinutes: number;
  onTake: () => void;
  onSkip: () => void;
  onSnooze: (minutes: number) => void;
  defaultSnoozeMinutes?: number;
  disabled?: boolean;
}

export function DoseRow({
  slot,
  date,
  badgeVariant,
  graceMinutes,
  onTake,
  onSkip,
  onSnooze,
  defaultSnoozeMinutes,
  disabled,
}: DoseRowProps) {
  const lateMinutes =
    badgeVariant === "late"
      ? minutesLate(
          {
            status: slot.status,
            taken_at: slot.takenAt,
            scheduled_for_date: date,
            scheduled_time: slot.scheduledTime,
          },
          graceMinutes,
        )
      : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-brand-border bg-brand-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-brand-text-muted">
          <Clock size={12} />
          <span>{to12h(slot.scheduledTime)}</span>
          {slot.isPrn && <span>(PRN)</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="font-medium text-brand-text">{slot.medicationName}</span>
          <MedTypeBadge type={slot.medication.medication_type} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-brand-text-muted">
          {slot.dose && <span>{slot.dose}</span>}
          {slot.groupName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-text-muted">
              <Layers size={11} />
              {slot.groupName}
            </span>
          )}
        </div>
      </div>

      {badgeVariant === "snoozed" && slot.postponedUntil ? (
        <Badge variant="snoozed">{`Snoozed until ${formatClockTime(slot.postponedUntil)}`}</Badge>
      ) : badgeVariant === "late" && lateMinutes != null ? (
        <Badge variant="late">{`Taken (${formatLate(lateMinutes)})`}</Badge>
      ) : badgeVariant ? (
        <Badge variant={badgeVariant} />
      ) : (
        <div className="flex items-center gap-1.5">
          <Button size="compact" onClick={onTake} disabled={disabled}>
            Take
          </Button>
          <Button size="compact" variant="secondary" onClick={onSkip} disabled={disabled}>
            Skip
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="compact" variant="ghost" disabled={disabled}>
                Snooze
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SNOOZE_OPTIONS.map((minutes) => (
                <DropdownMenuItem key={minutes} onSelect={() => onSnooze(minutes)}>
                  {minutes} minutes
                  {minutes === defaultSnoozeMinutes && " (default)"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
