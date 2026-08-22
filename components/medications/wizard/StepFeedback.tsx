"use client";

import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import type { MedicationFormValues } from "./schema";

export function StepFeedback() {
  const { register } = useFormContext<MedicationFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <Field label="Track how you feel with each dose?">
        <select className={inputClass} {...register("feedbackType")}>
          <option value="none">Not tracking</option>
          <option value="pain">Pain level</option>
          <option value="mood">Mood</option>
          <option value="both">Pain and mood</option>
        </select>
      </Field>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input type="checkbox" {...register("dashboardEnabled")} />
          Show on dashboard
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input type="checkbox" {...register("remindersEnabled")} />
          Send reminders
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input type="checkbox" {...register("adherenceEnabled")} />
          Include in adherence tracking
        </label>
      </div>
    </div>
  );
}
