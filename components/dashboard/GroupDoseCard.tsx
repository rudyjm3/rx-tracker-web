"use client";

import { useState } from "react";
import { ChevronsDown, Clock, Layers, Users } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/cn";
import { formatClockTime, formatLate, minutesLate, to12h } from "@/lib/utils";
import { SNOOZE_OPTIONS, type DaySlot } from "@/lib/schedule";
import { badgeVariantFor } from "./ScheduleList";

function hhmm(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Aggregate badge shown on the collapsed card once every member has a
// final status — same missed-beats-skipped-beats-taken priority the
// calendar's day-cell coloring already uses (lib/calendar.ts
// calendarDayColor), applied here across a group's members instead of a
// day's logs.
function summaryVariant(
  members: DaySlot[],
  date: string,
  graceMinutes: number,
): BadgeVariant {
  const variants = members.map((m) => badgeVariantFor(m, date, graceMinutes));
  if (variants.includes("missed")) return "missed";
  if (variants.includes("skipped")) return "skipped";
  if (variants.includes("late")) return "late";
  return "taken";
}

interface GroupDoseCardProps {
  groupId: string;
  groupName: string;
  time: number; // epoch ms — the group's shared due time
  members: DaySlot[];
  date: string;
  graceMinutes: number;
  onTake: (slot: DaySlot) => void;
  onSkip: (slot: DaySlot) => void;
  onSnooze: (slot: DaySlot, minutes: number) => void;
  defaultSnoozeMinutes?: number;
  pendingKey?: string | null;
}

export function GroupDoseCard({
  groupName,
  time,
  members,
  date,
  graceMinutes,
  onTake,
  onSkip,
  onSnooze,
  defaultSnoozeMinutes,
  pendingKey,
}: GroupDoseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [manageEach, setManageEach] = useState(false);

  const pendingMembers = members.filter((m) => m.status === "pending");
  const allResolved = pendingMembers.length === 0;
  const disabled = pendingKey !== null;

  // Same bulk-over-single-slot-handlers pattern as DashboardClient's
  // handleTakeAll/handleSkipAll/handleSnoozeAll (which forEach() a
  // group's members over the single-slot handler) — restricted to the
  // members still pending, since a member that's already taken/skipped/
  // missed has nothing left for a bulk action to do.
  function handleTakeAll() {
    pendingMembers.forEach(onTake);
  }
  function handleSkipAll() {
    pendingMembers.forEach(onSkip);
  }
  function handleSnoozeAll(minutes: number) {
    pendingMembers.forEach((m) => onSnooze(m, minutes));
  }

  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-brand-text-muted">
            <Clock size={12} />
            <span>{to12h(hhmm(time))}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 font-medium text-brand-text">
              <Layers size={14} className="text-brand-deep-blue" />
              {groupName}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-text-muted">
              <Users size={11} />
              {members.length} {members.length === 1 ? "medication" : "medications"}
            </span>
          </div>
        </div>

        {allResolved ? (
          <Badge variant={summaryVariant(members, date, graceMinutes)} />
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="compact" onClick={handleTakeAll} disabled={disabled}>
              Take
            </Button>
            <Button size="compact" variant="secondary" onClick={handleSkipAll} disabled={disabled}>
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
                  <DropdownMenuItem key={minutes} onSelect={() => handleSnoozeAll(minutes)}>
                    {minutes} minutes
                    {minutes === defaultSnoozeMinutes && " (default)"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-medium text-brand-text-muted hover:text-brand-deep-blue"
      >
        {expanded ? "Hide" : "Show"} medications
        <ChevronsDown
          aria-hidden="true"
          size={14}
          className={cn("transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-brand-border pt-3">
          {!allResolved && (
            <button
              type="button"
              onClick={() => setManageEach((m) => !m)}
              className="self-start text-xs font-medium text-brand-deep-blue hover:underline"
            >
              {manageEach ? "Done managing individually" : "Manage Individually"}
            </button>
          )}

          {members.map((m) => {
            const key = `${m.medicationId}|${m.scheduledTime}`;
            const variant = badgeVariantFor(m, date, graceMinutes);
            const lateMinutes =
              variant === "late"
                ? minutesLate(
                    {
                      status: m.status,
                      taken_at: m.takenAt,
                      scheduled_for_date: date,
                      scheduled_time: m.scheduledTime,
                    },
                    graceMinutes,
                  )
                : null;

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-control bg-brand-bg/60 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <MedicationNameWithDose
                    medication={m.medication}
                    className="text-sm font-medium text-brand-text"
                  />
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <MedTypeBadge type={m.medication.medication_type} />
                    {m.isPrn && <span className="text-xs text-brand-text-muted">(PRN)</span>}
                  </div>
                </div>

                {m.status === "pending" && manageEach ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="compact" onClick={() => onTake(m)} disabled={pendingKey === key}>
                      Take
                    </Button>
                    <Button
                      size="compact"
                      variant="secondary"
                      onClick={() => onSkip(m)}
                      disabled={pendingKey === key}
                    >
                      Skip
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="compact" variant="ghost" disabled={pendingKey === key}>
                          Snooze
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {SNOOZE_OPTIONS.map((minutes) => (
                          <DropdownMenuItem key={minutes} onSelect={() => onSnooze(m, minutes)}>
                            {minutes} minutes
                            {minutes === defaultSnoozeMinutes && " (default)"}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : m.status === "pending" ? (
                  <Badge variant="pending" />
                ) : variant === "snoozed" && m.postponedUntil ? (
                  <Badge variant="snoozed">{`Snoozed until ${formatClockTime(m.postponedUntil)}`}</Badge>
                ) : variant === "late" && lateMinutes != null ? (
                  <Badge variant="late">{`Taken (${formatLate(lateMinutes)})`}</Badge>
                ) : variant ? (
                  <Badge variant={variant} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
