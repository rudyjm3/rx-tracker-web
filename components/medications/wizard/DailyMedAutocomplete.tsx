"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { searchDrugName } from "@/lib/dailymed";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { MedicationFormValues } from "./schema";

export function DailyMedAutocomplete() {
  const { register, setValue, watch } = useFormContext<MedicationFormValues>();
  const name = watch("name");
  const [term, setTerm] = useState(name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const debouncedTerm = useDebouncedValue(term, 300);

  const { data: results } = useQuery({
    queryKey: ["dailymed-search", debouncedTerm],
    queryFn: () => searchDrugName(debouncedTerm),
    enabled: debouncedTerm.trim().length >= 3,
  });

  const nameField = register("name");

  return (
    <div ref={containerRef} className="relative">
      <input
        {...nameField}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          nameField.onChange(e);
          setOpen(true);
        }}
        placeholder="Start typing a medication name…"
        className={cn(inputClass, "w-full")}
        autoComplete="off"
      />
      {open && results && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-control border border-brand-border bg-brand-card shadow-card">
          {results.map((result) => (
            <li key={result.setid}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-brand-text hover:bg-brand-bg"
                onClick={() => {
                  setValue("name", result.title, { shouldValidate: true });
                  setTerm(result.title);
                  setOpen(false);
                }}
              >
                {result.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}
