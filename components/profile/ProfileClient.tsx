"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/layout/AuthProvider";
import { AllergyPanel } from "@/components/profile/AllergyPanel";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
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
import { buttonVariants } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAvatarIfManaged,
  getUserProfile,
  uploadAvatar,
  upsertUserProfile,
} from "@/lib/user-profile";
import {
  calculateAge,
  fallbackDisplayName,
  formatFeetInches,
  heightToInches,
} from "@/lib/utils";
import type { UserProfile } from "@/lib/types/profile";

export function ProfileClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
  });
  const profile = profileQuery.data ?? null;

  const email = user?.email ?? "";
  const displayName =
    profile?.display_name?.trim() ||
    fallbackDisplayName(profile?.first_name, profile?.last_name, email) ||
    email;
  const age = calculateAge(profile?.birth_date ?? null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["user-profile"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-navy">My Profile</h1>

      <section className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-navy">Profile Information</h2>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="text-sm text-brand-deep-blue hover:underline"
          >
            Edit
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-full">
            <Avatar pictureUrl={profile?.profile_picture ?? null} label={displayName} />
          </span>
          <p className="text-lg font-semibold text-brand-text">{displayName}</p>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Display name" value={profile?.display_name || "—"} />
          <Row label="Email" value={email} />
          {profile?.birth_date && (
            <Row
              label="Birthdate"
              value={`${new Date(`${profile.birth_date}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}${age !== null ? ` (${age} years old)` : ""}`}
            />
          )}
          {profile?.height_value != null && (
            <Row
              label="Height"
              value={`${profile.height_value} ${profile.height_unit} (${formatFeetInches(heightToInches(profile.height_value, profile.height_unit ?? "in"))})`}
            />
          )}
        </dl>
      </section>

      <section className="rounded-card border border-brand-border bg-brand-card p-4">
        <AllergyPanel profileId={null} />
      </section>

      <ChangePasswordPanel />
      <SecurityPanel />
      <DataPrivacyPanel />
      <DeleteAccountPanel email={email} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <EditProfileForm
            profile={profile}
            email={email}
            onSaved={() => {
              setEditOpen(false);
              refresh();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-brand-text-muted">{label}</dt>
      <dd className="text-right text-brand-text">{value}</dd>
    </div>
  );
}

interface EditProfileFormProps {
  profile: UserProfile | null;
  email: string;
  onSaved: () => void;
  onCancel: () => void;
}

function EditProfileForm({ profile, email, onSaved, onCancel }: EditProfileFormProps) {
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [heightValue, setHeightValue] = useState(
    profile?.height_value != null ? String(profile.height_value) : "",
  );
  const [heightUnit, setHeightUnit] = useState(profile?.height_unit ?? "in");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (birthDate && birthDate > today) {
        throw new Error("Birthdate cannot be in the future.");
      }
      const trimmedFirst = firstName.trim() || null;
      const trimmedLast = lastName.trim() || null;
      const trimmedDisplay = displayName.trim() || fallbackDisplayName(trimmedFirst, trimmedLast, email);
      if (!trimmedDisplay) throw new Error("Enter a display name or a first name.");

      const heightNum = heightValue.trim() ? Number(heightValue) : null;
      if (heightNum !== null) {
        const bounds = heightUnit === "cm" ? [50, 274] : [20, 108];
        if (heightNum < bounds[0] || heightNum > bounds[1]) {
          throw new Error("Height value is out of range.");
        }
      }

      let profilePicture = profile?.profile_picture ?? null;
      if (avatarFile) {
        const newUrl = await uploadAvatar(avatarFile);
        await deleteAvatarIfManaged(profilePicture);
        profilePicture = newUrl;
      } else if (removePhoto) {
        await deleteAvatarIfManaged(profilePicture);
        profilePicture = null;
      }

      await upsertUserProfile({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        display_name: trimmedDisplay,
        birth_date: birthDate || null,
        height_value: heightNum,
        height_unit: heightNum !== null ? heightUnit : null,
        profile_picture: profilePicture,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save profile");
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Profile</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <AvatarPicker
          currentUrl={profile?.profile_picture ?? null}
          label={displayName || email}
          onChange={(file, remove) => {
            setAvatarFile(file);
            setRemovePhoto(remove);
          }}
        />
        <Field label="First name">
          <input
            className={inputClass}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={50}
          />
        </Field>
        <Field label="Last name">
          <input
            className={inputClass}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={50}
          />
        </Field>
        <Field label="Display name (optional — defaults to first name + last initial)">
          <input
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
          />
        </Field>
        <Field label="Birthdate">
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

function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }
      const supabase = createClient();
      // supabase-js has no direct "verify current password" call — signing
      // in again with it is the standard way to confirm it's correct
      // before changing to the new one.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: currentPassword,
      });
      if (signInError) throw new Error("Current password is incorrect.");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't change password"),
  });

  return (
    <section className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="text-base font-bold text-brand-navy">Change Password</h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Current password">
          <input
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={mutation.isPending} className="self-start">
          {mutation.isPending ? "Changing…" : "Change password"}
        </Button>
      </form>
    </section>
  );
}

function SecurityPanel() {
  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Signed out of other devices."),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't sign out other devices"),
  });

  return (
    <section className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="text-base font-bold text-brand-navy">Security</h2>
      <p className="text-sm text-brand-text-muted">
        Sign out of RxTracker on every other device or browser you&apos;re currently signed into.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="self-start"
      >
        {mutation.isPending ? "Signing out…" : "Sign out of other devices"}
      </Button>
    </section>
  );
}

function DataPrivacyPanel() {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="text-base font-bold text-brand-navy">Data &amp; Privacy</h2>
      <p className="text-sm text-brand-text-muted">
        Export a copy of all your medication and dose history data.
      </p>
      <a href="/export" className={buttonVariants({ variant: "secondary", className: "self-start" })}>
        Go to Export
      </a>
    </section>
  );
}

function DeleteAccountPanel({ email }: { email: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Couldn't delete account");

      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete account");
      setDeleting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-status-danger/30 bg-brand-card p-4">
      <h2 className="text-base font-bold text-status-danger">Delete Account</h2>
      <p className="text-sm text-brand-text-muted">
        This permanently deletes your account and all data — medications, dose history, and
        settings. This cannot be undone.
      </p>
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-sm text-status-danger hover:underline"
        >
          I want to delete my account
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label={`Type your email address to confirm (${email})`}>
            <input
              type="email"
              required
              autoComplete="off"
              className={inputClass}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-status-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
              className="bg-status-danger text-white shadow-none hover:opacity-90"
            >
              {deleting ? "Deleting…" : "Permanently delete my account"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
