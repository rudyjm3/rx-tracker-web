"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getActiveMedications } from "@/lib/medications";

type Severity = "out_of_stock" | "critical" | "low_stock";

function severityFor(current: number, threshold: number): Severity | null {
  if (current <= 0) return "out_of_stock";
  if (current <= threshold / 2) return "critical";
  if (current <= threshold) return "low_stock";
  return null;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  out_of_stock: "Out of stock",
  critical: "Critically low",
  low_stock: "Low supply",
};

// The user_notifications table exists in the schema but nothing populates
// it yet (no trigger/job writes low-stock rows) — this derives the same
// alerts live from each medication's current_quantity/low_supply_threshold
// instead of reading an always-empty table.
export function NotificationBell() {
  const { activeProfileId, isResolving } = useActiveProfile();
  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });

  const alerts = (medicationsQuery.data ?? [])
    .filter((m) => m.inventory_enabled && m.current_quantity != null)
    .map((m) => ({ medication: m, severity: severityFor(m.current_quantity!, m.low_supply_threshold) }))
    .filter((a): a is { medication: (typeof a)["medication"]; severity: Severity } => a.severity !== null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-control p-2 text-brand-text hover:bg-brand-bg"
        >
          <Bell size={18} />
          {alerts.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold text-white">
              {alerts.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[16rem]">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {alerts.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-brand-text-muted">
            You&apos;re all caught up.
          </p>
        ) : (
          alerts.map(({ medication, severity }) => (
            <DropdownMenuItem key={medication.id} asChild>
              <a href={`/medications`} className="flex flex-col items-start gap-0.5">
                <span className="font-medium text-brand-text">{medication.name}</span>
                <span className="text-xs text-status-danger">
                  {SEVERITY_LABEL[severity]} — {medication.current_quantity} {medication.inventory_unit} left
                </span>
              </a>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
