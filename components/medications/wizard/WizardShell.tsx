"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  createMedication,
  getGroupMembers,
  getGroups,
  getMedication,
  setMedicationGroup,
  updateMedication,
} from "@/lib/medications";
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

interface WizardShellProps {
  mode: "create" | "edit";
  medicationId?: string;
  draftId?: string;
}

export function WizardShell({ mode, medicationId, draftId }: WizardShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeProfileId } = useActiveProfile();
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
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

  // Shares the same cache entries as MedicationsListClient/GroupModal so
  // switching to this page doesn't force a second round trip — the
  // Schedule step's group selector needs the group list, and edit mode
  // additionally needs group-members to find the medication's current
  // group (medications don't carry their own group id).
  const groupsQuery = useQuery({
    queryKey: ["groups", activeProfileId],
    queryFn: () => getGroups(activeProfileId),
  });
  const groupMembersQuery = useQuery({
    queryKey: ["group-members"],
    queryFn: getGroupMembers,
    enabled: mode === "edit",
  });
  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    if (hasHydrated.current) return;
    if (mode === "edit" && editQuery.data) {
      if (groupMembersQuery.data === undefined) return;
      const membership = groupMembersQuery.data.find(
        (m) => m.medication_id === medicationId,
      );
      form.reset({
        ...medicationToFormValues(editQuery.data),
        groupId: membership?.group_id ?? "",
      });
      hasHydrated.current = true;
    }
    if (mode === "create" && draftQuery.data) {
      form.reset(draftQuery.data.formData);
      setStep(draftQuery.data.currentStep);
      setFurthestStep(draftQuery.data.furthestStep);
      hasHydrated.current = true;
    }
  }, [mode, editQuery.data, draftQuery.data, groupMembersQuery.data, medicationId, form]);

  async function doSaveDraft(stepToSave: number): Promise<void> {
    const id = await saveDraft({
      id: currentDraftId,
      formData: form.getValues(),
      currentStep: stepToSave,
      furthestStep: Math.max(furthestStep, stepToSave),
      profileId: activeProfileId,
    });
    setCurrentDraftId((prev) => prev ?? id);
  }

  async function persistDraft(explicitStep?: number) {
    if (mode !== "create") return;
    try {
      await doSaveDraft(explicitStep ?? step);
    } catch {
      // Best-effort autosave — not worth interrupting the user over a
      // transient failure; the guaranteed save on step change will retry.
    }
  }

  async function handleSaveDraft() {
    if (mode !== "create") return;
    setSavingDraft(true);
    try {
      await doSaveDraft(step);
      toast.success("Draft saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      if (mode === "create" && currentDraftId) {
        await deleteDraft(currentDraftId);
      }
      router.push("/medications");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDiscarding(false);
      setShowDiscardConfirm(false);
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
        const created = await createMedication(
          { ...input, profile_id: activeProfileId },
          scheduleTimes,
        );
        await setMedicationGroup(created.id, values.groupId || null);
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
        await setMedicationGroup(medicationId as string, values.groupId || null);
        toast.success("Medication updated");
      }

      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
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

  const isLastStep = step === STEP_LABELS.length;

  function renderStep() {
    switch (step) {
      case 1:
        return <StepIdentity />;
      case 2:
        return <StepInventory />;
      case 3:
        return <StepSchedule groups={groups} />;
      case 4:
        return <StepFeedback />;
      default:
        return null;
    }
  }

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
        {renderStep()}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDiscardConfirm(true)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              disabled={step === 1}
            >
              Back
            </Button>
          </div>
          <div className="flex gap-2">
            {mode === "create" && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? "Saving…" : "Save draft"}
              </Button>
            )}
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
      </div>

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this medication?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-text-muted">
            {mode === "create"
              ? "Your progress on this medication won't be saved."
              : "Your changes won't be saved."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDiscard}
              disabled={discarding}
            >
              {discarding ? "Discarding…" : "Discard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
