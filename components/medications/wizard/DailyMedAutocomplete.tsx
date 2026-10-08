"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { searchDrugSuggestions, type DrugSuggestion } from "@/lib/dailymed";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { MedicationFormValues } from "./schema";

export function DailyMedAutocomplete() {
  const { register, setValue, watch } = useFormContext<MedicationFormValues>();
  const name = watch("name");
  const [term, setTerm] = useState(name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // `name` can change from outside this component's own onChange — e.g.
  // form.reset() populating the edit form or a resumed draft — which
  // wouldn't otherwise reach local `term` state, leaving the visible
  // input blank even though react-hook-form has the real value. Adjusted
  // during render (React's documented pattern for this) rather than in
  // a useEffect, to avoid an extra cascading render.
  const [prevName, setPrevName] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setTerm(name ?? "");
  }

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
    queryKey: ["dailymed-suggestions", debouncedTerm],
    queryFn: () => searchDrugSuggestions(debouncedTerm),
    enabled: debouncedTerm.trim().length >= 3,
  });

  const nameField = register("name");

  // A suggestion is a shortcut, not a lock: it fills the name (without the
  // strength) and, separately, the dose amount/unit and the matched SPL set
  // id — all of which stay editable. Fields the suggestion has no value for
  // (a concentration like "1 mg/mL", or a drug with no listed strength) are
  // left as the user had them.
  function applySuggestion(suggestion: DrugSuggestion) {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    setValue("name", suggestion.name, opts);
    if (suggestion.doseAmount != null && suggestion.doseUnit) {
      setValue("doseAmount", String(suggestion.doseAmount), opts);
      setValue("doseUnit", suggestion.doseUnit, opts);
    }
    setValue("dailymedSetId", suggestion.setId ?? "", opts);
    setTerm(suggestion.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        {...nameField}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          nameField.onChange(e);
          // The saved SPL match was for the previously picked name.
          setValue("dailymedSetId", "");
          setOpen(true);
        }}
        placeholder="Start typing a medication name…"
        className={cn(inputClass, "w-full")}
        autoComplete="off"
      />
      {open && results && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-control border border-brand-border bg-brand-card shadow-card">
          {results.map((result) => (
            <li key={`${result.label}|${result.setId ?? ""}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-brand-text hover:bg-brand-bg"
                onClick={() => applySuggestion(result)}
              >
                {result.label}
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
