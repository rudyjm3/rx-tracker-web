"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { saveDraft, type ParsedDraft } from "@/lib/drafts";
import type { MedicationFormValues } from "@/components/medications/wizard/schema";
import { useOnboarding } from "./OnboardingContext";

type TrackingField = "remindersEnabled" | "adherenceEnabled" | "inventoryEnabled";

const COLUMNS: { field: TrackingField; label: string }[] = [
  { field: "remindersEnabled", label: "Reminders" },
  { field: "adherenceEnabled", label: "Adherence" },
  { field: "inventoryEnabled", label: "Inventory" },
];

export function StepTracking() {
  const { profileId, drafts, refreshDrafts } = useOnboarding();

  async function patchDraft(draft: ParsedDraft<MedicationFormValues>, field: TrackingField, value: boolean) {
    try {
      await saveDraft({
        id: draft.id,
        formData: { ...draft.formData, [field]: value },
        currentStep: 2,
        furthestStep: Math.max(draft.furthestStep, 2),
        profileId,
      });
      refreshDrafts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save tracking preference");
    }
  }

  async function toggleAll(field: TrackingField, value: boolean) {
    const targets = drafts.filter((d) => !(field !== "inventoryEnabled" && d.formData.asNeeded));
    try {
      await Promise.all(
        targets.map((d) =>
          saveDraft({
            id: d.id,
            formData: { ...d.formData, [field]: value },
            currentStep: 2,
            furthestStep: Math.max(d.furthestStep, 2),
            profileId,
          }),
        ),
      );
      refreshDrafts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update tracking preferences");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-text-muted">
        Choose what to track for each medication. As-needed medications don&rsquo;t get reminders or
        adherence tracking.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-text-muted">
              <th className="py-2 pr-2 font-medium">Medication</th>
              {COLUMNS.map((col) => (
                <th key={col.field} className="px-2 py-2 text-center font-medium">
                  <div className="flex flex-col items-center gap-1">
                    {col.label}
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="compact"
                        variant="secondary"
                        onClick={() => void toggleAll(col.field, true)}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        size="compact"
                        variant="secondary"
                        onClick={() => void toggleAll(col.field, false)}
                      >
                        None
                      </Button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id} className="border-t border-brand-border">
                <td className="py-2 pr-2 text-brand-text">
                  {draft.formData.name || "Untitled medication"}
                  {draft.formData.asNeeded && (
                    <span className="text-brand-text-muted"> (as needed)</span>
                  )}
                </td>
                {COLUMNS.map((col) => {
                  const disabled = col.field !== "inventoryEnabled" && draft.formData.asNeeded;
                  return (
                    <td key={col.field} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={disabled ? false : draft.formData[col.field]}
                        onChange={(e) => void patchDraft(draft, col.field, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
