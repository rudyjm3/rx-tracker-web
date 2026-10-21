"use client";

import Link from "next/link";
import { Bell, ClipboardList, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { setupLabel, useResumeSetup } from "@/components/layout/useResumeSetup";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import {
  SUPPLY_SEVERITY_LABEL,
  refillHref,
  useLowSupplyAlerts,
} from "@/components/dashboard/useLowSupplyAlerts";

// The user_notifications table exists in the schema but nothing populates
// it yet (no trigger/job writes low-stock rows) — this derives the same
// alerts live from each medication's current_quantity/low_supply_threshold
// instead of reading an always-empty table. Dismissals are shared with the
// dashboard reminder cards (per medication, per day, account-wide).
export function NotificationBell() {
  const { alerts, dismiss } = useLowSupplyAlerts();
  // Not dismissable: it clears itself once setup is finished, and hiding
  // the banner never touches it.
  const { needsSetup, name } = useResumeSetup();
  const count = alerts.length + (needsSetup ? 1 : 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-control p-2 text-brand-text hover:bg-brand-bg"
        >
          <Bell size={18} />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[18rem]">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {needsSetup && (
          <div className="flex items-start gap-2 border-l-4 border-status-warning px-3 py-2">
            <ClipboardList size={16} className="mt-0.5 shrink-0 text-status-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-brand-text">
                Finish setting up {setupLabel(name)} medications
              </p>
              <DropdownMenuItem
                asChild
                className="mt-2 inline-flex w-auto rounded-control bg-brand-deep-blue px-3 py-1 text-xs font-semibold text-white hover:opacity-90 data-[highlighted]:bg-brand-deep-blue data-[highlighted]:ring-2 data-[highlighted]:ring-brand-cyan"
              >
                <Link href="/onboarding">Resume setup</Link>
              </DropdownMenuItem>
            </div>
          </div>
        )}
        {count === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-brand-text-muted">
            You&apos;re all caught up.
          </p>
        ) : (
          alerts.map(({ medication, severity }) => (
            <div
              key={medication.id}
              className="flex items-start gap-2 border-l-4 border-status-warning px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <MedicationNameWithDose medication={medication} className="font-medium text-brand-text" />
                <p className="text-xs text-status-danger">
                  {SUPPLY_SEVERITY_LABEL[severity]} — {medication.current_quantity}{" "}
                  {medication.inventory_unit} remaining
                </p>
                <DropdownMenuItem
                  asChild
                  className="mt-2 inline-flex w-auto rounded-control bg-brand-deep-blue px-3 py-1 text-xs font-semibold text-white hover:opacity-90 data-[highlighted]:bg-brand-deep-blue data-[highlighted]:ring-2 data-[highlighted]:ring-brand-cyan"
                >
                  <Link href={refillHref(medication.id)}>Refill</Link>
                </DropdownMenuItem>
              </div>
              {/* Menu items (not bare buttons) so Radix's arrow-key roving
                  focus reaches them; preventDefault keeps the menu open. */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  dismiss(medication.id);
                }}
                aria-label={`Dismiss alert for ${medication.name}`}
                className="rounded-full p-1 text-brand-text-muted"
              >
                <X size={16} />
              </DropdownMenuItem>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
