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
