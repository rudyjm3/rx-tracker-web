"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { to12h } from "@/lib/utils";
import type { DaySlot } from "@/lib/schedule";
import { AdherenceRing } from "./AdherenceRing";

const SNOOZE_OPTIONS = [5, 10, 15, 30];

interface HeroPanelProps {
  nextDose: DaySlot | null;
  adherencePercent: number;
  onTake: (slot: DaySlot) => void;
  onSkip: (slot: DaySlot) => void;
  onSnooze: (slot: DaySlot, minutes: number) => void;
  disabled?: boolean;
}

export function HeroPanel({
  nextDose,
  adherencePercent,
  onTake,
  onSkip,
  onSnooze,
  disabled,
}: HeroPanelProps) {
  return (
    <div className="rounded-hero bg-gradient-brand-hero p-6 shadow-card sm:p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:justify-between">
        <div className="flex-1 rounded-card bg-white/10 p-5 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-white/70">
            Next dose
          </p>
          {nextDose ? (
            <>
              <h2 className="mt-1 text-xl font-bold text-white">
                {nextDose.medicationName}
              </h2>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                <Clock size={14} />
                <span>{to12h(nextDose.scheduledTime)}</span>
                {nextDose.dose && <span>· {nextDose.dose}</span>}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button size="compact" onClick={() => onTake(nextDose)} disabled={disabled}>
                  Take
                </Button>
                <Button
                  size="compact"
                  variant="secondary"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => onSkip(nextDose)}
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
                      <DropdownMenuItem
                        key={minutes}
                        onSelect={() => onSnooze(nextDose, minutes)}
                      >
                        {minutes} minutes
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <p className="mt-2 text-white/90">
              All caught up — nothing due right now.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center">
          <AdherenceRing percent={adherencePercent} />
        </div>
      </div>
    </div>
  );
}
