import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/medications";
import { fallbackDisplayName } from "@/lib/utils";
import type { FamilyProfile } from "@/lib/types/profile";

export const FAMILY_RELATIONSHIPS = [
  "Spouse",
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Caregiver",
  "Other",
] as const;

export const AVATAR_COLOR_PALETTE = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
];

export interface FamilyProfileInput {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  relationship?: string | null;
  birth_date?: string | null;
  height_value?: number | null;
  height_unit?: string | null;
  profile_picture?: string | null;
  avatar_color?: string | null;
}

function resolveDisplayName(input: FamilyProfileInput): string {
  const trimmed = input.display_name?.trim();
  if (trimmed) return trimmed;
  const fallback = fallbackDisplayName(input.first_name, input.last_name);
  if (!fallback) throw new Error("Enter a display name or a first name.");
  return fallback;
}

export async function getFamilyProfiles(): Promise<FamilyProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as FamilyProfile[];
}

export async function getFamilyProfile(id: string): Promise<FamilyProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as FamilyProfile;
}

export async function createFamilyProfile(input: FamilyProfileInput): Promise<FamilyProfile> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("family_profiles")
    .insert({
      user_id: userId,
      display_name: resolveDisplayName(input),
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      relationship: input.relationship ?? null,
      birth_date: input.birth_date ?? null,
      height_value: input.height_value ?? null,
      height_unit: input.height_value != null ? (input.height_unit ?? "in") : null,
      profile_picture: input.profile_picture ?? null,
      avatar_color: input.avatar_color ?? AVATAR_COLOR_PALETTE[0],
    })
    .select()
    .single();
  if (error) throw error;
  return data as FamilyProfile;
}

export async function updateFamilyProfile(
  id: string,
  input: FamilyProfileInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("family_profiles")
    .update({
      display_name: resolveDisplayName(input),
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      relationship: input.relationship ?? null,
      birth_date: input.birth_date ?? null,
      height_value: input.height_value ?? null,
      height_unit: input.height_value != null ? (input.height_unit ?? "in") : null,
      profile_picture: input.profile_picture ?? null,
      avatar_color: input.avatar_color ?? AVATAR_COLOR_PALETTE[0],
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFamilyProfile(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("family_profiles").delete().eq("id", id);
  if (error) throw error;
}
