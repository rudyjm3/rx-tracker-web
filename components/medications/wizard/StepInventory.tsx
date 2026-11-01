"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import { inventoryWordingForForm } from "./dose-forms";
import type { MedicationFormValues } from "./schema";

export function StepInventory() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MedicationFormValues>();

  const inventoryEnabled = watch("inventoryEnabled");
  const doseForm = watch("doseForm");
  const wording = inventoryWordingForForm(doseForm);

  // Inventory type/unit aren't asked for again — they follow the form
  // chosen in the Medication step. Mirror them into the form values so
  // drafts and onboarding see the same wording.
  useEffect(() => {
    setValue("inventoryType", wording.type);
    setValue("inventoryUnit", wording.unit);
  }, [wording.type, wording.unit, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input type="checkbox" {...register("inventoryEnabled")} />
        Track inventory / supply
      </label>

      {inventoryEnabled && (
        <>
          <p className="text-sm text-brand-text-muted">
            Tracking supply in <strong className="text-brand-text">{wording.unit}</strong>
            {doseForm ? (
              <> (from the form chosen in the Medication step).</>
            ) : (
              <> — choose a form in the Medication step to change this.</>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Starting quantity (${wording.unit})`}
              error={errors.startingQuantity?.message}
            >
              <input
                type="number"
                step="any"
                className={inputClass}
                {...register("startingQuantity")}
              />
            </Field>
            <Field label="Low supply threshold">
              <input
                type="number"
                step="1"
                className={inputClass}
                {...register("lowSupplyThreshold")}
              />
            </Field>
          </div>
        </>
      )}

      <Field label="Quantity per dose" error={errors.quantityPerDose?.message}>
        <input
          type="number"
          step="any"
          className={inputClass}
          {...register("quantityPerDose")}
        />
      </Field>
    </div>
  );
}
