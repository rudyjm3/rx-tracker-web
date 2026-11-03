"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Info, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ALLERGY_CATEGORIES,
  ALLERGY_CATEGORY_LABELS,
  ALLERGY_SEVERITIES,
  ALLERGY_SEVERITY_LABELS,
  ALLERGY_TYPE_LABELS,
  allergySeverityLevel,
  allergySeverityText,
  addAllergy,
  deleteAllergy,
  getAllergyCatalog,
  getProfileAllergies,
  updateAllergy,
  type AllergyInput,
} from "@/lib/allergies";
import { Button } from "@/components/ui/Button";
import { SeverityBar } from "@/components/ui/SeverityBar";
import { cn } from "@/lib/cn";
import { getActiveMedications } from "@/lib/medications";
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
  /** Hide the in-panel title when the host dialog already shows one. */
  showTitle?: boolean;
}

export function AllergyPanel({ profileId, showTitle = true }: AllergyPanelProps) {
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

  // Rows are tappable (open the edit dialog) with a severity label + 4-segment
  // bar on the right; the Add button sits centered under the list.
  return (
    <div className="flex flex-col gap-3">
      {showTitle && <h2 className="text-base font-bold text-brand-navy">Allergies &amp; Intolerances</h2>}

      {allergies.length === 0 ? (
        <p className="text-center text-sm text-brand-text-muted">No allergies recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {allergies.map((a) => {
            const label = allergySeverityText(a);
            const meta = [ALLERGY_TYPE_LABELS[a.allergy_type], a.category ? ALLERGY_CATEGORY_LABELS[a.category] : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  aria-label={`${a.name}${label ? `, ${label}` : ""}. Edit`}
                  className="flex w-full items-center gap-3 rounded-card border border-brand-border bg-brand-card p-3 text-left hover:bg-brand-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-brand-text">
                      {a.name}
                      {!a.is_active && (
                        <span className="ml-2 text-xs font-normal text-brand-text-muted">(inactive)</span>
                      )}
                    </span>
                    <span className="block text-xs text-brand-text-muted">{meta}</span>
                  </span>
                  {label && (
                    <span className="flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          "text-sm font-semibold text-brand-text",
                          a.life_threatening && "text-status-danger",
                        )}
                      >
                        {label}
                      </span>
                      <SeverityBar level={allergySeverityLevel(a)} />
                    </span>
                  )}
                  <ChevronRight size={18} className="shrink-0 text-brand-text-muted" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button type="button" className="self-center rounded-full px-8" onClick={() => setEditing("new")}>
        <Plus size={16} aria-hidden="true" /> Add
      </Button>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing !== null && (
            <DialogHeader>
              <DialogTitle>Allergies &amp; Intolerances</DialogTitle>
            </DialogHeader>
          )}
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

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-opacity",
        selected
          ? "border-transparent bg-gradient-brand text-white"
          : "border-brand-border bg-white text-brand-text hover:bg-brand-bg",
      )}
    >
      {label}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-brand-text-muted">{children}</p>;
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
  // Substance = pick from the catalog (or enter a new one); Medication = type
  // a name, with suggestions from the active medications list.
  const [medicationMode, setMedicationMode] = useState(false);
  const [catalogSelection, setCatalogSelection] = useState(initialCatalogId ?? NEW_ENTRY_VALUE);
  const [newName, setNewName] = useState("");
  const [medName, setMedName] = useState("");
  const [allergyType, setAllergyType] = useState<AllergyType>(existing?.allergy_type ?? "allergy");
  const [lifeThreatening, setLifeThreatening] = useState(existing?.life_threatening ?? false);
  const [severity, setSeverity] = useState<AllergySeverity | "">(existing?.severity ?? "");
  const [category, setCategory] = useState<AllergyCategory | "">(existing?.category ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medsQuery = useQuery({
    queryKey: ["medications", "active", profileId],
    queryFn: () => getActiveMedications(profileId),
  });
  const medNames = [...new Set((medsQuery.data ?? []).map((m) => m.name))];

  function toggleMode(next: boolean) {
    setMedicationMode(next);
    if (next && category === "") setCategory("drug");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const base = {
      allergyType,
      lifeThreatening,
      severity: lifeThreatening ? null : severity || null,
      category: category || null,
      notes,
    };
    const input: AllergyInput = medicationMode
      ? { ...base, catalogId: null, newAllergyName: medName }
      : {
          ...base,
          catalogId: catalogSelection === NEW_ENTRY_VALUE ? null : catalogSelection,
          newAllergyName: catalogSelection === NEW_ENTRY_VALUE ? newName : null,
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

  async function handleDelete() {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAllergy(existing.id);
      toast.success("Allergy removed");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove allergy");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {existing && (
          <div className="flex flex-col gap-1.5">
            <GroupLabel>I currently have this</GroupLabel>
            <div className="flex gap-2">
              <Chip label="Yes" selected={isActive} onClick={() => setIsActive(true)} />
              <Chip label="No" selected={!isActive} onClick={() => setIsActive(false)} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={medicationMode}
            aria-label={medicationMode ? "Medication" : "Substance"}
            onClick={() => toggleMode(!medicationMode)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              medicationMode ? "bg-brand-blue" : "bg-brand-border",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                medicationMode && "translate-x-5",
              )}
            />
          </button>
          <span className="text-sm font-semibold text-brand-navy">
            {medicationMode ? "Medication" : "Substance"}
          </span>
        </div>

        {medicationMode ? (
          <Field label="Medication">
            <input
              className={inputClass}
              list="allergy-med-suggestions"
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              maxLength={150}
              placeholder="Type a medication, supplement"
            />
            <datalist id="allergy-med-suggestions">
              {medNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
        ) : (
          <>
            <Field label="Substance">
              <select
                className={inputClass}
                value={catalogSelection}
                onChange={(e) => setCatalogSelection(e.target.value)}
              >
                <option value={NEW_ENTRY_VALUE}>+ Enter a new substance…</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {catalogSelection === NEW_ENTRY_VALUE && (
              <Field label="New substance name">
                <input
                  className={inputClass}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={150}
                  placeholder="e.g. Penicillin"
                />
              </Field>
            )}
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <GroupLabel>Type</GroupLabel>
            <button
              type="button"
              aria-label="Allergy versus intolerance"
              onClick={() => setInfoOpen(true)}
              className="text-brand-deep-blue"
            >
              <Info size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-2">
            {(["allergy", "intolerance"] as AllergyType[]).map((t) => (
              <Chip key={t} label={ALLERGY_TYPE_LABELS[t]} selected={allergyType === t} onClick={() => setAllergyType(t)} />
            ))}
          </div>
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={lifeThreatening}
          onClick={() => setLifeThreatening(!lifeThreatening)}
          className={cn(
            "rounded-full border px-4 py-2.5 text-left text-sm font-semibold",
            lifeThreatening
              ? "border-status-danger bg-status-danger text-white"
              : "border-brand-border bg-brand-bg text-brand-text",
          )}
        >
          Life-threatening (e.g. Anaphylaxis)
        </button>

        {!lifeThreatening && (
          <div className="flex flex-col gap-1.5">
            <GroupLabel>Estimated Severity</GroupLabel>
            <div className="flex flex-wrap gap-2">
              {ALLERGY_SEVERITIES.map((s) => (
                <Chip
                  key={s}
                  label={ALLERGY_SEVERITY_LABELS[s]}
                  selected={severity === s}
                  onClick={() => setSeverity(severity === s ? "" : s)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <GroupLabel>Category</GroupLabel>
          <div className="flex flex-wrap gap-2">
            {ALLERGY_CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={ALLERGY_CATEGORY_LABELS[c]}
                selected={category === c}
                onClick={() => setCategory(category === c ? "" : c)}
              />
            ))}
          </div>
        </div>

        <Field label="Notes">
          <textarea
            className={inputClass}
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-status-danger">{error}</p>}
      </div>

      <DialogFooter className={existing ? "justify-between" : undefined}>
        {existing && (
          <Button type="button" variant="ghost" className="text-status-danger" onClick={handleDelete} disabled={saving}>
            Delete
          </Button>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : existing ? "Update" : "Add"}
          </Button>
        </div>
      </DialogFooter>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allergy vs Intolerance</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm leading-6 text-brand-text">
            <p>
              Choose <strong>Allergy</strong> when a reaction involves the immune system, since this covers
              symptoms such as hives, swelling, trouble breathing, or anaphylaxis, and even small amounts can
              trigger a response. If a reaction has ever been sudden, severe, or life-threatening, select Allergy
              so it&apos;s flagged appropriately.
            </p>
            <p>
              Choose <strong>Intolerance</strong> when the body has trouble processing a substance without immune
              involvement, since this usually leads to milder digestive or discomfort symptoms like bloating, gas,
              or headaches, and the reaction often depends on how much was consumed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
