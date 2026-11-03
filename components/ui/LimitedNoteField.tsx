"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const BASE_LIMIT = 255;
const EXTRA = 150;

// Notes textarea with a "[n/limit]" counter under its bottom-left corner. Once
// the base limit is reached the user can raise it by EXTRA characters — one
// time only; at the extended limit there is no further option.
export function LimitedNoteField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  // A note saved before limits existed may already be past the base limit.
  const [extended, setExtended] = useState(value.length > BASE_LIMIT);
  const limit = extended ? Math.max(BASE_LIMIT + EXTRA, value.length) : BASE_LIMIT;
  const atLimit = value.length >= limit;

  return (
    <Field label={label}>
      <textarea
        className={inputClass}
        rows={rows}
        maxLength={limit}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <span className="flex items-center justify-between text-xs">
        <span className={cn(atLimit ? "font-semibold text-status-danger" : "text-brand-text-muted")}>
          [{value.length}/{limit}]
        </span>
        {atLimit && !extended ? (
          <button
            type="button"
            onClick={() => setExtended(true)}
            className="font-semibold text-brand-blue hover:underline"
          >
            Add {EXTRA} more characters
          </button>
        ) : null}
      </span>
    </Field>
  );
}
