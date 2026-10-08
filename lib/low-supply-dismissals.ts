import { createClient } from "@/lib/supabase/client";

// A dismissal hides a medication's low-supply reminder for one local
// calendar day, account-wide (the row is keyed on the medication, not the
// device). Nothing expires rows: callers only ever ask for today's date,
// so a still-low medication reappears on its own tomorrow.

export async function getDismissedMedicationIds(date: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("low_supply_dismissals")
    .select("medication_id")
    .eq("dismissed_date", date);
  // Non-fatal: if the read fails (or the migration isn't applied yet) the
  // reminders just show undismissed rather than breaking the dashboard.
  if (error) {
    console.error("Failed to load low-supply dismissals", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.medication_id as string));
}

export async function dismissLowSupply(medicationId: string, date: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("low_supply_dismissals")
    .upsert(
      { medication_id: medicationId, dismissed_date: date },
      { onConflict: "medication_id,dismissed_date", ignoreDuplicates: true },
    );
  if (error) throw error;
}
