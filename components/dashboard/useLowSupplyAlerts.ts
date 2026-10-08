"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { dismissLowSupply, getDismissedMedicationIds } from "@/lib/low-supply-dismissals";
import { getActiveMedications } from "@/lib/medications";
import { localDateString } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";

export type SupplySeverity = "out_of_stock" | "critical" | "low_stock";

export const SUPPLY_SEVERITY_LABEL: Record<SupplySeverity, string> = {
  out_of_stock: "Out of stock",
  critical: "Critically low",
  low_stock: "Low supply",
};

function severityFor(current: number, threshold: number): SupplySeverity | null {
  if (current <= 0) return "out_of_stock";
  if (current <= threshold / 2) return "critical";
  if (current <= threshold) return "low_stock";
  return null;
}

export interface SupplyAlert {
  medication: Medication;
  severity: SupplySeverity;
}

export function refillHref(medicationId: string): string {
  return `/medications?refill=${encodeURIComponent(medicationId)}`;
}

// Shared by the dashboard reminder cards and the nav bell so a dismissal
// in either place hides the alert in both (and, via Supabase, on every
// other device for the rest of the day).
export function useLowSupplyAlerts() {
  const queryClient = useQueryClient();
  const { activeProfileId, isResolving } = useActiveProfile();
  const today = localDateString();

  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });
  const dismissalsQuery = useQuery({
    queryKey: ["low-supply-dismissals", today],
    queryFn: () => getDismissedMedicationIds(today),
  });

  const dismissed = dismissalsQuery.data;
  const alerts: SupplyAlert[] = [];
  // Wait for the dismissals read so an already-dismissed alert doesn't
  // flash on screen before it's filtered out.
  if (dismissed) {
    for (const medication of medicationsQuery.data ?? []) {
      if (!medication.inventory_enabled || medication.current_quantity == null) continue;
      if (dismissed.has(medication.id)) continue;
      const severity = severityFor(medication.current_quantity, medication.low_supply_threshold);
      if (severity) alerts.push({ medication, severity });
    }
  }

  const dismissMutation = useMutation({
    mutationFn: (medicationId: string) => dismissLowSupply(medicationId, today),
    onMutate: async (medicationId) => {
      const key = ["low-supply-dismissals", today];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Set<string>>(key);
      queryClient.setQueryData<Set<string>>(key, new Set([...(previous ?? []), medicationId]));
      return { previous };
    },
    onError: (_e, _id, context) => {
      queryClient.setQueryData(["low-supply-dismissals", today], context?.previous);
      toast.error("Couldn't dismiss reminder");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["low-supply-dismissals", today] }),
  });

  return { alerts, dismiss: (medicationId: string) => dismissMutation.mutate(medicationId) };
}
