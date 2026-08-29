import { createClient } from "@/lib/supabase/client";
import { createMedication, getCurrentUserId } from "@/lib/medications";
import { recordDose } from "@/lib/dose-logs";
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

// Select-then-insert rather than upsert-by-(user_id,profile_id): Postgres
// treats two NULL profile_ids as distinct, so an upsert keyed on that
// column pair would never dedupe the account owner's row (only a real
// family_profiles uuid dedupes correctly). Every write below routes
// through this so there's exactly one place that can create a row.
async function getOrCreateProgress(profileId?: string | null): Promise<ProfileOnboarding> {
  const existing = await getOnboardingProgress(profileId);
  if (existing) return existing;

  const supabase = createClient();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profile_onboarding")
    .insert({
      user_id: userId,
      profile_id: profileId ?? null,
      status: "in_progress",
      current_step: "medications",
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProfileOnboarding;
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

      const marksForDraft = reconcileMarks.filter((m) => m.draftId === draft.id);
      for (const mark of marksForDraft) {
        await recordDose(medication, today, mark.scheduledTime, mark.status, mark.quantityPerDose);
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
