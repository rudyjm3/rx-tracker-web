"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { cn } from "@/lib/cn";
import { to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { RefillModal } from "./RefillModal";
import { SideEffectModal } from "./SideEffectModal";
import { NotesModal } from "./NotesModal";
import { DoseHistoryPanel } from "./DoseHistoryPanel";
import { LogPastDoseModal } from "./log-past-dose/LogPastDoseModal";
import { DiscontinueModal } from "./DiscontinueModal";
import { ResumeModal } from "./ResumeModal";

function scheduleSummary(med: Medication): string {
  if (med.as_needed) return "As needed";
  if (med.schedule_mode === "interval") {
    return med.interval_hours
      ? `Every ${med.interval_hours}h${med.first_dose_time ? ` from ${to12h(med.first_dose_time)}` : ""}`
      : "Interval schedule";
  }
  const times = med.medication_schedule_times ?? [];
  if (times.length === 0) return "No schedule set";
  return times
    .slice()
    .sort((a, b) => a.reminder_time.localeCompare(b.reminder_time))
    .map((t) => to12h(t.reminder_time))
    .join(", ");
}

type ModalKind =
  | "refill"
  | "adjust"
  | "notes"
  | "sideEffects"
  | "logDose"
  | "discontinue"
  | "resume"
  | null;

export function MedicationCard({ medication }: { medication: Medication }) {
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [expanded, setExpanded] = useState(false);

  const isLowSupply =
    medication.inventory_enabled &&
    medication.current_quantity != null &&
    medication.current_quantity <= medication.low_supply_threshold;

  // Inventory bar: current_quantity against the medication's own
  // starting_quantity when it has one (the natural "how full" baseline),
  // falling back to a reasonable capacity derived from the low-supply
  // threshold when starting_quantity was never captured — avoids a
  // divide-by-zero and keeps the bar meaningful either way.
  const showInventoryBar =
    medication.inventory_enabled && medication.current_quantity != null;
  const currentQty = medication.current_quantity ?? 0;
  const capacity =
    medication.starting_quantity && medication.starting_quantity > 0
      ? medication.starting_quantity
      : Math.max(currentQty, medication.low_supply_threshold * 4, 1);
  const fillPct = Math.max(0, Math.min(100, (currentQty / capacity) * 100));
  const fillColor = isLowSupply
    ? "bg-status-danger"
    : fillPct <= 50
      ? "bg-status-warning"
      : "bg-status-success";

  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-brand-navy">{medication.name}</h3>
            <MedTypeBadge type={medication.medication_type} />
            {isLowSupply && (
              <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                Low supply
              </span>
            )}
          </div>
          {medication.dose && (
            <p className="text-sm text-brand-text-muted">{medication.dose}</p>
          )}
          <p className="text-sm text-brand-text-muted">{scheduleSummary(medication)}</p>

          {showInventoryBar && (
            <div className="mt-2 max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-bg">
                <div
                  className={cn("h-full rounded-full", fillColor)}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-brand-text-muted">
                {currentQty} / {capacity} {medication.inventory_unit}
              </p>
            </div>
          )}
        </button>

        {medication.active ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-control p-1.5 text-brand-text-muted hover:bg-brand-bg"
                aria-label="Medication actions"
              >
                <MoreVertical size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href={`/medications/${medication.id}/edit`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("logDose")}>
                Log Dose
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("refill")}>
                Log Refill
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("adjust")}>
                Adjust Quantity
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("notes")}>
                Notes/Instructions
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("sideEffects")}>
                Side Effects
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-status-danger"
                onSelect={() => setOpenModal("discontinue")}
              >
                Discontinue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="secondary"
            size="compact"
            onClick={() => setOpenModal("resume")}
          >
            Reactivate
          </Button>
        )}
      </div>

      {expanded && (
        <div className={cn("mt-3 border-t border-brand-border pt-3")}>
          <DoseHistoryPanel medicationId={medication.id} />
        </div>
      )}

      <LogPastDoseModal
        open={openModal === "logDose"}
        onOpenChange={(open) => setOpenModal(open ? "logDose" : null)}
        medication={medication}
      />
      <RefillModal
        open={openModal === "refill"}
        onOpenChange={(open) => setOpenModal(open ? "refill" : null)}
        medication={medication}
        mode="refill"
      />
      <RefillModal
        open={openModal === "adjust"}
        onOpenChange={(open) => setOpenModal(open ? "adjust" : null)}
        medication={medication}
        mode="adjust"
      />
      <NotesModal
        open={openModal === "notes"}
        onOpenChange={(open) => setOpenModal(open ? "notes" : null)}
        medication={medication}
      />
      <SideEffectModal
        open={openModal === "sideEffects"}
        onOpenChange={(open) => setOpenModal(open ? "sideEffects" : null)}
        medication={medication}
      />
      <DiscontinueModal
        open={openModal === "discontinue"}
        onOpenChange={(open) => setOpenModal(open ? "discontinue" : null)}
        medication={medication}
      />
      <ResumeModal
        open={openModal === "resume"}
        onOpenChange={(open) => setOpenModal(open ? "resume" : null)}
        medication={medication}
      />
    </div>
  );
}
