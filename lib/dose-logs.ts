import { createClient } from "@/lib/supabase/client";
import type { DaySlot } from "@/lib/schedule";
import type {
  DoseLog,
  DoseLogStatus,
  DosePostpone,
  Medication,
} from "@/lib/types/medications";

/**
 * Take/Skip. Runs as a single atomic Postgres RPC (record_dose) rather
 * than a client-side read-then-write, so two concurrent calls for the
 * same slot (double-click, two tabs/devices) can't both read "no
 * existing log" and both deduct inventory for what should be a single
 * dose — the RPC serializes on a row lock instead. See
 * supabase/schema.sql for the function definition.
 */
export async function recordDose(
  medication: Pick<Medication, "id" | "inventory_enabled">,
  scheduledForDate: string,
  scheduledTime: string,
  status: "taken" | "skipped",
  quantityPerDose: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("record_dose", {
    p_medication_id: medication.id,
    p_scheduled_for_date: scheduledForDate,
    p_scheduled_time: scheduledTime,
    p_status: status,
    p_quantity_per_dose: quantityPerDose,
    p_inventory_enabled: medication.inventory_enabled,
  });
  if (error) throw error;
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
 * clobbering a row that now exists. Returns whether any row was
 * actually finalized, so callers can skip invalidating queries (and
 * thus avoid re-triggering themselves) when there was nothing to do.
 */
export async function finalizeMissedDoses(
  date: string,
  slots: DaySlot[],
  graceMinutes: number,
): Promise<boolean> {
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
  if (toFinalize.length === 0) return false;

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
  return true;
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

export interface CalendarDayMarker {
  taken: number;
  skipped: number;
  missed: number;
}

export type CalendarLogRow = DoseLog & {
  medications: { name: string; dose: string };
};

/**
 * Per-day taken/skipped/missed counts for a month, keyed by date — drives
 * the calendar grid's day-cell coloring. Aggregated client-side (a handful
 * of rows per day at most) rather than via a server-side GROUP BY, matching
 * this file's existing style of doing simple client-side reduces instead of
 * introducing a view/RPC for it.
 */
export async function getCalendarMarkers(
  monthStart: string,
  monthEnd: string,
): Promise<Record<string, CalendarDayMarker>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dose_logs")
    .select("scheduled_for_date, status")
    .gte("scheduled_for_date", monthStart)
    .lte("scheduled_for_date", monthEnd);
  if (error) throw error;

  const markers: Record<string, CalendarDayMarker> = {};
  for (const row of data as { scheduled_for_date: string; status: DoseLogStatus }[]) {
    const marker = markers[row.scheduled_for_date] ??= { taken: 0, skipped: 0, missed: 0 };
    marker[row.status]++;
  }
  return markers;
}

/**
 * Raw dose_logs for a month, joined with medication name/dose, for the
 * calendar's day-detail view. Ordered so client-side grouping by date then
 * medication is a straightforward pass.
 */
export async function getCalendarLogs(
  monthStart: string,
  monthEnd: string,
): Promise<CalendarLogRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dose_logs")
    .select("*, medications(name, dose)")
    .gte("scheduled_for_date", monthStart)
    .lte("scheduled_for_date", monthEnd)
    .order("scheduled_for_date", { ascending: true })
    .order("scheduled_time", { ascending: true });
  if (error) throw error;
  return data as CalendarLogRow[];
}
