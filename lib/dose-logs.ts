import { createClient } from "@/lib/supabase/client";
import type { DaySlot } from "@/lib/schedule";
import type {
  DoseLog,
  DoseLogStatus,
  DosePostpone,
  Medication,
} from "@/lib/types/medications";

export interface DoseFeedback {
  painLevel?: number;
  moodLevel?: number;
  note?: string;
}

/**
 * Take/Skip. Runs as a single atomic Postgres RPC (record_dose) rather
 * than a client-side read-then-write, so two concurrent calls for the
 * same slot (double-click, two tabs/devices) can't both read "no
 * existing log" and both deduct inventory for what should be a single
 * dose — the RPC serializes on a row lock instead. See
 * supabase/schema.sql for the function definition.
 *
 * `feedback` (pain/mood level, note) is only meaningful for status
 * "taken" — the RPC itself enforces that, resetting these columns to
 * null/'' for any other status.
 */
export async function recordDose(
  medication: Pick<Medication, "id" | "inventory_enabled">,
  scheduledForDate: string,
  scheduledTime: string,
  status: "taken" | "skipped",
  quantityPerDose: number,
  feedback?: DoseFeedback,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("record_dose", {
    p_medication_id: medication.id,
    p_scheduled_for_date: scheduledForDate,
    p_scheduled_time: scheduledTime,
    p_status: status,
    p_quantity_per_dose: quantityPerDose,
    p_inventory_enabled: medication.inventory_enabled,
    p_pain_level: feedback?.painLevel ?? null,
    p_mood_level: feedback?.moodLevel ?? null,
    p_note: feedback?.note ?? null,
  });
  if (error) throw error;
}

/**
 * Like recordDose, but for logging a dose at a specific *actual* time
 * taken rather than "now" — record_dose's SQL (see supabase/schema.sql)
 * always stamps taken_at = now(), which is correct for the dashboard's
 * Take button but wrong for the Log Past Dose / Missed Dose / Free Log
 * flows, where the whole point is a taken_at that can differ from the
 * current moment (a slot from earlier today, a past date, a genuinely
 * missed dose being corrected to "taken").
 *
 * Upserts via recordDose first — same atomic, row-locked inventory
 * deduction, keyed by (medication_id, scheduled_for_date,
 * scheduled_time), and it already handles a slot that has an existing
 * row (e.g. a "missed" log being corrected to "taken") via its own
 * ON CONFLICT DO UPDATE — then looks up that row's id and corrects
 * taken_at/feedback via editDoseLog, which (unlike record_dose) accepts
 * an explicit p_taken_at. editDoseLog's restore-then-deduct in that
 * second call is a net no-op on inventory, since it's operating on the
 * exact quantity the first call just deducted.
 */
