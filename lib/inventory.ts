import { createClient } from "@/lib/supabase/client";
import type { MedicationRefill } from "@/lib/types/medications";

// Amounts are always floats — never cast to int. Inventory can be
// fractional (mL, patches, puffs, drops), not just whole pills.

// pillsOnHand of null means "not entered" — the new total is derived as
// current_quantity + amount instead of taking the user's word for it.
// Runs as the log_refill RPC (row-locked, see supabase/schema.sql) rather
// than a client-side read-then-write, so a dose taken or another refill
// logged between the read and the write here can't get silently
// overwritten by a total computed from stale data.
export async function logRefill(
  medicationId: string,
  amount: number,
  pillsOnHand: number | null,
  note = "",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("log_refill", {
    p_medication_id: medicationId,
    p_amount: amount,
    p_pills_on_hand: pillsOnHand,
    p_note: note,
  });
  if (error) throw error;
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

// Same row-locked shape as log_refill — the stored delta (newQuantity
// minus whatever current_quantity actually was under the lock) needs the
// same atomicity, not a delta computed from a quantity read moments
// earlier on the client.
export async function adjustQuantity(
  medicationId: string,
  newQuantity: number,
  note = "",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("adjust_quantity", {
    p_medication_id: medicationId,
    p_new_quantity: newQuantity,
    p_note: note,
  });
  if (error) throw error;
}
