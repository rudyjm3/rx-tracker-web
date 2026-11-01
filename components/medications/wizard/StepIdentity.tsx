"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DOSE_FORM_OPTIONS, DOSE_UNIT_OPTIONS } from "./dose-forms";
import { DailyMedAutocomplete } from "./DailyMedAutocomplete";
import type { MedicationFormValues } from "./schema";

export function StepIdentity() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MedicationFormValues>();

  // Hidden by default per spec ("+ Add End Date" / "+ Add Instructions / notes"), but
  // start pre-revealed when hydrating a value that's already set (edit
  // mode, or a draft resumed mid-fill) so existing data isn't hidden
  // behind a collapsed toggle.
  const [showEndDate, setShowEndDate] = useState(() => Boolean(watch("endDate")));
  const [showNotes, setShowNotes] = useState(() => Boolean(watch("instructions")));

  // Editing the dose by hand means the picked suggestion's strength (and
  // its SPL set id) no longer describes this medication.
  const clearDailyMedMatch = { onChange: () => setValue("dailymedSetId", "") };

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
            {...register("doseAmount", clearDailyMedMatch)}
          />
        </Field>
        <Field label="Unit">
          <select className={inputClass} {...register("doseUnit", clearDailyMedMatch)}>
            {DOSE_UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Form">
          <select className={inputClass} {...register("doseForm")}>
            <option value="">-- select --</option>
            {DOSE_FORM_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
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
          + Add Instructions / notes
        </button>
      )}
    </div>
  );
}
