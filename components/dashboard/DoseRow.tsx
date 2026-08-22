"use client";

import { Clock } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { to12h } from "@/lib/utils";
import type { DaySlot } from "@/lib/schedule";

const SNOOZE_OPTIONS = [5, 10, 15, 30];

interface DoseRowProps {
  slot: DaySlot;
  badgeVariant: BadgeVariant | null;
  onTake: () => void;
  onSkip: () => void;
  onSnooze: (minutes: number) => void;
  disabled?: boolean;
}

export function DoseRow({
  slot,
  badgeVariant,
  onTake,
  onSkip,
  onSnooze,
  disabled,
}: DoseRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-brand-border bg-brand-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-brand-text">{slot.medicationName}</span>
          {slot.groupName && (
            <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-text-muted">
              {slot.groupName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-brand-text-muted">
          <Clock size={12} />
          <span>{to12h(slot.scheduledTime)}</span>
          {slot.dose && <span>· {slot.dose}</span>}
        </div>
      </div>

      {badgeVariant ? (
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
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