export async function recordDoseAtTime(
  medication: Pick<Medication, "id" | "inventory_enabled">,
  scheduledForDate: string,
  scheduledTime: string,
  takenAt: string,
  quantityPerDose: number,
  feedback?: DoseFeedback,
): Promise<void> {
  await recordDose(medication, scheduledForDate, scheduledTime, "taken", quantityPerDose, feedback);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("dose_logs")
    .select("id")
    .eq("medication_id", medication.id)
    .eq("scheduled_for_date", scheduledForDate)
    .eq("scheduled_time", scheduledTime)
    .single();
  if (error) throw error;

  await editDoseLog(data.id, {
    status: "taken",
    takenAt,
    painLevel: feedback?.painLevel ?? null,
    moodLevel: feedback?.moodLevel ?? null,
    note: feedback?.note ?? "",
    quantityPerDose,
    inventoryEnabled: medication.inventory_enabled,
  });
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

/**
 * Edits an existing dose_logs row via the edit_dose_log RPC — same
 * atomic inventory-adjustment shape as recordDose, but keyed by the
 * log's own id (the row already exists) and always marks
 * feedback_edited_at. See supabase/schema.sql for the function
 * definition.
 */
export interface DoseLogEditInput {
  status: DoseLogStatus;
  takenAt?: string | null; // ISO; only applied when status === "taken"
  painLevel?: number | null;
  moodLevel?: number | null;
  note?: string;
  quantityPerDose?: number;
  inventoryEnabled?: boolean;
}

export async function editDoseLog(logId: string, input: DoseLogEditInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("edit_dose_log", {
    p_log_id: logId,
    p_status: input.status,
    p_taken_at: input.takenAt ?? null,
    p_pain_level: input.painLevel ?? null,
    p_mood_level: input.moodLevel ?? null,
    p_note: input.note ?? null,
    p_quantity_per_dose: input.quantityPerDose ?? null,
    p_inventory_enabled: input.inventoryEnabled ?? false,
  });
  if (error) throw error;
}

/**
 * Deletes a dose_logs row via the delete_dose_log RPC, restoring
 * deducted inventory if it was a 'taken' entry on an inventory-tracked
 * medication.
 */
export async function deleteDoseLog(logId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_dose_log", { p_log_id: logId });
  if (error) throw error;
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
  medicationIds?: string[],
): Promise<Record<string, CalendarDayMarker>> {
  if (medicationIds && medicationIds.length === 0) return {};
  const supabase = createClient();
  let query = supabase
    .from("dose_logs")
    .select("scheduled_for_date, status")
    .gte("scheduled_for_date", monthStart)
    .lte("scheduled_for_date", monthEnd);
  if (medicationIds) query = query.in("medication_id", medicationIds);
  const { data, error } = await query;
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
  medicationIds?: string[],
): Promise<CalendarLogRow[]> {
  if (medicationIds && medicationIds.length === 0) return [];
  const supabase = createClient();
  let query = supabase
    .from("dose_logs")
    .select("*, medications(name, dose)")
    .gte("scheduled_for_date", monthStart)
    .lte("scheduled_for_date", monthEnd);
  if (medicationIds) query = query.in("medication_id", medicationIds);
  const { data, error } = await query
    .order("scheduled_for_date", { ascending: true })
    .order("scheduled_time", { ascending: true });
  if (error) throw error;
  return data as CalendarLogRow[];
}

export interface DoseLogHistoryFilter {
  medicationId?: string; // omitted = every medication (active + inactive)
  // Scopes the "every medication" case to a specific set (the active
  // profile's own) — ignored when medicationId is set, since that's
  // already a single, specific medication.
  medicationIds?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Newest-first, offset-paginated dose_logs for the History page and the
 * export report — joined with medication name/dose like
 * getCalendarLogs, but filterable by an arbitrary date range and a
 * single medication (including an inactive one, unlike the dashboard/
 * calendar queries, which only ever see active medications' logs).
 */
export async function getDoseLogHistory(
  filter: DoseLogHistoryFilter = {},
): Promise<CalendarLogRow[]> {
  if (
    !filter.medicationId &&
    filter.medicationIds &&
    filter.medicationIds.length === 0
  ) {
    return [];
  }
  const supabase = createClient();
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  let query = supabase
    .from("dose_logs")
    .select("*, medications(name, dose)")
    .order("scheduled_for_date", { ascending: false })
    .order("scheduled_time", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filter.medicationId) {
    query = query.eq("medication_id", filter.medicationId);
  } else if (filter.medicationIds) {
    query = query.in("medication_id", filter.medicationIds);
  }
  if (filter.startDate) query = query.gte("scheduled_for_date", filter.startDate);
  if (filter.endDate) query = query.lte("scheduled_for_date", filter.endDate);
  const { data, error } = await query;
  if (error) throw error;
  return data as CalendarLogRow[];
}

/**
 * Every (medication_id, status) pair for dose_logs in a date range,
 * with no row cap — for adherence aggregation in the export report,
 * which must reflect the full selected range independently of
 * getDoseLogHistory's display-table pagination cap.
 */
export async function getDoseLogStatusesInRange(
  startDate: string,
  endDate: string,
  medicationIds?: string[],
): Promise<{ medication_id: string; status: DoseLogStatus }[]> {
  if (medicationIds && medicationIds.length === 0) return [];
  const supabase = createClient();
  let query = supabase
    .from("dose_logs")
    .select("medication_id, status")
    .gte("scheduled_for_date", startDate)
    .lte("scheduled_for_date", endDate);
  if (medicationIds) query = query.in("medication_id", medicationIds);
  const { data, error } = await query;
  if (error) throw error;
  return data as { medication_id: string; status: DoseLogStatus }[];
}
