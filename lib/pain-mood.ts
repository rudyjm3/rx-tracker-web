import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/medications";
import type {
  DoseLog,
  Medication,
  MoodTag,
  PainMoodLogType,
  StandalonePainMoodLog,
} from "@/lib/types/medications";

export type WellbeingMetric = "pain" | "mood";

export function medicationTracksPain(
  medication: Pick<Medication, "feedback_type">,
): boolean {
  return medication.feedback_type === "pain" || medication.feedback_type === "both";
}

export function medicationTracksMood(
  medication: Pick<Medication, "feedback_type">,
): boolean {
  return medication.feedback_type === "mood" || medication.feedback_type === "both";
}

export function medicationTracksMetric(
  metric: WellbeingMetric,
  medication: Pick<Medication, "feedback_type">,
): boolean {
  return metric === "pain" ? medicationTracksPain(medication) : medicationTracksMood(medication);
}

// 3 severity bands (the reference PHP app's charts use 4 — this brand's
// tokens only have success/warning/danger). Mood is inverted from pain:
// a low mood score is the bad end, a low pain score is the good end.
export function levelColor(metric: WellbeingMetric, level: number): string {
  const rounded = Math.round(level);
  if (metric === "pain") {
    if (rounded <= 3) return "var(--color-status-success)";
    if (rounded <= 6) return "var(--color-status-warning)";
    return "var(--color-status-danger)";
  }
  if (rounded <= 3) return "var(--color-status-danger)";
  if (rounded <= 6) return "var(--color-status-warning)";
  return "var(--color-status-success)";
}

// ── Standalone pain/mood logs ───────────────────────────────────────

export async function getStandaloneLogs(
  medicationId: string | null,
  startDate: string,
  endDate: string,
): Promise<StandalonePainMoodLog[]> {
  const supabase = createClient();
  let query = supabase
    .from("standalone_pain_mood_logs")
    .select("*")
    .gte("logged_at", `${startDate}T00:00:00`)
    .lte("logged_at", `${endDate}T23:59:59`);
  query = medicationId === null
    ? query.is("medication_id", null)
    : query.eq("medication_id", medicationId);
  const { data, error } = await query;
  if (error) throw error;
  return data as StandalonePainMoodLog[];
}

export interface CreateStandaloneLogInput {
  medicationId: string | null;
  logType: PainMoodLogType;
  painLevel?: number | null;
  moodLevel?: number | null;
  note?: string;
  tags?: string;
  loggedAt?: string;
}

export async function createStandaloneLog(input: CreateStandaloneLogInput): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  const { error } = await supabase.from("standalone_pain_mood_logs").insert({
    user_id: userId,
    medication_id: input.medicationId,
    log_type: input.logType,
    pain_level: input.painLevel ?? null,
    mood_level: input.moodLevel ?? null,
    note: input.note ?? "",
    tags: input.tags ?? "",
    logged_at: input.loggedAt ?? new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Mood tags ────────────────────────────────────────────────────────

export async function getMoodTags(): Promise<MoodTag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mood_tags")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data as MoodTag[];
}

export async function createMoodTag(name: string, alwaysShow = true): Promise<MoodTag> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("mood_tags")
    .insert({ user_id: userId, name, always_show: alwaysShow })
    .select()
    .single();
  if (error) throw error;
  return data as MoodTag;
}

export async function renameMoodTag(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mood_tags").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteMoodTag(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mood_tags").delete().eq("id", id);
  if (error) throw error;
}

export async function setMoodTagAlwaysShow(id: string, alwaysShow: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("mood_tags")
    .update({ always_show: alwaysShow })
    .eq("id", id);
  if (error) throw error;
}

// ── Merged trend/history (dose_logs + standalone_pain_mood_logs) ───

export interface TrendPoint {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  level: number;
  source: "dose" | "standalone";
  note: string;
  tags: string[];
}

function levelColumn(metric: WellbeingMetric): "pain_level" | "mood_level" {
  return metric === "pain" ? "pain_level" : "mood_level";
}

async function getDoseTrendPoints(
  metric: WellbeingMetric,
  medicationId: string,
  startDate: string,
  endDate: string,
): Promise<TrendPoint[]> {
  const supabase = createClient();
  const col = levelColumn(metric);
  const { data, error } = await supabase
    .from("dose_logs")
    .select("id, scheduled_for_date, scheduled_time, pain_level, mood_level, note")
    .eq("medication_id", medicationId)
    .not(col, "is", null)
    .gte("scheduled_for_date", startDate)
    .lte("scheduled_for_date", endDate);
  if (error) throw error;
  return (data as Pick<DoseLog, "id" | "scheduled_for_date" | "scheduled_time" | "pain_level" | "mood_level" | "note">[]).map(
    (row) => ({
      id: row.id,
      date: row.scheduled_for_date,
      time: row.scheduled_time.slice(0, 5),
      level: (metric === "pain" ? row.pain_level : row.mood_level) as number,
      source: "dose" as const,
      note: row.note,
      tags: [],
    }),
  );
}

async function getStandaloneTrendPoints(
  metric: WellbeingMetric,
  medicationId: string | null,
  startDate: string,
  endDate: string,
): Promise<TrendPoint[]> {
  const logs = await getStandaloneLogs(medicationId, startDate, endDate);
  const col = levelColumn(metric);
  return logs
    .filter((log) => log[col] !== null)
    .map((log) => {
      const [date, time] = log.logged_at.split("T");
      return {
        id: log.id,
        date,
        time: (time ?? "00:00").slice(0, 5),
        level: log[col] as number,
        source: "standalone" as const,
        note: log.note,
        tags: log.tags ? log.tags.split(",").filter(Boolean) : [],
      };
    });
}

function sortTrendPoints(points: TrendPoint[], order: "asc" | "desc"): TrendPoint[] {
  const sorted = [...points].sort((a, b) => {
    const cmp = `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    return order === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/**
 * Merges dose-linked and standalone entries for a metric into one
 * chronological series — mirrors the reference PHP app's
 * AdherenceRepository::painLevelTrendForRange/moodLevelTrendForRange,
 * which combine doseRowsForRange + standaloneRowsForRange the same way.
 * medicationId === null means "Independent" (standalone-only, no
 * medication link — dose_logs entries are never independent of one).
 */
export async function getTrend(
  metric: WellbeingMetric,
  medicationId: string | null,
  startDate: string,
  endDate: string,
): Promise<TrendPoint[]> {
  const [dosePoints, standalonePoints] = await Promise.all([
    medicationId !== null
      ? getDoseTrendPoints(metric, medicationId, startDate, endDate)
      : Promise.resolve([]),
    getStandaloneTrendPoints(metric, medicationId, startDate, endDate),
  ]);
  return sortTrendPoints([...dosePoints, ...standalonePoints], "asc");
}

export async function getHistory(
  metric: WellbeingMetric,
  medicationId: string | null,
  limit = 50,
): Promise<TrendPoint[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 365);
  const points = await getTrend(
    metric,
    medicationId,
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  );
  return sortTrendPoints(points, "desc").slice(0, limit);
}
