import { createClient } from "@/lib/supabase/client";

const DEFAULT_MISSED_GRACE_MINUTES = 60;

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
  return Number.isFinite(parsed) ? parsed : DEFAULT_MISSED_GRACE_MINUTES;
}
