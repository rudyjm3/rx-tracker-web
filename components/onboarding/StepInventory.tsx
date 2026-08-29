"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { saveDraft, type ParsedDraft } from "@/lib/drafts";
import type { MedicationFormValues } from "@/components/medications/wizard/schema";
import { dosesPerDay, localDateString } from "@/lib/utils";
import { useOnboarding } from "./OnboardingContext";

type Method = "count" | "estimate" | "skip";

function InventoryCard({ draft }: { draft: ParsedDraft<MedicationFormValues> }) {
  const { profileId, refreshDrafts } = useOnboarding();
  const [method, setMethod] = useState<Method>("count");
  const [count, setCount] = useState(draft.formData.startingQuantity);
  const [fillDate, setFillDate] = useState(localDateString());
  const [dispensed, setDispensed] = useState("");
  const [showCarryover, setShowCarryover] = useState(false);
  const [carryover, setCarryover] = useState("0");
  const [estimated, setEstimated] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleCalculate() {
    const dispensedNum = Number(dispensed);
    if (!Number.isFinite(dispensedNum) || dispensedNum < 0) {
      toast.error("Enter how many were dispensed");
      return;
    }
    const perDay = dosesPerDay(
      draft.formData.scheduleMode,
      draft.formData.scheduleTimes.length,
      Number(draft.formData.intervalHours) || null,
    );
    const daysElapsed = Math.max(
      0,
      Math.floor(
        (new Date(localDateString()).getTime() - new Date(fillDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const qtyPerDose = Number(draft.formData.quantityPerDose) || 1;
    const carryoverNum = Number(carryover) || 0;
    const remaining = Math.max(
      0,
      dispensedNum + carryoverNum - daysElapsed * perDay * qtyPerDose,
    );
    setEstimated(remaining);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (method === "skip") {
        await saveDraft({
          id: draft.id,
          formData: { ...draft.formData, inventoryEnabled: false },
          currentStep: 4,
          furthestStep: Math.max(draft.furthestStep, 4),
          profileId,
        });
      } else {
        const quantity = method === "count" ? count : String(estimated ?? "");
        if (!quantity) {
          toast.error(method === "count" ? "Enter the current quantity" : "Calculate the estimate first");
          setSaving(false);
          return;
        }
        await saveDraft({
          id: draft.id,
          formData: { ...draft.formData, startingQuantity: quantity },
          currentStep: 4,
          furthestStep: Math.max(draft.furthestStep, 4),
          profileId,
        });
      }
      refreshDrafts();
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save inventory");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-control border border-brand-border p-4">
      <h3 className="mb-3 font-medium text-brand-text">
        {draft.formData.name || "Untitled medication"}
      </h3>

      <div className="mb-3 flex gap-2">
        <Button
          type="button"
          size="compact"
          variant={method === "count" ? "primary" : "secondary"}
          onClick={() => setMethod("count")}
        >
          Count now
        </Button>
        <Button
          type="button"
          size="compact"
          variant={method === "estimate" ? "primary" : "secondary"}
          onClick={() => setMethod("estimate")}
        >
          Estimate from fill
        </Button>
        <Button
          type="button"
          size="compact"
          variant={method === "skip" ? "primary" : "secondary"}
          onClick={() => setMethod("skip")}
        >
          Skip
        </Button>
      </div>

      {method === "count" && (
        <Field label={`Current quantity (${draft.formData.inventoryUnit || "units"})`}>
          <input
            type="number"
            step="any"
            className={inputClass}
            value={count}
            onChange={(e) => {
              setCount(e.target.value);
              setSaved(false);
            }}
          />
        </Field>
      )}

      {method === "estimate" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fill date">
              <input
                type="date"
                className={inputClass}
                value={fillDate}
                onChange={(e) => {
                  setFillDate(e.target.value);
                  setEstimated(null);
                  setSaved(false);
                }}
              />
            </Field>
            <Field label="Quantity dispensed">
              <input
                type="number"
                step="any"
                className={inputClass}
                value={dispensed}
                onChange={(e) => {
                  setDispensed(e.target.value);
                  setEstimated(null);
                  setSaved(false);
                }}
              />
            </Field>
          </div>
          {showCarryover ? (
            <Field label="Carryover from previous supply (optional)">
              <input
                type="number"
                step="any"
                className={inputClass}
                value={carryover}
                onChange={(e) => {
                  setCarryover(e.target.value);
                  setEstimated(null);
                  setSaved(false);
                }}
              />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setShowCarryover(true)}
              className="self-start text-sm text-brand-deep-blue hover:underline"
            >
              + Add carryover from previous supply
            </button>
          )}
          <Button type="button" size="compact" variant="secondary" onClick={handleCalculate}>
            Calculate
          </Button>
          {estimated != null && (
            <p className="text-sm text-brand-text">
              Estimated remaining: <span className="font-medium">{estimated}</span>{" "}
              {draft.formData.inventoryUnit || "units"}
            </p>
          )}
        </div>
      )}

      {method === "skip" && (
        <p className="text-sm text-brand-text-muted">
          Inventory tracking will be turned off for this medication — you can set it up later.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" size="compact" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-status-success">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

export function StepInventory() {
  const { drafts } = useOnboarding();
  const inventoryDrafts = drafts.filter((d) => d.formData.inventoryEnabled);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-text-muted">
        Set the current supply for each medication you&rsquo;re tracking inventory for.
      </p>
      {inventoryDrafts.map((draft) => (
        <InventoryCard key={draft.id} draft={draft} />
      ))}
    </div>
  );
}
