"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AllergyPanel } from "@/components/profile/AllergyPanel";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import {
  AVATAR_COLOR_PALETTE,
  FAMILY_RELATIONSHIPS,
  createFamilyProfile,
  deleteFamilyProfile,
  getFamilyProfiles,
  updateFamilyProfile,
  type FamilyProfileInput,
} from "@/lib/family";
import { deleteAvatarIfManaged, uploadAvatar } from "@/lib/user-profile";
import { calculateAge, fallbackDisplayName } from "@/lib/utils";
import type { FamilyProfile } from "@/lib/types/profile";

export function FamilyClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setActiveProfileId } = useActiveProfile();
  const [editing, setEditing] = useState<FamilyProfile | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const familyQuery = useQuery({
    queryKey: ["family-profiles"],
    queryFn: getFamilyProfiles,
  });
  const family = familyQuery.data ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["family-profiles"] });
  }

  const deleteMutation = useMutation({
    mutationFn: deleteFamilyProfile,
    onSuccess: () => {
      toast.success("Family member removed.");
      setConfirmingRemoveId(null);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't remove family member"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">Manage Family</h1>
        <Button type="button" onClick={() => setEditing("new")}>
          Add Family Member
        </Button>
      </div>
      <p className="text-sm text-brand-text-muted">
        Track medications for family members under one account — no separate logins needed.
      </p>

      {familyQuery.isLoading ? (
        <p className="text-sm text-brand-text-muted">Loading…</p>
      ) : family.length === 0 ? (
        <p className="text-sm text-brand-text-muted">
          No family members yet. Click &ldquo;Add Family Member&rdquo; to add one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {family.map((fp) => {
            const age = calculateAge(fp.birth_date, fp.birth_year);
            const isExpanded = expandedId === fp.id;
            const isConfirmingRemove = confirmingRemoveId === fp.id;
            return (
              <li
                key={fp.id}
                className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : fp.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full">
                      <Avatar
                        pictureUrl={fp.profile_picture}
                        label={fp.display_name}
                        color={fp.avatar_color}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-brand-text">{fp.display_name}</span>
                      <span className="block text-xs text-brand-text-muted">
                        {[fp.relationship, age !== null ? `${age} yrs` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(fp)}
                      className="text-xs text-brand-deep-blue hover:underline"
                    >
                      Edit
                    </button>
                    {isConfirmingRemove ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingRemoveId(null)}
                          className="text-xs text-brand-text-muted hover:underline"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(fp.id)}
                          disabled={deleteMutation.isPending}
                          className="text-xs font-semibold text-status-danger hover:underline"
                        >
                          Confirm
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingRemoveId(fp.id)}
                        className="text-xs text-status-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {isConfirmingRemove && (
                  <p className="text-xs text-status-danger">
                    This permanently deletes {fp.display_name}&rsquo;s medications, dose history,
                    and logs — not just their profile. This can&rsquo;t be undone.
                  </p>
                )}

                {isExpanded && (
                  <div className="border-t border-brand-border pt-3">
                    <AllergyPanel profileId={fp.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing !== null && (
            <FamilyMemberForm
              key={editing === "new" ? "new" : editing.id}
              existing={editing === "new" ? null : editing}
              onSaved={(created) => {
                setEditing(null);
                refresh();
                // Brand-new family member — send them straight into
                // onboarding for that profile, mirroring the account
                // owner's post-signup redirect.
                if (created) {
                  setActiveProfileId(created.id);
                  router.push("/onboarding");
                }
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FamilyMemberFormProps {
  existing: FamilyProfile | null;
  onSaved: (created?: FamilyProfile) => void;
  onCancel: () => void;
}

function FamilyMemberForm({ existing, onSaved, onCancel }: FamilyMemberFormProps) {
  const [firstName, setFirstName] = useState(existing?.first_name ?? "");
  const [lastName, setLastName] = useState(existing?.last_name ?? "");
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [relationship, setRelationship] = useState(existing?.relationship ?? "");
  const [birthDate, setBirthDate] = useState(existing?.birth_date ?? "");
  const [heightValue, setHeightValue] = useState(
    existing?.height_value != null ? String(existing.height_value) : "",
  );
  const [heightUnit, setHeightUnit] = useState(existing?.height_unit ?? "in");
  const [avatarColor, setAvatarColor] = useState(existing?.avatar_color ?? AVATAR_COLOR_PALETTE[0]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const previewName = displayName.trim() || fallbackDisplayName(firstName, lastName) || "New member";

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (birthDate && birthDate > today) {
        throw new Error("Birthdate cannot be in the future.");
      }
      const heightNum = heightValue.trim() ? Number(heightValue) : null;
      if (heightNum !== null) {
        const bounds = heightUnit === "cm" ? [50, 274] : [20, 108];
        if (heightNum < bounds[0] || heightNum > bounds[1]) {
          throw new Error("Height value is out of range.");
        }
      }

      let profilePicture = existing?.profile_picture ?? null;
      if (avatarFile) {
        const newUrl = await uploadAvatar(avatarFile);
        await deleteAvatarIfManaged(profilePicture);
        profilePicture = newUrl;
      } else if (removePhoto) {
        await deleteAvatarIfManaged(profilePicture);
        profilePicture = null;
      }

      const input: FamilyProfileInput = {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        display_name: displayName.trim() || null,
        relationship: relationship || null,
        birth_date: birthDate || null,
        height_value: heightNum,
        height_unit: heightUnit,
        profile_picture: profilePicture,
        avatar_color: avatarColor,
      };

      if (existing) {
        await updateFamilyProfile(existing.id, input);
        onSaved();
      } else {
        const created = await createFamilyProfile(input);
        onSaved(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save family member");
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? `Edit ${existing.display_name}` : "Add Family Member"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <AvatarPicker
          currentUrl={existing?.profile_picture ?? null}
          label={previewName}
          color={avatarColor}
          onChange={(file, remove) => {
            setAvatarFile(file);
            setRemovePhoto(remove);
          }}
        />
        <Field label="First Name">
          <input
            className={inputClass}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Sarah"
          />
        </Field>
        <Field label="Last Name">
          <input
            className={inputClass}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Johnson"
          />
        </Field>
        <Field label="Display Name (optional — defaults to first name + last initial)">
          <input
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Sarah"
          />
        </Field>
        <Field label="Relationship">
          <select
            className={inputClass}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            <option value="">— Optional —</option>
            {FAMILY_RELATIONSHIPS.map((rel) => (
              <option key={rel} value={rel}>
                {rel}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Birth Date">
          <input
            type="date"
            className={inputClass}
            value={birthDate ?? ""}
            max={today}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </Field>
        <Field label="Height">
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.1"
              min="0"
              className={`${inputClass} w-28`}
              value={heightValue}
              onChange={(e) => setHeightValue(e.target.value)}
            />
            <select
              className={inputClass}
              value={heightUnit}
              onChange={(e) => setHeightUnit(e.target.value)}
            >
              <option value="in">in</option>
              <option value="cm">cm</option>
            </select>
          </div>
        </Field>
        <Field label="Avatar Color">
          <div className="flex flex-wrap items-center gap-2">
            {AVATAR_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                aria-label={`Use color ${color}`}
                className="h-7 w-7 rounded-full ring-offset-2"
                style={{
                  backgroundColor: color,
                  outline: avatarColor === color ? "2px solid var(--color-brand-navy)" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
            <input
              type="color"
              value={avatarColor}
              onChange={(e) => setAvatarColor(e.target.value)}
              aria-label="Custom avatar color"
              className="h-7 w-9 cursor-pointer rounded border border-brand-border"
            />
          </div>
        </Field>
        {error && <p className="text-sm text-status-danger">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : existing ? "Save Changes" : "Add Family Member"}
        </Button>
      </DialogFooter>
    </>
  );
}
