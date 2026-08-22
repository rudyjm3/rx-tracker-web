import { createClient } from "@/lib/supabase/client";

// Amounts are always floats — never cast to int. Inventory can be
// fractional (mL, patches, puffs, drops), not just whole pills.

export async function logRefill(
  medicationId: string,
  amount: number,
  pillsOnHand: number,
  note = "",
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("medication_refills").insert({
    medication_id: medicationId,
    refill_date: new Date().toISOString().slice(0, 10),
    amount,
    pills_on_hand: pillsOnHand,
    note,
    entry_type: "refill",
  });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("medications")
    .update({
      current_quantity: pillsOnHand,
      updated_at: new Date().toISOString(),
    })
    .eq("id", medicationId);
  if (updateError) throw updateError;
}

export async function adjustQuantity(
  medicationId: string,
  newQuantity: number,
  note = "",
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("medication_refills").insert({
    medication_id: medicationId,
    refill_date: new Date().toISOString().slice(0, 10),
    amount: 0,
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

// Relative adjustments for Take/Undo dose recording go through
// Postgres RPCs (deduct_medication_quantity / restore_medication_quantity)
// rather than a client-side read-then-write, since Supabase-js can't
// express `current_quantity = current_quantity - x` as a single atomic
// update. See supabase/schema.sql for the function definitions.

export async function deductForDose(
  medicationId: string,
  amount: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("deduct_medication_quantity", {
    p_medication_id: medicationId,
    p_amount: amount,
  });
  if (error) throw error;
}

export async function restoreForDose(
  medicationId: string,
  amount: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("restore_medication_quantity", {
    p_medication_id: medicationId,
    p_amount: amount,
  });
  if (error) throw error;
}
