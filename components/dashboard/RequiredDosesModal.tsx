"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { formatClockTime, to12h } from "@/lib/utils";
import type { DaySlot } from "@/lib/schedule";

interface RequiredDosesModalProps {
  open: boolean;
  onClose: () => void;
  slots: DaySlot[];
}

function statusLabel(slot: DaySlot): { text: string; className: string } {
  if (slot.status === "taken") return { text: "Taken", className: "text-status-success" };
  if (slot.status === "missed") return { text: "Missed", className: "text-status-danger" };
  if (slot.status === "skipped") return { text: "Skipped", className: "text-status-warning" };
  if (slot.postponedUntil && new Date(slot.postponedUntil).getTime() > Date.now()) {
    return { text: `Snoozed until ${formatClockTime(slot.postponedUntil)}`, className: "text-brand-blue" };
  }
  return { text: "Pending", className: "text-brand-text-muted" };
}

export function RequiredDosesModal({ open, onClose, slots }: RequiredDosesModalProps) {
  const required = slots.filter((s) => s.medication.adherence_enabled && !s.isPrn);
  const byMedication = new Map<string, DaySlot[]>();
  for (const slot of required) {
    const existing = byMedication.get(slot.medicationId) ?? [];
    existing.push(slot);
    byMedication.set(slot.medicationId, existing);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>Required doses today</DialogTitle>
        </DialogHeader>

        {byMedication.size === 0 ? (
          <p className="text-sm text-brand-text-muted">No required doses scheduled today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...byMedication.entries()].map(([medicationId, medSlots]) => (
              <details
                key={medicationId}
                className="rounded-control border border-brand-border p-3"
                open
              >
                <summary className="cursor-pointer font-medium text-brand-text">
                  {medSlots[0].medicationName}
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {medSlots.map((slot) => {
                    const { text, className } = statusLabel(slot);
                    return (
                      <li
                        key={`${slot.medicationId}|${slot.scheduledTime}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-brand-text-muted">{to12h(slot.scheduledTime)}</span>
                        <Badge
                          variant={
                            slot.status === "pending" ? "pending" : (slot.status as "taken")
                          }
                          className={className}
                        >
                          {text}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
