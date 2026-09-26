import { createClient } from "@/lib/supabase/client";
import type { SideEffect, SideEffectSeverity } from "@/lib/types/medications";

export type SideEffectRow = SideEffect & {
  medications: { name: string; dose: string | null; dose_amount: number | null; dose_unit: string | null };
};

/**
 * All of the user's side effects (across every medication, RLS-scoped
 * through medication_id) within a date range — for the export report.
 * Unlike getSideEffects, not limited to a single medication.
 */
export async function getSideEffectsInRange(
  startDate: string,
  endDate: string,
  medicationIds?: string[],
): Promise<SideEffectRow[]> {
  if (medicationIds && medicationIds.length === 0) return [];
  const supabase = createClient();
  let query = supabase
    .from("side_effects")
    .select("*, medications(name, dose, dose_amount, dose_unit)")
    .gte("occurred_date", startDate)
    .lte("occurred_date", endDate);
  if (medicationIds) query = query.in("medication_id", medicationIds);
  const { data, error } = await query.order("occurred_date", { ascending: false });
  if (error) throw error;
  return data as SideEffectRow[];
}

export async function getSideEffects(
  medicationId: string,
): Promise<SideEffect[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("side_effects")
    .select("*")
    .eq("medication_id", medicationId)
    .order("occurred_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as SideEffect[];
}

export interface SideEffectInput {
  occurred_date: string;
  description: string;
  severity: SideEffectSeverity;
  note?: string;
}

export async function addSideEffect(
  medicationId: string,
  input: SideEffectInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("side_effects").insert({
    medication_id: medicationId,
    occurred_date: input.occurred_date,
    description: input.description,
    severity: input.severity,
    note: input.note ?? "",
  });
  if (error) throw error;
}

export interface SideEffectsInput {
  occurred_date: string;
  descriptions: string[];
  severity: SideEffectSeverity;
  note?: string;
}

/**
 * Inserts one side_effects row per description via the add_side_effects
 * RPC, all in a single transaction — so a multi-tag submission either
 * fully succeeds or fully rolls back, instead of the partial-commit risk
 * of firing one addSideEffect() per tag.
 */
export async function addSideEffects(
  medicationId: string,
  input: SideEffectsInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("add_side_effects", {
    p_medication_id: medicationId,
    p_occurred_date: input.occurred_date,
    p_descriptions: input.descriptions,
    p_severity: input.severity,
    p_note: input.note ?? "",
  });
  if (error) throw error;
}

export async function updateSideEffect(
  id: string,
  input: SideEffectInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("side_effects")
    .update({
      occurred_date: input.occurred_date,
      description: input.description,
      severity: input.severity,
      note: input.note ?? "",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSideEffect(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("side_effects")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
