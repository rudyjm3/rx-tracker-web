"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { createMedication, getMedication, updateMedication } from "@/lib/medications";
import { deleteDraft, getDraft, saveDraft } from "@/lib/drafts";
import {
  defaultFormValues,
  medicationFormSchema,
  STEP_FIELDS,
  STEP_LABELS,
  type MedicationFormValues,
} from "./schema";
import { medicationToFormValues, toMedicationInput, toScheduleTimes } from "./mappers";
import { StepIdentity } from "./StepIdentity";
import { StepSchedule } from "./StepSchedule";
import { StepInventory } from "./StepInventory";
import { StepFeedback } from "./StepFeedback";

const STEP_COMPONENTS = [StepIdentity, StepSchedule, StepInventory, StepFeedback];

interface WizardShellProps {
  mode: "create" | "edit";
  medicationId?: string;
  draftId?: string;
}

export function WizardShell({ mode, medicationId, draftId }: WizardShellProps) {
  const router = useRouter();
  const { activeProfileId } = useActiveProfile();
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);
  const [submitting, setSubmitting] = useState(false);
  const hasHydrated = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: defaultFormValues,
  });

  const editQuery = useQuery({
    queryKey: ["medication", medicationId],
    queryFn: () => getMedication(medicationId as string),
    enabled: mode === "edit" && Boolean(medicationId),
  });

  const draftQuery = useQuery({
    queryKey: ["medication-draft", draftId],
    queryFn: () => getDraft<MedicationFormValues>(draftId as string),
    enabled: mode === "create" && Boolean(draftId),
  });

  useEffect(() => {
    if (hasHydrated.current) return;
    if (mode === "edit" && editQuery.data) {
      form.reset(medicationToFormValues(editQuery.data));
      hasHydrated.current = true;
    }
    if (mode === "create" && draftQuery.data) {
      form.reset(draftQuery.data.formData);
      setStep(draftQuery.data.currentStep);
      setFurthestStep(draftQuery.data.furthestStep);
      hasHydrated.current = true;
    }
  }, [mode, editQuery.data, draftQuery.data, form]);

  async function persistDraft(explicitStep?: number) {
    if (mode !== "create") return;
    const stepToSave = explicitStep ?? step;
    try {
      const id = await saveDraft({
        id: currentDraftId,
        formData: form.getValues(),
        currentStep: stepToSave,
        furthestStep: Math.max(furthestStep, stepToSave),
        profileId: activeProfileId,
      });
      setCurrentDraftId((prev) => prev ?? id);
    } catch {
      // Best-effort autosave — not worth interrupting the user over a
      // transient failure; the guaranteed save on step change will retry.
    }
  }

  useEffect(() => {
    if (mode !== "create") return;
    const subscription = form.watch(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void persistDraft();
      }, 1500);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function handleNext() {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (!valid) return;
    const nextStep = Math.min(step + 1, STEP_LABELS.length);
    setStep(nextStep);
    setFurthestStep((f) => Math.max(f, nextStep));
    await persistDraft(nextStep);
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function onSubmit(values: MedicationFormValues) {
    setSubmitting(true);
    try {
      const input = toMedicationInput(values);
      const scheduleTimes = toScheduleTimes(values);

      if (mode === "create") {
        await createMedication({ ...input, profile_id: activeProfileId }, scheduleTimes);
        if (currentDraftId) await deleteDraft(currentDraftId);
        toast.success("Medication added");
      } else {
        // Preserve the medication's existing profile assignment —
        // editing doesn't move a medication between profiles, and
        // updateMedication writes profile_id unconditionally on every
        // save, so omitting it here would silently null it out.
        await updateMedication(
          medicationId as string,
          { ...input, profile_id: editQuery.data?.profile_id ?? null },
          scheduleTimes,
        );
        toast.success("Medication updated");
      }

      router.push("/medications");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading =
    (mode === "edit" && editQuery.isLoading) ||
    (mode === "create" && Boolean(draftId) && draftQuery.isLoading);

  if (isLoading) {
    return <p className="text-brand-text-muted">Loading…</p>;
  }

  const StepComponent = STEP_COMPONENTS[step - 1];
  const isLastStep = step === STEP_LABELS.length;

  // The primary button always stays type="button" and is always the same
  // DOM node across steps — it never swaps to type="submit". A step
  // change re-renders this button with a new label/behavior at the same
  // screen position; if it *did* swap types, a click landing right on
  // that transition (mousedown on "Next", mouseup on the newly-rendered
  // "Add medication" submit button) could fire an accidental early
  // submit. Routing both actions through one handler avoids that.
  async function handlePrimaryAction() {
    if (isLastStep) {
      await form.handleSubmit(onSubmit)();
    } else {
      await handleNext();
    }
  }

  return (
    <FormProvider {...form}>
      <div className="mb-6 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === step;
          const isDone = stepNumber < step || stepNumber <= furthestStep;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  isActive
                    ? "bg-gradient-brand text-white"
                    : isDone
                      ? "bg-brand-bg text-brand-deep-blue"
                      : "bg-brand-bg text-brand-text-muted",
                )}
              >
                {stepNumber}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isActive ? "text-brand-text" : "text-brand-text-muted",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-card border border-brand-border bg-brand-card p-6 shadow-card">
        <StepComponent />

        <div className="mt-8 flex justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            disabled={step === 1}
          >
            Back
          </Button>
          <Button type="button" onClick={handlePrimaryAction} disabled={submitting}>
            {isLastStep
              ? submitting
                ? "Saving…"
                : mode === "create"
                  ? "Add medication"
                  : "Save changes"
              : "Next"}
          </Button>
        </div>
      </div>
    </FormProvider>
  );
}
