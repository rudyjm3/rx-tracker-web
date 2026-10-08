"use client";

import Link from "next/link";
import { ChevronRight, PillBottle, X } from "lucide-react";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { SUPPLY_SEVERITY_LABEL, refillHref, useLowSupplyAlerts } from "./useLowSupplyAlerts";

// One reminder card per low medication, styled like the hero panel.
// Dismissal is per-medication per-day and account-wide (see
// lib/low-supply-dismissals.ts); a still-low medication comes back tomorrow.
export function LowSupplyBanner() {
  const { alerts, dismiss } = useLowSupplyAlerts();

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" aria-label="Refill reminders">
      {alerts.map(({ medication, severity }) => (
        <section
          key={medication.id}
          className="flex items-start gap-4 rounded-[28px] bg-[linear-gradient(135deg,#18d0dc_0%,#0a8ac8_38%,#0754a8_68%,#071d3d_100%)] px-5 py-5 text-white shadow-[0_16px_40px_rgba(7,29,61,0.2)] sm:px-6"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <PillBottle size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Reminder · {SUPPLY_SEVERITY_LABEL[severity]}
            </p>
            <p className="mt-1 text-lg font-bold">
              Refill: <MedicationNameWithDose medication={medication} doseClassName="text-[0.875em] font-bold text-white/70" />
            </p>
            <p className="text-sm text-white/80">
              Pills Left: {medication.current_quantity} {medication.inventory_unit}
            </p>
            <Link
              href={refillHref(medication.id)}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              Refill
              <ChevronRight size={14} />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismiss(medication.id)}
            aria-label={`Dismiss refill reminder for ${medication.name}`}
            className="rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X size={18} />
          </button>
        </section>
      ))}
    </div>
  );
}
