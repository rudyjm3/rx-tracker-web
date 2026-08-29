"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { to12h } from "@/lib/utils";
import { SNOOZE_OPTIONS, type DaySlot, type NextDoseEvent } from "@/lib/schedule";
import { DoseFormIcon } from "./DoseFormIcon";

interface AlarmOverlayProps {
  event: NextDoseEvent | null;
  onTakeAll: () => void;
  onSkipAll: () => void;
  onSnoozeAll: (minutes: number) => void;
  onTakeOne: (slot: DaySlot) => void;
  onSkipOne: (slot: DaySlot) => void;
  onSnoozeOne: (slot: DaySlot, minutes: number) => void;
  defaultSnoozeMinutes?: number;
  disabled?: boolean;
}

function SnoozeRow({
  onSnooze,
  defaultSnoozeMinutes,
  disabled,
}: {
  onSnooze: (minutes: number) => void;
  defaultSnoozeMinutes?: number;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-white hover:bg-white/10" disabled={disabled}>
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
  );
}

export function AlarmOverlay({
  event,
  onTakeAll,
  onSkipAll,
  onSnoozeAll,
  onTakeOne,
  onSkipOne,
  onSnoozeOne,
  defaultSnoozeMinutes,
  disabled,
}: AlarmOverlayProps) {
  const [manageEach, setManageEach] = useState(false);

  if (!event) return null;

  const doseForm =
    event.kind === "group" ? (event.members[0]?.medication.dose_form ?? null) : event.slot.medication.dose_form;

  return (
    <div
      role="alertdialog"
      aria-label="Dose due now"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark-navy/90 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center text-white">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-white/10" />
          <DoseFormIcon doseForm={doseForm} size={64} />
        </div>

        <div>
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
            <Bell size={13} />
            Dose due now
          </p>

          {event.kind === "single" ? (
            <>
              <h2 className="mt-2 text-2xl font-bold">{event.slot.medicationName}</h2>
              <div className="mt-1 flex items-center justify-center gap-2 text-white/85">
                <MedTypeBadge type={event.slot.medication.medication_type} />
                {event.slot.dose && <span>{event.slot.dose}</span>}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-2xl font-bold">{event.groupName}</h2>
              <p className="text-white/80">{event.members.length} medications in group</p>
            </>
          )}
        </div>

        {event.kind === "group" && manageEach && (
          <div className="flex w-full flex-col gap-2 rounded-card bg-white/10 p-3 text-left">
            {event.members.map((m) => (
              <div
                key={m.medicationId}
                className="flex items-center justify-between gap-2 border-b border-white/15 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.medicationName}</p>
                  <p className="text-xs text-white/70">
                    {to12h(m.scheduledTime)}
                    {m.dose && ` · ${m.dose}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="compact" onClick={() => onTakeOne(m)} disabled={disabled}>
                    Take
                  </Button>
                  <Button
                    size="compact"
                    variant="secondary"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => onSkipOne(m)}
                    disabled={disabled}
                  >
                    Skip
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="compact"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        disabled={disabled}
                      >
                        Snooze
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {SNOOZE_OPTIONS.map((minutes) => (
                        <DropdownMenuItem key={minutes} onSelect={() => onSnoozeOne(m, minutes)}>
                          {minutes} minutes
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {!(event.kind === "group" && manageEach) && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="default" onClick={onTakeAll} disabled={disabled} className="min-w-[9rem]">
              Take Now
            </Button>
            <Button
              variant="secondary"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={onSkipAll}
              disabled={disabled}
            >
              Skip
            </Button>
            {event.kind === "group" && (
              <Button
                variant="secondary"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setManageEach(true)}
                disabled={disabled}
              >
                Manage Each
              </Button>
            )}
          </div>
        )}

        {!(event.kind === "group" && manageEach) && (
          <SnoozeRow onSnooze={onSnoozeAll} defaultSnoozeMinutes={defaultSnoozeMinutes} disabled={disabled} />
        )}
      </div>
    </div>
  );
}
