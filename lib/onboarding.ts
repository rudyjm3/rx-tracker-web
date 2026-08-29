import { createClient } from "@/lib/supabase/client";
import { createMedication, getCurrentUserId } from "@/lib/medications";
import { recordDose } from "@/lib/dose-logs";
import { adjustQuantity } from "@/lib/inventory";
import { deleteDraft, getDrafts } from "@/lib/drafts";
import { localDateString } from "@/lib/utils";
import {
  medicationFormSchema,
  type MedicationFormValues,
} from "@/components/medications/wizard/schema";
import { toMedicationInput, toScheduleTimes } from "@/components/medications/wizard/mappers";
import type {
  OnboardingStep,
  ProfileOnboarding,
} from "@/lib/types/profile";

export async function getOnboardingProgress(
  profileId?: string | null,
): Promise<ProfileOnboarding | null> {
  const supabase = createClient();
  let query = supabase.from("profile_onboarding").select("*");
  query = profileId == null ? query.is("profile_id", null) : query.eq("profile_id", profileId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ProfileOnboarding | null;
}

// Atomic upsert with ignoreDuplicates (ON CONFLICT DO NOTHING) rather
// than select-then-insert: two concurrent first-writes for the same
// profile (double-click, two tabs) both racing the initial select would
// otherwise both see "no row" and both insert. The DB's
// (user_id, profile_id) unique constraint is "nulls not distinct"
// (migration profile_onboarding_nulls_not_distinct), so this is safe for
// the account-owner row (profile_id null) too, not just real family
// member uuids. A losing insert returns zero rows here — that's the
// signal to fall back to reading the winner's row.
async function getOrCreateProgress(profileId?: string | null): Promise<ProfileOnboarding> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  const { data: inserted, error: insertError } = await supabase
    .from("profile_onboarding")
    .upsert(
      {
        user_id: userId,
        profile_id: profileId ?? null,
        status: "in_progress",
        current_step: "medications",
      },
      { onConflict: "user_id,profile_id", ignoreDuplicates: true },
    )
    .select();
  if (insertError) throw insertError;
  if (inserted && inserted.length > 0) return inserted[0] as ProfileOnboarding;

  const existing = await getOnboardingProgress(profileId);
  if (!existing) throw new Error("Failed to load onboarding progress");
  return existing;
}

export async function startOnboarding(profileId?: string | null): Promise<ProfileOnboarding> {
  return getOrCreateProgress(profileId);
}

export async function saveOnboardingStep(
  step: OnboardingStep,
  profileId?: string | null,
): Promise<void> {
  const progress = await getOrCreateProgress(profileId);
  const supabase = createClient();
  const { error } = await supabase
    .from("profile_onboarding")
    .update({ current_step: step, status: "in_progress" })
    .eq("id", progress.id);
  if (error) throw error;
}

export async function completeOnboarding(profileId?: string | null): Promise<void> {
  const progress = await getOrCreateProgress(profileId);
  const supabase = createClient();
  const { error } = await supabase
    .from("profile_onboarding")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", progress.id);
  if (error) throw error;
}

export async function skipOnboarding(profileId?: string | null): Promise<void> {
  const progress = await getOrCreateProgress(profileId);
  const supabase = createClient();
  const { error } = await supabase
    .from("profile_onboarding")
    .update({ status: "skipped" })
    .eq("id", progress.id);
  if (error) throw error;
}

export interface ReconcileMark {
  draftId: string;
  scheduledTime: string; // "HH:MM"
  quantityPerDose: number;
  status: "taken" | "skipped";
}

/**
 * Converts every draft medication for this profile into a real,
 * active medication (+ schedule times), applies any step-5 reconcile
 * marks for it, then deletes the draft — one medication at a time, in
 * order, deleting immediately on success so a later failure can't cause
 * a retry to double-create earlier ones. Re-fetches drafts itself rather
 * than trusting the caller's in-memory copy, which may be stale after
 * steps 2-4's direct saveDraft calls. Stops at the first failure and
 * throws with how many completed so far — the caller routes to
 * /medications (not /dashboard) to let the user see and finish the rest.
 */
export async function activateOnboarding(
  reconcileMarks: ReconcileMark[],
  profileId?: string | null,
): Promise<void> {
  const drafts = await getDrafts<MedicationFormValues>(profileId);
  const today = localDateString();
  let completedCount = 0;

  try {
    for (const draft of drafts) {
      const parsed = medicationFormSchema.safeParse(draft.formData);
      if (!parsed.success) {
        throw new Error(
          `"${draft.formData.name || "A medication"}" is missing required schedule or inventory details — go back and finish it before activating.`,
        );
      }
      const values = parsed.data;
      const medication = await createMedication(
        { ...toMedicationInput(values), profile_id: profileId ?? null },
        toScheduleTimes(values),
      );

      // Only marks against a time still in this draft's *final* schedule —
      // if the user marked a dose, went back, and changed the schedule
      // before activating, a stale mark for a since-removed time would
      // otherwise record a phantom dose log (and phantom inventory
      // deduction) for a slot that no longer exists.
      const validTimes = new Set(values.scheduleTimes.map((t) => t.reminderTime));
      const marksForDraft = reconcileMarks.filter(
        (m) => m.draftId === draft.id && validTimes.has(m.scheduledTime),
      );
      for (const mark of marksForDraft) {
        await recordDose(medication, today, mark.scheduledTime, mark.status, mark.quantityPerDose);
      }

      // A "Count now" quantity was measured at entry time, so it already
      // reflects any doses taken earlier today — recordDose's "taken"
      // deductions above would otherwise subtract those doses a second
      // time. Re-assert the user's counted value as ground truth after
      // reconciliation rather than letting the deductions stand. Not
      // needed for "estimate from fill", whose formula deliberately stops
      // at full elapsed days and doesn't already include today.
      const hasTakenMark = marksForDraft.some((m) => m.status === "taken");
      if (values.inventoryEnabled && values.inventoryMethod !== "estimate" && hasTakenMark) {
        await adjustQuantity(
          medication.id,
          Number(values.startingQuantity) || 0,
          "Onboarding: count already reflected today's doses",
        );
      }

      await deleteDraft(draft.id);
      completedCount++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    throw new Error(
      completedCount > 0
        ? `${completedCount} of ${drafts.length} medications were added. ${message}`
        : message,
    );
  }

  await completeOnboarding(profileId);
}
