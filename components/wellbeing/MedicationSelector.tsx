"use client";

import { cn } from "@/lib/cn";
import type { Medication } from "@/lib/types/medications";

interface MedicationSelectorProps {
  medications: Medication[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// Shows "Independent" plus the metric's currently-active, currently-
// tracking medications (already filtered by the caller). A medication
// that stops tracking this metric, or is deactivated, drops out of this
// list even though its historical entries are retained — a deliberate
// simplification versus the reference app's fuller "tracked at some
// point in the displayed range" reconstruction.
export function MedicationSelector({
  medications,
  selectedId,
  onSelect,
}: MedicationSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select medication to view">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-control border px-3 py-2 text-sm font-medium transition",
          selectedId === null
            ? "border-transparent bg-gradient-brand text-white"
            : "border-brand-border bg-white text-brand-text hover:bg-brand-bg",
        )}
      >
        Independent
        <span className="block text-xs font-normal opacity-80">No medication</span>
      </button>
      {medications.map((med) => (
        <button
          key={med.id}
          type="button"
          onClick={() => onSelect(med.id)}
          className={cn(
            "rounded-control border px-3 py-2 text-sm font-medium transition",
            selectedId === med.id
              ? "border-transparent bg-gradient-brand text-white"
              : "border-brand-border bg-white text-brand-text hover:bg-brand-bg",
          )}
        >
          {med.name}
          {med.dose && <span className="block text-xs font-normal opacity-80">{med.dose}</span>}
        </button>
      ))}
    </div>
  );
}
