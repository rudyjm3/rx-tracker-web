"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { saveDraft, deleteDraft, type ParsedDraft } from "@/lib/drafts";
import { defaultFormValues, type MedicationFormValues } from "@/components/medications/wizard/schema";
import { DailyMedAutocomplete } from "@/components/medications/wizard/DailyMedAutocomplete";
import { useOnboarding } from "./OnboardingContext";

const identitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  doseAmount: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) > 0), "Must be a positive number"),
  doseUnit: z.string().optional(),
  doseForm: z.string().optional(),
  medicationType: z.enum(["prescription", "otc", "supplement"]),
  asNeeded: z.boolean(),
});

type IdentityFormValues = z.infer<typeof identitySchema>;

function identityDefaults(draft?: ParsedDraft<MedicationFormValues>): IdentityFormValues {
  if (!draft) {
    return {
      name: "",
      doseAmount: "",
      doseUnit: "",
      doseForm: "",
      medicationType: "prescription",
      asNeeded: false,
    };
  }
  const { name, doseAmount, doseUnit, doseForm, medicationType, asNeeded } = draft.formData;
  return { name, doseAmount, doseUnit, doseForm, medicationType, asNeeded };
}

function IdentityForm({
  draft,
  onSaved,
  onCancel,
}: {
  draft?: ParsedDraft<MedicationFormValues>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { profileId, refreshDrafts } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: identityDefaults(draft),
  });

  async function onSubmit(values: IdentityFormValues) {
    setSaving(true);
    try {
      const formData: MedicationFormValues = {
        ...(draft?.formData ?? defaultFormValues),
        ...values,
      };
      await saveDraft({
        id: draft?.id,
        formData,
        currentStep: 1,
        furthestStep: draft?.furthestStep ?? 1,
        profileId,
      });
      refreshDrafts();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save medication");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Medication name" error={form.formState.errors.name?.message}>
          <DailyMedAutocomplete />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Amount" error={form.formState.errors.doseAmount?.message}>
            <input type="number" step="any" className={inputClass} {...form.register("doseAmount")} />
          </Field>
          <Field label="Unit">
            <input type="text" placeholder="mg" className={inputClass} {...form.register("doseUnit")} />
          </Field>
          <Field label="Form">
            <input type="text" placeholder="tablet" className={inputClass} {...form.register("doseForm")} />
          </Field>
        </div>
        <Field label="Type">
          <select className={inputClass} {...form.register("medicationType")}>
            <option value="prescription">Prescription</option>
            <option value="otc">Over-the-counter</option>
            <option value="supplement">Supplement</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input type="checkbox" {...form.register("asNeeded")} />
          Take as needed (no fixed schedule)
        </label>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : draft ? "Save changes" : "Add medication"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

export function StepMedications() {
  const { drafts, refreshDrafts } = useOnboarding();
  const [editingDraft, setEditingDraft] = useState<ParsedDraft<MedicationFormValues> | "new" | null>(
    null,
  );

  async function handleDelete(id: string) {
    try {
      await deleteDraft(id);
      refreshDrafts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove medication");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-text-muted">
        Add the medications you want to track. You can fill in the schedule and supply details in
        the next steps.
      </p>

      {drafts.length === 0 ? (
        <p className="text-sm text-brand-text-muted">No medications added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="flex items-center justify-between rounded-control border border-brand-border px-3 py-2"
            >
              <button
                type="button"
                onClick={() => setEditingDraft(draft)}
                className="text-left text-sm text-brand-text hover:text-brand-deep-blue"
              >
                <span className="font-medium">{draft.formData.name || "Untitled medication"}</span>
                {draft.formData.doseAmount && (
                  <span className="text-brand-text-muted">
                    {" "}
                    — {draft.formData.doseAmount} {draft.formData.doseUnit}
                  </span>
                )}
                {draft.formData.asNeeded && (
                  <span className="text-brand-text-muted"> (as needed)</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(draft.id)}
                aria-label="Remove medication"
                className="text-brand-text-muted hover:text-status-danger"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setEditingDraft("new")}
      >
        <Plus size={16} /> Add medication
      </Button>

      <Dialog open={editingDraft !== null} onOpenChange={(open) => !open && setEditingDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDraft && editingDraft !== "new" ? "Edit medication" : "Add medication"}
            </DialogTitle>
          </DialogHeader>
          {editingDraft !== null && (
            <IdentityForm
              draft={editingDraft === "new" ? undefined : editingDraft}
              onSaved={() => setEditingDraft(null)}
              onCancel={() => setEditingDraft(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
