"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { to12h } from "@/lib/utils";
import { activateMedication, deactivateMedication } from "@/lib/medications";
import type { Medication } from "@/lib/types/medications";
import { RefillModal } from "./RefillModal";
import { SideEffectModal } from "./SideEffectModal";
import { NotesModal } from "./NotesModal";
import { DoseHistoryPanel } from "./DoseHistoryPanel";

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

type ModalKind = "refill" | "adjust" | "notes" | "sideEffects" | null;

export function MedicationCard({ medication }: { medication: Medication }) {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [expanded, setExpanded] = useState(false);

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateMedication(medication.id),
    onSuccess: () => {
      toast.success(`${medication.name} deactivated`);
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => activateMedication(medication.id),
    onSuccess: () => {
      toast.success(`${medication.name} reactivated`);
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const isLowSupply =
    medication.inventory_enabled &&
    medication.current_quantity != null &&
    medication.current_quantity <= medication.low_supply_threshold;

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
              <DropdownMenuItem onSelect={() => setOpenModal("refill")}>
                Log refill
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("adjust")}>
                Adjust quantity
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("notes")}>
                Notes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenModal("sideEffects")}>
                Side effects
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-status-danger"
                onSelect={() => deactivateMutation.mutate()}
              >
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="secondary"
            size="compact"
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
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
    </div>
  );
}
