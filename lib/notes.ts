import { createClient } from "@/lib/supabase/client";
import type { MedicationNote } from "@/lib/types/medications";

export async function getNotes(medicationId: string): Promise<MedicationNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_notes")
    .select("*")
    .eq("medication_id", medicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as MedicationNote[];
}

export async function addNote(
  medicationId: string,
  note: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medication_notes")
    .insert({ medication_id: medicationId, note });
  if (error) throw error;
}

export async function updateNote(id: string, note: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medication_notes")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medication_notes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
