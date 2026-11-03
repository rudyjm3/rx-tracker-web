"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import { hasInventoryWording, inventoryWordingForForm } from "./dose-forms";
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
  const mapped = hasInventoryWording(doseForm);
  const derived = inventoryWordingForForm(doseForm);
  const storedUnit = watch("inventoryUnit");
  // An empty/unmapped form keeps whatever wording the medication already has
  // (e.g. a custom unit on a medication being edited) rather than resetting it.
  const wording = mapped
    ? derived
    : { type: watch("inventoryType") || derived.type, unit: storedUnit || derived.unit };

  // Inventory type/unit aren't asked for again — they follow the form
  // chosen in the Medication step. Mirror them into the form values so
  // drafts and onboarding see the same wording.
  useEffect(() => {
    if (!mapped) return;
    setValue("inventoryType", derived.type);
    setValue("inventoryUnit", derived.unit);
  }, [mapped, derived.type, derived.unit, setValue]);

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
          <Field label="Next refill date (optional)">
            <input
              type="date"
              className={inputClass}
              {...register("nextRefillDate")}
            />
          </Field>
          <p className="-mt-2 text-xs text-brand-text-muted">
            Marked on the calendar. Leave the low supply threshold at 0 and this
            date is used for the refill alert instead of the pill count — set a
            threshold to be reminded before it.
          </p>
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
