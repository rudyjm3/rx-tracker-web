"use client";

import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarCheck,
  CalendarPlus,
  ChevronsDown,
  FileText,
  History,
  MoreVertical,
  Pencil,
  Power,
  SlidersHorizontal,
  Syringe,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { cn } from "@/lib/cn";
import { daysUntilRunout, to12h, type GroupDoseOverride } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { RefillModal } from "./RefillModal";
import { RefillHistoryModal } from "./RefillHistoryModal";
import { SideEffectModal } from "./SideEffectModal";
import { NotesModal } from "./NotesModal";
import { DoseHistoryPanel } from "./DoseHistoryPanel";
import { LogPastDoseModal } from "./log-past-dose/LogPastDoseModal";
import { DiscontinueModal } from "./DiscontinueModal";
import { ResumeModal } from "./ResumeModal";
import { UpdatePrescribedDoseModal } from "./UpdatePrescribedDoseModal";
import { MedicationDetailsModal } from "./MedicationDetailsModal";

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

function runoutSummary(med: Medication, groupDoseOverrides: GroupDoseOverride[]): string | null {
  const daysLeft = daysUntilRunout(med, groupDoseOverrides);
  if (daysLeft == null) return null;
  const runout = new Date();
  runout.setDate(runout.getDate() + daysLeft);
  const runoutLabel = runout.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `~${daysLeft} ${daysLeft === 1 ? "day" : "days"} left · runs out ~${runoutLabel}`;
}

type ModalKind =
  | "refill"
  | "refillHistory"
  | "adjust"
  | "doseChange"
  | "notes"
  | "sideEffects"
  | "logDose"
  | "details"
  | "discontinue"
  | "resume"
  | null;

interface MedicationCardProps {
  medication: Medication;
  groupDoseOverrides?: GroupDoseOverride[];
}

export function MedicationCard({ medication, groupDoseOverrides = [] }: MedicationCardProps) {
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
  const runoutText = runoutSummary(medication, groupDoseOverrides);
  const openDetails = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenModal("details");
  };

  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-brand-navy">{medication.name}</h3>
            <span
              role="button"
              tabIndex={0}
              onClick={openDetails}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openDetails(event);
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-brand-text-muted hover:bg-brand-bg hover:text-brand-deep-blue"
              aria-label={`View ${medication.name} details`}
            >
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
            </span>
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
                {runoutText && <> | {runoutText}</>}
              </p>
            </div>
          )}
          <div className="mt-2 flex justify-center">
            <ChevronsDown
              aria-hidden="true"
              size={16}
              className={cn(
                "text-brand-text-muted transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
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
            <DropdownMenuContent className="min-w-72 rounded-[2px] p-3">
              <DropdownMenuItem asChild>
                <Link href={`/medications/${medication.id}/edit`}>
                  <Pencil size={18} />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("logDose")}>
                <CalendarCheck size={18} />
                Log Dose
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("refill")}>
                <CalendarPlus size={18} />
                Log Refill
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("doseChange")}>
                <Syringe size={18} />
                Update prescribed dose
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("refillHistory")}>
                <History size={18} />
                Refill History
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("adjust")}>
                <SlidersHorizontal size={18} />
                Adjust Quantity
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("notes")}>
                <FileText size={18} />
                Notes/Instructions
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("sideEffects")}>
                <Activity size={18} />
                Side Effects
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-status-danger"
                onSelect={() => setOpenModal("discontinue")}
              >
                <Power size={18} />
                Discontinue Use
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setOpenModal("refillHistory")}
            >
              Refill History
            </Button>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setOpenModal("resume")}
            >
              Reactivate
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className={cn("mt-3 border-t border-brand-border pt-3")}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
            Dose history
          </p>
          <DoseHistoryPanel medicationId={medication.id} />
        </div>
      )}

      <LogPastDoseModal
        open={openModal === "logDose"}
        onOpenChange={(open) => setOpenModal(open ? "logDose" : null)}
        medication={medication}
      />
      <MedicationDetailsModal
        open={openModal === "details"}
        onOpenChange={(open) => setOpenModal(open ? "details" : null)}
        medication={medication}
      />
      {openModal === "refill" && (
        <RefillModal
          open
          onOpenChange={(open) => setOpenModal(open ? "refill" : null)}
          medication={medication}
          mode="refill"
        />
      )}
      {openModal === "adjust" && (
        <RefillModal
          open
          onOpenChange={(open) => setOpenModal(open ? "adjust" : null)}
          medication={medication}
          mode="adjust"
        />
      )}
      <RefillHistoryModal
        open={openModal === "refillHistory"}
        onOpenChange={(open) => setOpenModal(open ? "refillHistory" : null)}
        medication={medication}
      />
      {openModal === "doseChange" && (
        <UpdatePrescribedDoseModal
          open
          onOpenChange={(open) => setOpenModal(open ? "doseChange" : null)}
          medication={medication}
        />
      )}
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
