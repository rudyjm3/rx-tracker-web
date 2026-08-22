import { createClient } from "@/lib/supabase/client";
import type {
  FeedbackType,
  Medication,
  MedicationDoseChange,
  MedicationGroup,
  MedicationStatusEvent,
  MedicationType,
  ScheduleMode,
} from "@/lib/types/medications";

export interface ScheduleTimeInput {
  reminder_time: string;
  quantity_per_dose?: number | null;
}

export interface MedicationInput {
  name: string;
  dose_amount?: number | null;
  dose_unit?: string | null;
  dose_form?: string | null;
  instructions?: string;
  medication_type: MedicationType;
  as_needed: boolean;
  schedule_mode: ScheduleMode;
  interval_hours?: number | null;
  first_dose_time?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  inventory_enabled: boolean;
  inventory_type: string;
  inventory_unit: string;
  starting_quantity?: number | null;
  quantity_per_dose: number;
  low_supply_threshold: number;
  feedback_type: FeedbackType;
  dashboard_enabled: boolean;
  reminders_enabled: boolean;
  adherence_enabled: boolean;
  profile_id?: string | null;
}

function formatDose(input: Pick<MedicationInput, "dose_amount" | "dose_unit" | "dose_form">) {
  return [input.dose_amount, input.dose_unit, input.dose_form]
    .filter(Boolean)
    .join(" ");
}

export async function getCurrentUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

export async function getActiveMedications(): Promise<Medication[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*, medication_schedule_times(*)")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return data as Medication[];
}

export async function getInactiveMedications(): Promise<Medication[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*, medication_schedule_times(*)")
    .eq("active", false)
    .order("name");
  if (error) throw error;
  return data as Medication[];
}

export async function getMedication(id: string): Promise<Medication> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*, medication_schedule_times(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Medication;
}

export async function createMedication(
  input: MedicationInput,
  scheduleTimes: ScheduleTimeInput[],
): Promise<Medication> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { data: medication, error } = await supabase
    .from("medications")
    .insert({
      user_id: userId,
      profile_id: input.profile_id ?? null,
      name: input.name,
      dose: formatDose(input),
      dose_amount: input.dose_amount ?? null,
      dose_unit: input.dose_unit ?? null,
      dose_form: input.dose_form ?? null,
      instructions: input.instructions ?? "",
      schedule_mode: input.schedule_mode,
      interval_hours: input.interval_hours ?? null,
      first_dose_time: input.first_dose_time ?? null,
      as_needed: input.as_needed,
      medication_type: input.medication_type,
      inventory_type: input.inventory_type,
      inventory_unit: input.inventory_unit,
      starting_quantity: input.inventory_enabled
        ? (input.starting_quantity ?? null)
        : null,
      current_quantity: input.inventory_enabled
        ? (input.starting_quantity ?? null)
        : null,
      quantity_per_dose: input.quantity_per_dose,
      low_supply_threshold: input.low_supply_threshold,
      track_dose_feedback: input.feedback_type !== "none",
      feedback_type: input.feedback_type,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      active: true,
      setup_status: "active",
      dashboard_enabled: input.dashboard_enabled,
      reminders_enabled: input.reminders_enabled,
      adherence_enabled: input.adherence_enabled,
      inventory_enabled: input.inventory_enabled,
    })
    .select()
    .single();
  if (error) throw error;

  if (scheduleTimes.length > 0) {
    const { error: scheduleError } = await supabase
      .from("medication_schedule_times")
      .insert(
        scheduleTimes.map((t) => ({
          medication_id: medication.id,
          reminder_time: t.reminder_time,
          quantity_per_dose: t.quantity_per_dose ?? null,
        })),
      );
    if (scheduleError) throw scheduleError;
  }

  return medication as Medication;
}

