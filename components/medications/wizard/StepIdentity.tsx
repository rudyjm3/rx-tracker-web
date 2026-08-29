"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DailyMedAutocomplete } from "./DailyMedAutocomplete";
import type { MedicationFormValues } from "./schema";

export function StepIdentity() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<MedicationFormValues>();

  // Hidden by default per spec ("+ Add End Date" / "+ Add Notes"), but
  // start pre-revealed when hydrating a value that's already set (edit
  // mode, or a draft resumed mid-fill) so existing data isn't hidden
  // behind a collapsed toggle.
  const [showEndDate, setShowEndDate] = useState(() => Boolean(watch("endDate")));
  const [showNotes, setShowNotes] = useState(() => Boolean(watch("instructions")));

  return (
    <div className="flex flex-col gap-4">
      <Field label="Medication name" error={errors.name?.message}>
        <DailyMedAutocomplete />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Dose amount" error={errors.doseAmount?.message}>
          <input
            type="number"
            step="any"
            className={inputClass}
            {...register("doseAmount")}
          />
        </Field>
        <Field label="Unit">
          <input
            type="text"
            placeholder="mg"
            className={inputClass}
            {...register("doseUnit")}
          />
        </Field>
        <Field label="Form">
          <input
            type="text"
            placeholder="tablet"
            className={inputClass}
            {...register("doseForm")}
          />
        </Field>
      </div>

      <Field label="Type">
        <select className={inputClass} {...register("medicationType")}>
          <option value="prescription">Prescription</option>
          <option value="otc">Over the counter</option>
          <option value="supplement">Supplement</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input type="date" className={inputClass} {...register("startDate")} />
        </Field>
        {showEndDate ? (
          <Field label="End date">
            <input type="date" className={inputClass} {...register("endDate")} />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setShowEndDate(true)}
            className="self-end pb-2 text-left text-sm font-medium text-brand-deep-blue hover:underline"
          >
            + Add End Date
          </button>
        )}
      </div>

      {showNotes ? (
        <Field label="Instructions">
          <textarea
            rows={2}
            className={cn(inputClass, "resize-none")}
            {...register("instructions")}
          />
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="self-start text-sm font-medium text-brand-deep-blue hover:underline"
        >
          + Add Notes
        </button>
      )}
    </div>
  );
}
