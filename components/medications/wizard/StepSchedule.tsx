"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import type { MedicationFormValues } from "./schema";

export function StepSchedule() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<MedicationFormValues>();

  const asNeeded = watch("asNeeded");
  const scheduleMode = watch("scheduleMode");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "scheduleTimes",
  });

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input type="checkbox" {...register("asNeeded")} />
        Take as needed (no fixed schedule)
      </label>

      {!asNeeded && (
        <>
          <Field label="Schedule type">
            <select className={inputClass} {...register("scheduleMode")}>
              <option value="fixed_times">Fixed times</option>
              <option value="interval">Every N hours</option>
            </select>
          </Field>

          {scheduleMode === "fixed_times" && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-brand-text">Reminder times</span>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    type="time"
                    className={inputClass}
                    {...register(`scheduleTimes.${index}.reminderTime`)}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Qty override (optional)"
                    className={inputClass}
                    {...register(`scheduleTimes.${index}.quantityPerDose`)}
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-brand-text-muted hover:text-status-danger"
                    aria-label="Remove time"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {errors.scheduleTimes?.message && (
                <span className="text-xs text-status-danger">
                  {errors.scheduleTimes.message}
                </span>
              )}
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="self-start"
                onClick={() => append({ reminderTime: "08:00" })}
              >
                + Add time
              </Button>
            </div>
          )}

          {scheduleMode === "interval" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Every N hours" error={errors.intervalHours?.message}>
                <input
                  type="number"
                  min={1}
                  max={24}
                  className={inputClass}
                  {...register("intervalHours")}
                />
              </Field>
              <Field label="First dose time" error={errors.firstDoseTime?.message}>
                <input
                  type="time"
                  className={inputClass}
                  {...register("firstDoseTime")}
                />
              </Field>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input type="date" className={inputClass} {...register("startDate")} />
        </Field>
        <Field label="End date (optional)">
          <input type="date" className={inputClass} {...register("endDate")} />
        </Field>
      </div>
    </div>
  );
}