export async function updateMedication(
  id: string,
  input: MedicationInput,
  scheduleTimes: ScheduleTimeInput[],
): Promise<void> {
  const supabase = createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("medications")
    .select("dose_amount, dose_unit, inventory_enabled, current_quantity, starting_quantity")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  // current_quantity is the live balance doses/refills deduct from — an
  // edit here should only (re)initialize it when inventory tracking is
  // being turned on for the first time, never silently reset it just
  // because the form resubmits a starting_quantity value.
  const inventoryJustEnabled = input.inventory_enabled && !existing.inventory_enabled;
  const startingQuantity = input.inventory_enabled
    ? (inventoryJustEnabled ? input.starting_quantity : existing.starting_quantity)
    : null;
  const currentQuantity = input.inventory_enabled
    ? (inventoryJustEnabled || existing.current_quantity == null
        ? input.starting_quantity
        : existing.current_quantity)
    : null;

  const { error } = await supabase
    .from("medications")
    .update({
      profile_id: input.profile_id ?? null,
      name: input.name,
      dose: formatDose(input),
      dose_amount: input.dose_amount ?? null,
      dose_unit: input.dose_unit ?? null,
      dose_form: input.dose_form ?? null,
      instructions: input.instructions ?? "",
      schedule_mode: input.schedule_mode,
      interval_hours: input.interval_hours ?? null,
      first_dose_time: input.first_dose_time ?? null,
      as_needed: input.as_needed,
      medication_type: input.medication_type,
      inventory_type: input.inventory_type,
      inventory_unit: input.inventory_unit,
      starting_quantity: startingQuantity,
      current_quantity: currentQuantity,
      quantity_per_dose: input.quantity_per_dose,
      low_supply_threshold: input.low_supply_threshold,
      track_dose_feedback: input.feedback_type !== "none",
      feedback_type: input.feedback_type,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      dashboard_enabled: input.dashboard_enabled,
      reminders_enabled: input.reminders_enabled,
      adherence_enabled: input.adherence_enabled,
      inventory_enabled: input.inventory_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  const doseChanged =
    existing.dose_amount !== (input.dose_amount ?? null) ||
    existing.dose_unit !== (input.dose_unit ?? null);
  if (doseChanged) {
    const { error: doseChangeError } = await supabase
      .from("medication_dose_changes")
      .insert({
        medication_id: id,
        old_dose_amount: existing.dose_amount,
        old_dose_unit: existing.dose_unit ?? "",
        new_dose_amount: input.dose_amount ?? null,
        new_dose_unit: input.dose_unit ?? "",
      });
    if (doseChangeError) throw doseChangeError;
  }

  const { error: deleteError } = await supabase
    .from("medication_schedule_times")
    .delete()
    .eq("medication_id", id);
  if (deleteError) throw deleteError;

  if (scheduleTimes.length > 0) {
    const { error: scheduleError } = await supabase
      .from("medication_schedule_times")
      .insert(
        scheduleTimes.map((t) => ({
          medication_id: id,
          reminder_time: t.reminder_time,
          quantity_per_dose: t.quantity_per_dose ?? null,
        })),
      );
    if (scheduleError) throw scheduleError;
  }
}

export async function deactivateMedication(
  id: string,
  reason = "",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medications")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const { error: eventError } = await supabase
    .from("medication_status_events")
    .insert({ medication_id: id, event: "discontinued", reason });
  if (eventError) throw eventError;
}

export async function activateMedication(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medications")
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const { error: eventError } = await supabase
    .from("medication_status_events")
    .insert({ medication_id: id, event: "resumed" });
  if (eventError) throw eventError;
}

// ── Medication groups ──────────────────────────────────────────────

export interface GroupInput {
  name: string;
  scheduled_time: string;
  profile_id?: string | null;
}

export interface GroupMemberInput {
  medication_id: string;
  quantity_per_dose?: number | null;
  sort_order?: number;
}

export async function getGroups(): Promise<MedicationGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_groups")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return data as MedicationGroup[];
}

export async function getGroupMembers(): Promise<
  { group_id: string; medication_id: string; quantity_per_dose: number | null }[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_group_members")
    .select("group_id, medication_id, quantity_per_dose");
  if (error) throw error;
  return data;
}

export async function createGroup(
  input: GroupInput,
  members: GroupMemberInput[],
): Promise<MedicationGroup> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { data: group, error } = await supabase
    .from("medication_groups")
    .insert({
      user_id: userId,
      profile_id: input.profile_id ?? null,
      name: input.name,
      scheduled_time: input.scheduled_time,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;

  if (members.length > 0) {
    const { error: memberError } = await supabase
      .from("medication_group_members")
      .insert(
        members.map((m, i) => ({
          group_id: group.id,
          medication_id: m.medication_id,
          quantity_per_dose: m.quantity_per_dose ?? null,
          sort_order: m.sort_order ?? i,
        })),
      );
    if (memberError) throw memberError;
  }

  return group as MedicationGroup;
}

export async function updateGroup(
  id: string,
  input: GroupInput,
  members: GroupMemberInput[],
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("medication_groups")
    .update({
      name: input.name,
      scheduled_time: input.scheduled_time,
      profile_id: input.profile_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from("medication_group_members")
    .delete()
    .eq("group_id", id);
  if (deleteError) throw deleteError;

  if (members.length > 0) {
    const { error: memberError } = await supabase
      .from("medication_group_members")
      .insert(
        members.map((m, i) => ({
          group_id: id,
          medication_id: m.medication_id,
          quantity_per_dose: m.quantity_per_dose ?? null,
          sort_order: m.sort_order ?? i,
        })),
      );
    if (memberError) throw memberError;
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medication_groups")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Dose history (dose changes + status events, merged) ────────────

export type DoseHistoryEntry =
  | { type: "dose_change"; at: string; data: MedicationDoseChange }
  | { type: "status_event"; at: string; data: MedicationStatusEvent };

export async function getDoseHistory(
  medicationId: string,
): Promise<DoseHistoryEntry[]> {
  const supabase = createClient();
  const [changesResult, eventsResult] = await Promise.all([
    supabase
      .from("medication_dose_changes")
      .select("*")
      .eq("medication_id", medicationId),
    supabase
      .from("medication_status_events")
      .select("*")
      .eq("medication_id", medicationId),
  ]);
  if (changesResult.error) throw changesResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const entries: DoseHistoryEntry[] = [
    ...(changesResult.data as MedicationDoseChange[]).map((c) => ({
      type: "dose_change" as const,
      at: c.changed_at,
      data: c,
    })),
    ...(eventsResult.data as MedicationStatusEvent[]).map((e) => ({
      type: "status_event" as const,
      at: e.event_at,
      data: e,
    })),
  ];

  entries.sort((a, b) => b.at.localeCompare(a.at));
  return entries;
}

/**
 * Bulk status-event fetch for a set of medications — used by the
 * calendar's historical backfill to reconstruct whether a now-inactive
 * medication was active on a given past date, without a per-medication
 * round trip (see lib/calendar.ts).
 */
export async function getStatusEvents(
  medicationIds: string[],
): Promise<MedicationStatusEvent[]> {
  if (medicationIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_status_events")
    .select("*")
    .in("medication_id", medicationIds);
  if (error) throw error;
  return data as MedicationStatusEvent[];
}
