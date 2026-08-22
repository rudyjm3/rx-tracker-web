import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/medications";
import type { UserProfile } from "@/lib/types/profile";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export interface UserProfileInput {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  height_value?: number | null;
  height_unit?: string | null;
  profile_picture?: string | null;
}

export async function upsertUserProfile(input: UserProfileInput): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, ...input, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

/**
 * Uploads an avatar image (owner's own, or a family member's — both live
 * under the owner's own uid folder, since only the owner has a storage
 * identity) and returns its public URL. Validates size/type client-side
 * the same way the reference app's AvatarUploadService does server-side.
 */
export async function uploadAvatar(file: File): Promise<string> {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("Photos must be JPEG, PNG, or WebP.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Photo must be 3MB or smaller.");
  }

  const supabase = createClient();
  const userId = await getCurrentUserId();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Deletes a previously-uploaded avatar, identified by its public URL —
 * a no-op for a URL that isn't one of our own avatar objects (e.g. left
 * null, or some other host), matching AvatarUploadService::deleteIfLocal.
 */
export async function deleteAvatarIfManaged(url: string | null): Promise<void> {
  if (!url) return;
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = url.slice(index + marker.length);
  const supabase = createClient();
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}
