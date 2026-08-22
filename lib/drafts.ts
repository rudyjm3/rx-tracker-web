import { createClient } from "@/lib/supabase/client";
import type { MedicationDraft } from "@/lib/types/medications";

export interface ParsedDraft<T = unknown> {
  id: string;
  formData: T;
  currentStep: number;
  furthestStep: number;
  updatedAt: string;
}

function parseDraft<T>(row: MedicationDraft): ParsedDraft<T> {
  return {
    id: row.id,
    formData: JSON.parse(row.form_data) as T,
    currentStep: row.current_step,
    furthestStep: row.furthest_step,
    updatedAt: row.updated_at,
  };
}

export async function getDrafts<T = unknown>(): Promise<ParsedDraft<T>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_drafts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as MedicationDraft[]).map((row) => parseDraft<T>(row));
}

export async function getDraft<T = unknown>(
  id: string,
): Promise<ParsedDraft<T> | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? parseDraft<T>(data as MedicationDraft) : null;
}

export async function saveDraft<T>(args: {
  id?: string;
  formData: T;
  currentStep: number;
  furthestStep: number;
}): Promise<string> {
  const supabase = createClient();
  const payload = {
    form_data: JSON.stringify(args.formData),
    current_step: args.currentStep,
    furthest_step: args.furthestStep,
    updated_at: new Date().toISOString(),
  };

  if (args.id) {
    const { error } = await supabase
      .from("medication_drafts")
      .update(payload)
      .eq("id", args.id);
    if (error) throw error;
    return args.id;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("medication_drafts")
    .insert({ user_id: user.id, ...payload })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteDraft(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medication_drafts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
