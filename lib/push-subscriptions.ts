import { createClient } from "@/lib/supabase/client";

export interface PushSubscriptionRow {
  id: string;
  device_name: string;
  created_at: string;
}

/**
 * Lists the signed-in user's registered mobile push devices. These rows
 * are written by the Expo (Android) app's push-token registration flow —
 * this web app has no VAPID/web-push setup of its own, so this is a
 * read/remove-only view onto devices registered from the mobile app.
 * RLS ("own push subscriptions") already scopes rows to auth.uid(), so
 * no explicit user_id filter is needed here.
 */
export async function getPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, device_name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

export async function removePushSubscription(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("id", id);
  if (error) throw error;
}
