import { createClient } from "@/lib/supabase/client";

const MISSED_GRACE_OPTIONS = [30, 60] as const;
const DEFAULT_MISSED_GRACE_MINUTES = 60;

const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;
const DEFAULT_SNOOZE_MINUTES = 15;

export type MoodChartScheme = "classic" | "teal";
const MOOD_CHART_SCHEMES: MoodChartScheme[] = ["classic", "teal"];
const DEFAULT_MOOD_CHART_SCHEME: MoodChartScheme = "classic";

export async function getSetting(key: string): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("user_id", user.id)
    .eq("setting_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.setting_value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("app_settings").upsert(
    {
      user_id: user.id,
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,setting_key" },
  );
  if (error) throw error;
}

export async function getMissedGraceMinutes(): Promise<number> {
  const raw = await getSetting("missed_grace_minutes");
  const parsed = raw ? Number(raw) : NaN;
  return MISSED_GRACE_OPTIONS.includes(parsed as (typeof MISSED_GRACE_OPTIONS)[number])
    ? parsed
    : DEFAULT_MISSED_GRACE_MINUTES;
}

export async function setMissedGraceMinutes(minutes: number): Promise<void> {
  if (!MISSED_GRACE_OPTIONS.includes(minutes as (typeof MISSED_GRACE_OPTIONS)[number])) {
    throw new Error("Grace period must be 30 or 60 minutes.");
  }
  await setSetting("missed_grace_minutes", String(minutes));
}

export async function getSnoozeMinutes(): Promise<number> {
  const raw = await getSetting("snooze_minutes");
  const parsed = raw ? Number(raw) : NaN;
  return SNOOZE_OPTIONS.includes(parsed as (typeof SNOOZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_SNOOZE_MINUTES;
}

export async function setSnoozeMinutes(minutes: number): Promise<void> {
  if (!SNOOZE_OPTIONS.includes(minutes as (typeof SNOOZE_OPTIONS)[number])) {
    throw new Error("Snooze duration must be 5, 10, 15, or 30 minutes.");
  }
  await setSetting("snooze_minutes", String(minutes));
}

export async function getMoodChartScheme(): Promise<MoodChartScheme> {
  const raw = await getSetting("mood_chart_scheme");
  return MOOD_CHART_SCHEMES.includes(raw as MoodChartScheme)
    ? (raw as MoodChartScheme)
    : DEFAULT_MOOD_CHART_SCHEME;
}

export async function setMoodChartScheme(scheme: MoodChartScheme): Promise<void> {
  if (!MOOD_CHART_SCHEMES.includes(scheme)) {
    throw new Error("Mood chart scheme must be classic or teal.");
  }
  await setSetting("mood_chart_scheme", scheme);
}
