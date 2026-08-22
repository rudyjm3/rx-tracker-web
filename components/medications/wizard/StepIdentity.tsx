"use client";

import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DailyMedAutocomplete } from "./DailyMedAutocomplete";
import type { MedicationFormValues } from "./schema";

export function StepIdentity() {
  const {
    register,
    formState: { errors },
  } = useFormContext<MedicationFormValues>();

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

      <Field label="Instructions">
        <textarea
          rows={2}
          className={cn(inputClass, "resize-none")}
          {...register("instructions")}
        />
      </Field>

      <Field label="Type">
        <select className={inputClass} {...register("medicationType")}>
          <option value="prescription">Prescription</option>
          <option value="otc">Over the counter</option>
          <option value="supplement">Supplement</option>
        </select>
      </Field>
    </div>
  );
}
