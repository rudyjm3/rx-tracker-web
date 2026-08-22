"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ALLERGY_CATEGORIES,
  ALLERGY_CATEGORY_LABELS,
  ALLERGY_SEVERITIES,
  ALLERGY_SEVERITY_LABELS,
  addAllergy,
  deleteAllergy,
  getAllergyCatalog,
  getProfileAllergies,
  updateAllergy,
  type AllergyInput,
} from "@/lib/allergies";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import type {
  AllergyCategory,
  AllergySeverity,
  AllergyType,
  ProfileAllergyWithName,
} from "@/lib/types/profile";

const NEW_ENTRY_VALUE = "__new__";

interface AllergyPanelProps {
  profileId: string | null;
}

export function AllergyPanel({ profileId }: AllergyPanelProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProfileAllergyWithName | "new" | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["allergy-catalog"],
    queryFn: getAllergyCatalog,
  });
  const allergiesQuery = useQuery({
    queryKey: ["profile-allergies", profileId],
    queryFn: () => getProfileAllergies(profileId),
  });
  const allergies = allergiesQuery.data ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["profile-allergies", profileId] });
    queryClient.invalidateQueries({ queryKey: ["allergy-catalog"] });
  }

  const deleteMutation = useMutation({
    mutationFn: deleteAllergy,
    onSuccess: () => {
      toast.success("Allergy removed");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't remove allergy"),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-brand-navy">Allergies &amp; Intolerances</h2>
        <Button type="button" size="compact" variant="secondary" onClick={() => setEditing("new")}>
          Add
        </Button>
      </div>

      {allergies.length === 0 ? (
        <p className="text-sm text-brand-text-muted">No allergies recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {allergies.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-card border border-brand-border bg-brand-card p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-brand-text">
                  {a.name}
                  {!a.is_active && (
                    <span className="ml-2 text-xs text-brand-text-muted">(inactive)</span>
                  )}
                </p>
                <p className="text-xs text-brand-text-muted">
                  {a.life_threatening ? (
                    <span className="text-status-danger">Life-threatening</span>
                  ) : (
                    a.severity && ALLERGY_SEVERITY_LABELS[a.severity]
                  )}
                  {a.category && ` · ${ALLERGY_CATEGORY_LABELS[a.category]}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="text-xs text-brand-deep-blue hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(a.id)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-status-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing !== null && (
            <AllergyForm
              key={editing === "new" ? "new" : editing.id}
              profileId={profileId}
              existing={editing === "new" ? null : editing}
              catalog={catalogQuery.data ?? []}
              onSaved={() => {
                setEditing(null);
                refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AllergyFormProps {
  profileId: string | null;
  existing: ProfileAllergyWithName | null;
  catalog: { id: string; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}

function AllergyForm({ profileId, existing, catalog, onSaved, onCancel }: AllergyFormProps) {
  const initialCatalogId = existing?.allergy_catalog_id ?? null;
  const [catalogSelection, setCatalogSelection] = useState(initialCatalogId ?? NEW_ENTRY_VALUE);
  const [newName, setNewName] = useState("");
  const [allergyType, setAllergyType] = useState<AllergyType>(existing?.allergy_type ?? "allergy");
  const [lifeThreatening, setLifeThreatening] = useState(existing?.life_threatening ?? false);
  const [severity, setSeverity] = useState<AllergySeverity | "">(existing?.severity ?? "");
  const [category, setCategory] = useState<AllergyCategory | "">(existing?.category ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const input: AllergyInput = {
      catalogId: catalogSelection === NEW_ENTRY_VALUE ? null : catalogSelection,
      newAllergyName: catalogSelection === NEW_ENTRY_VALUE ? newName : null,
      allergyType,
      lifeThreatening,
      severity: severity || null,
      category: category || null,
      notes,
    };
    try {
      if (existing) {
        await updateAllergy(existing.id, { ...input, isActive });
      } else {
        await addAllergy(profileId, input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save allergy");
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? "Edit allergy" : "Add allergy"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Field label="Allergy">
          <select
            className={inputClass}
            value={catalogSelection}
            onChange={(e) => setCatalogSelection(e.target.value)}
          >
            <option value={NEW_ENTRY_VALUE}>+ Enter a new allergy…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {catalogSelection === NEW_ENTRY_VALUE && (
          <Field label="New allergy name">
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={150}
              placeholder="e.g. Amoxicillin"
            />
          </Field>
        )}

        <Field label="Type">
          <select
            className={inputClass}
            value={allergyType}
            onChange={(e) => setAllergyType(e.target.value as AllergyType)}
          >
            <option value="allergy">Allergy</option>
            <option value="intolerance">Intolerance</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input
            type="checkbox"
            checked={lifeThreatening}
            onChange={(e) => setLifeThreatening(e.target.checked)}
          />
          Life-threatening
        </label>

        {!lifeThreatening && (
          <Field label="Severity">
            <select
              className={inputClass}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AllergySeverity | "")}
            >
              <option value="">— Optional —</option>
              {ALLERGY_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {ALLERGY_SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Category">
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as AllergyCategory | "")}
          >
            <option value="">— Optional —</option>
            {ALLERGY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ALLERGY_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes (optional)">
          <textarea
            className={inputClass}
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {existing && (
          <label className="flex items-center gap-2 text-sm text-brand-text">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        )}

        {error && <p className="text-sm text-status-danger">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
