export interface UserProfile {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  height_value: number | null;
  height_unit: string | null;
  profile_picture: string | null;
  updated_at: string;
}

export interface FamilyProfile {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_color: string | null;
  relationship: string | null;
  birth_year: number | null;
  birth_date: string | null;
  height_value: number | null;
  height_unit: string | null;
  profile_picture: string | null;
  created_at: string;
}

export type AllergyType = "allergy" | "intolerance";
export type AllergySeverity = "low" | "moderate" | "high" | "very_high";
export type AllergyCategory = "drug" | "food" | "environment_animal" | "other";

export interface AllergyCatalogEntry {
  id: string;
  owner_user_id: string | null;
  name: string;
  created_at: string;
}

export interface ProfileAllergy {
  id: string;
  owner_user_id: string;
  profile_id: string | null;
  allergy_catalog_id: string;
  allergy_type: AllergyType;
  life_threatening: boolean;
  severity: AllergySeverity | null;
  category: AllergyCategory | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

// profile_allergies joined with the catalog entry's name — the shape
// every allergy list/UI actually consumes, matching the reference app's
// AllergyRepository query joins.
export type ProfileAllergyWithName = ProfileAllergy & { name: string };
