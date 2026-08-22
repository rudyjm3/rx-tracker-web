"use client";

import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import type { MedicationFormValues } from "./schema";

export function StepInventory() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<MedicationFormValues>();

  const inventoryEnabled = watch("inventoryEnabled");

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input type="checkbox" {...register("inventoryEnabled")} />
        Track inventory / supply
      </label>

      {inventoryEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inventory type">
            <input
              type="text"
              placeholder="pills"
              className={inputClass}
              {...register("inventoryType")}
            />
          </Field>
          <Field label="Unit">
            <input
              type="text"
              placeholder="tablets"
              className={inputClass}
              {...register("inventoryUnit")}
            />
          </Field>
          <Field
            label="Starting quantity"
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
