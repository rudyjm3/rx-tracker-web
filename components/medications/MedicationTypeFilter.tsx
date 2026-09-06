"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import type { MedicationType } from "@/lib/types/medications";

const FILTER_OPTIONS: { type: MedicationType; label: string }[] = [
  { type: "prescription", label: "Rx" },
  { type: "otc", label: "OTC" },
  { type: "supplement", label: "Vitamin / Supplement" },
];

interface MedicationTypeFilterProps {
  selected: Set<MedicationType>;
  onApply: (types: Set<MedicationType>) => void;
}

export function MedicationTypeFilter({ selected, onApply }: MedicationTypeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<MedicationType>>(selected);

  const isFiltered = selected.size < FILTER_OPTIONS.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(new Set(selected));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-control border border-brand-border bg-white text-brand-navy hover:bg-brand-bg"
          aria-label="Filter medications"
        >
          <SlidersHorizontal size={16} />
          {isFiltered && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-deep-blue" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
          Medication type
        </p>
        <div className="flex flex-col gap-2">
          {FILTER_OPTIONS.map((option) => {
            const checked = draft.has(option.type);
            return (
              <label
                key={option.type}
                className="flex cursor-pointer items-center gap-2 text-sm text-brand-text"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => {
                    setDraft((prev) => {
                      const next = new Set(prev);
                      if (value) next.add(option.type);
                      else next.delete(option.type);
                      return next;
                    });
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
        <Button
          size="compact"
          className="mt-3 w-full"
          onClick={() => {
            // Applying with nothing checked would hide every medication with
            // no way back short of finding this popover again — treat an
            // empty selection as "show all" instead of a silent empty state.
            onApply(draft.size === 0 ? new Set(FILTER_OPTIONS.map((o) => o.type)) : draft);
            setOpen(false);
          }}
        >
          Apply filters
        </Button>
      </PopoverContent>
    </Popover>
  );
}
