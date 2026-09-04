import { createClient } from "@/lib/supabase/client";
import type { MedicationRefill } from "@/lib/types/medications";

// Amounts are always floats — never cast to int. Inventory can be
// fractional (mL, patches, puffs, drops), not just whole pills.

// pillsOnHand of null means "not entered" — the new total is derived as
// current_quantity + amount instead of taking the user's word for it.
export async function logRefill(
  medicationId: string,
  amount: number,
  pillsOnHand: number | null,
  note = "",
): Promise<void> {
  const supabase = createClient();

  let resolvedPillsOnHand = pillsOnHand;
  if (resolvedPillsOnHand == null) {
    const { data: med, error: medError } = await supabase
      .from("medications")
      .select("current_quantity")
      .eq("id", medicationId)
      .single();
    if (medError) throw medError;
    resolvedPillsOnHand = (med.current_quantity ?? 0) + amount;
  }

  const { error } = await supabase.from("medication_refills").insert({
    medication_id: medicationId,
    refill_date: new Date().toISOString().slice(0, 10),
    amount,
    pills_on_hand: resolvedPillsOnHand,
    note,
    entry_type: "refill",
  });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("medications")
    .update({
      current_quantity: resolvedPillsOnHand,
      updated_at: new Date().toISOString(),
    })
    .eq("id", medicationId);
  if (updateError) throw updateError;
}

export async function getRefillHistory(
  medicationId: string,
): Promise<MedicationRefill[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_refills")
    .select("*")
    .eq("medication_id", medicationId)
    .order("refill_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as MedicationRefill[];
}

export async function adjustQuantity(
  medicationId: string,
  newQuantity: number,
  note = "",
): Promise<void> {
  const supabase = createClient();

  const { data: med, error: medError } = await supabase
    .from("medications")
    .select("current_quantity")
    .eq("id", medicationId)
    .single();
  if (medError) throw medError;

  const { error } = await supabase.from("medication_refills").insert({
    medication_id: medicationId,
    refill_date: new Date().toISOString().slice(0, 10),
    amount: newQuantity - (med.current_quantity ?? 0),
    pills_on_hand: newQuantity,
    note,
    entry_type: "adjustment",
  });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("medications")
    .update({
      current_quantity: newQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", medicationId);
  if (updateError) throw updateError;
}
