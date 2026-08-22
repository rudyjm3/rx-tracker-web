import { createClient } from "@/lib/supabase/client";
import { deductForDose, restoreForDose } from "@/lib/inventory";
import type { DaySlot } from "@/lib/schedule";
import type { DoseLog, DosePostpone, Medication } from "@/lib/types/medications";

/**
 * Take/Skip. Handles switching away from a previously-taken dose
 * (restores the historically-recorded deducted_quantity, never
 * recomputes from today's medication config, since that may have
 * changed since the dose was logged) and switching into taken
 * (deducts quantityPerDose, the caller-resolved amount for this exact
 * slot — see lib/schedule.ts's resolveQuantityPerDose).
 *
 * The dose_logs write always happens first, then inventory follows:
 * if the log write fails, inventory is never touched; if a later
 * inventory RPC fails, only the balance is left stale (recoverable via
 * Adjust Quantity), which is the smaller failure mode of the two.
 */
export async function recordDose(
  medication: Pick<Medication, "id" | "inventory_enabled">,
  scheduledForDate: string,
  scheduledTime: string,
  status: "taken" | "skipped",
  quantityPerDose: number,
): Promise<void> {
  const supabase = createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("dose_logs")
    .select("status, deducted_quantity")
    .eq("medication_id", medication.id)
    .eq("scheduled_for_date", scheduledForDate)
    .eq("scheduled_time", scheduledTime)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing?.status === status) return; // already in this state

  const wasTaken = existing?.status === "taken";
  const willBeTaken = status === "taken";

  const { error } = await supabase.from("dose_logs").upsert(
    {
      medication_id: medication.id,
      scheduled_for_date: scheduledForDate,
      scheduled_time: scheduledTime,
      status,
      deducted_quantity: willBeTaken ? quantityPerDose : null,
      taken_at: willBeTaken ? new Date().toISOString() : null,
    },
    { onConflict: "medication_id,scheduled_for_date,scheduled_time" },
  );
  if (error) throw error;

  if (!medication.inventory_enabled) return;

  if (wasTaken && !willBeTaken && existing?.deducted_quantity != null) {
    await restoreForDose(medication.id, existing.deducted_quantity);
  } else if (!wasTaken && willBeTaken) {
    await deductForDose(medication.id, quantityPerDose);
  }
}

export async function postponeDose(
  medicationId: string,
  scheduledForDate: string,
  scheduledTime: string,
  minutes: number,
): Promise<void> {
  const supabase = createClient();
  const postponedUntil = new Date(Date.now() + minutes * 60000).toISOString();

  const { error } = await supabase.from("dose_postpones").upsert(
    {
      medication_id: medicationId,
      scheduled_for_date: scheduledForDate,
      scheduled_time: scheduledTime,
      postponed_until: postponedUntil,
      resolved_at: null,
    },
    { onConflict: "medication_id,scheduled_for_date,scheduled_time" },
  );
  if (error) throw error;
}

/**
 * Finalizes any still-pending slot whose grace period has elapsed as
 * 'missed'. Due time is the postpone time if the dose was snoozed,
 * otherwise the slot's scheduled time; cutoff = due + graceMinutes.
 * as_needed and adherence_enabled=false medications are never
 * finalized. ignoreDuplicates guards the race where the dose was taken
 * between reading `slots` and this call — it skips rather than
 * clobbering a row that now exists.
 */
export async function finalizeMissedDoses(
  date: string,
  slots: DaySlot[],
  graceMinutes: number,
): Promise<void> {
  const now = new Date();
  const toFinalize = slots.filter((slot) => {
    if (slot.status !== "pending") return false;
    if (slot.medication.as_needed) return false;
    if (!slot.medication.adherence_enabled) return false;
    const due = slot.postponedUntil
      ? new Date(slot.postponedUntil)
      : new Date(`${date}T${slot.scheduledTime}`);
    const cutoff = new Date(due.getTime() + graceMinutes * 60000);
    return now > cutoff;
  });
  if (toFinalize.length === 0) return;

  const supabase = createClient();
  const { error } = await supabase.from("dose_logs").upsert(
    toFinalize.map((slot) => ({
      medication_id: slot.medicationId,
      scheduled_for_date: date,
      scheduled_time: slot.scheduledTime,
      status: "missed" as const,
      taken_at: null,
    })),
    {
      onConflict: "medication_id,scheduled_for_date,scheduled_time",
      ignoreDuplicates: true,
    },
  );
  if (error) throw error;
}

export async function getTodayLogs(date: string): Promise<DoseLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dose_logs")
    .select("*")
    .eq("scheduled_for_date", date);
  if (error) throw error;
  return data as DoseLog[];
}

export async function getTodayPostpones(date: string): Promise<DosePostpone[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dose_postpones")
    .select("*")
    .eq("scheduled_for_date", date)
    .is("resolved_at", null);
  if (error) throw error;
  return data as DosePostpone[];
}

export async function getRecentLogs(
  limit = 50,
): Promise<(DoseLog & { medications: { name: string } })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dose_logs")
    .select("*, medications(name)")
    .order("scheduled_for_date", { ascending: false })
    .order("scheduled_time", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as (DoseLog & { medications: { name: string } })[];
}
