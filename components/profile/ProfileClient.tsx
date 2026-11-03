"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Pill, Settings, ShieldAlert, User } from "lucide-react";
import Link from "next/link";
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
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { getProfileAllergies } from "@/lib/allergies";
import { getActiveMedications } from "@/lib/medications";
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
  formatMemberSince,
  formatUpdatedDate,
  heightToInches,
} from "@/lib/utils";
import type { UserProfile } from "@/lib/types/profile";

export function ProfileClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);
  const [allergiesOpen, setAllergiesOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
  });
  const profile = profileQuery.data ?? null;

  const medsQuery = useQuery({
    queryKey: ["medications", "active", null],
    queryFn: () => getActiveMedications(null),
  });
  const meds = medsQuery.data ?? [];

  // Same key AllergyPanel uses, so adding/removing inside the dialog updates
  // the count on the card.
  const allergiesQuery = useQuery({
    queryKey: ["profile-allergies", null],
    queryFn: () => getProfileAllergies(null),
  });
  const allergyCount = (allergiesQuery.data ?? []).filter((a) => a.is_active).length;

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
          <h2 className="flex items-center gap-2 text-base font-bold text-brand-navy">
            <User size={18} aria-hidden="true" /> Profile Information
          </h2>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label="Edit profile"
            className="rounded-full p-2 text-brand-deep-blue hover:bg-brand-bg"
          >
            <Settings size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          {profile?.profile_picture ? (
            <button
              type="button"
              onClick={() => setAvatarLightboxOpen(true)}
              aria-label="View larger profile picture"
              className="block h-24 w-24 shrink-0 overflow-hidden rounded-full"
            >
              <Avatar pictureUrl={profile.profile_picture} label={displayName} />
            </button>
          ) : (
            <span className="block h-24 w-24 shrink-0 overflow-hidden rounded-full">
              <Avatar pictureUrl={null} label={displayName} />
            </span>
          )}
          <p className="text-xl font-bold text-brand-blue">{displayName}</p>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Display name" value={profile?.display_name || displayName || "—"} />
          <Row label="Email" value={email} />
          {user?.created_at && <Row label="Member since" value={formatMemberSince(user.created_at)} />}
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
              subValue={
                profile.height_updated_at
                  ? `Last updated ${formatUpdatedDate(profile.height_updated_at)}`
                  : undefined
              }
            />
          )}
          {profile?.weight_value != null && (
            <Row
              label="Weight"
              value={`${profile.weight_value} ${profile.weight_unit}`}
              subValue={
                profile.weight_updated_at
                  ? `Last updated ${formatUpdatedDate(profile.weight_updated_at)}`
                  : undefined
              }
            />
          )}
        </dl>
      </section>

      <NavCard
        icon={<Pill size={20} aria-hidden="true" />}
        title="Medications and Supplements"
        detail={`${meds.length} active ${meds.length === 1 ? "med" : "meds"}`}
        onClick={() => setMedsOpen(true)}
      />
      <NavCard
        icon={<ShieldAlert size={20} aria-hidden="true" />}
        title="Allergies & Intolerances"
        detail={`${allergyCount} ${allergyCount === 1 ? "allergy" : "allergies"}`}
        onClick={() => setAllergiesOpen(true)}
      />

      <ConnectedAccountsPanel />
      <ChangePasswordPanel />
      <SecurityPanel />
      <DataPrivacyPanel />
      <DeleteAccountPanel email={email} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
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

      <Dialog open={medsOpen} onOpenChange={setMedsOpen}>
        <DialogContent sheet onSheetDismiss={() => setMedsOpen(false)}>
          <DialogHeader>
            <DialogTitle>Medications and Supplements</DialogTitle>
          </DialogHeader>
          {meds.length === 0 ? (
            <p className="text-sm text-brand-text-muted">No active medications.</p>
          ) : (
            <ul className="flex flex-col">
              {meds.map((m) => (
                <li key={m.id} className="border-b border-brand-border py-3 last:border-b-0">
                  <span className="font-semibold text-brand-navy">{m.name}</span>
                  {m.dose && <span className="ml-1.5 text-sm font-bold text-[#6B7280]">{m.dose}</span>}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setMedsOpen(false)}>
              Close
            </Button>
            <Link href="/medications" className={buttonVariants()}>
              View all medications
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={allergiesOpen} onOpenChange={setAllergiesOpen}>
        <DialogContent sheet onSheetDismiss={() => setAllergiesOpen(false)}>
          <DialogHeader>
            <DialogTitle>Allergies &amp; Intolerances</DialogTitle>
          </DialogHeader>
          <AllergyPanel profileId={null} showTitle={false} />
        </DialogContent>
      </Dialog>

      <ImageLightbox
        imageUrl={profile?.profile_picture ?? ""}
        caption={displayName}
        open={avatarLightboxOpen && !!profile?.profile_picture}
        onClose={() => setAvatarLightboxOpen(false)}
      />
    </div>
  );
}

function NavCard({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}, ${detail}`}
      className="flex items-center gap-3 rounded-card border border-brand-border bg-brand-card p-4 text-left hover:bg-brand-bg"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg text-brand-deep-blue">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-bold text-brand-navy">{title}</span>
        <span className="ml-2 text-sm text-brand-text-muted">{detail}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-brand-text-muted" aria-hidden="true" />
    </button>
  );
}

// Google sign-in linking via Supabase manual identity linking. Requires
// "Allow manual linking" to be enabled in the Supabase Auth settings.
function ConnectedAccountsPanel() {
  const queryClient = useQueryClient();
  const identitiesQuery = useQuery({
    queryKey: ["user-identities"],
    queryFn: async () => {
      const { data, error } = await createClient().auth.getUserIdentities();
      if (error) throw error;
      return data.identities;
    },
  });
  const identities = identitiesQuery.data ?? [];
  const google = identities.find((i) => i.provider === "google");
  // Supabase refuses to unlink an account's last identity.
  const canDisconnect = identities.length > 1;

  const connectMutation = useMutation({
    mutationFn: async () => {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/profile");
      const { error } = await createClient().auth.linkIdentity({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });
      if (error) throw error;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't connect Google"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!google) return;
      const { error } = await createClient().auth.unlinkIdentity(google);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google disconnected");
      queryClient.invalidateQueries({ queryKey: ["user-identities"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't disconnect Google"),
  });

  return (
    <section className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-brand-navy">
        <GoogleMark /> Connected Accounts
      </h2>
      <p className="text-lg font-bold text-brand-navy">Google</p>
      {google ? (
        <p className="font-bold text-status-success">Connected ✓</p>
      ) : (
        <p className="text-brand-text-muted">Not connected</p>
      )}
      {google ? (
        <>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => disconnectMutation.mutate()}
            disabled={!canDisconnect || disconnectMutation.isPending}
          >
            {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
          {!canDisconnect && (
            <p className="text-xs text-brand-text-muted">
              Google is your only sign-in method. Set a password below before disconnecting it.
            </p>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending || identitiesQuery.isLoading}
        >
          {connectMutation.isPending ? "Connecting…" : "Connect"}
        </Button>
      )}
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function Row({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-brand-text-muted">{label}</dt>
      <dd className="text-right text-brand-text">
        {value}
        {subValue && <span className="block text-xs text-brand-text-muted">{subValue}</span>}
      </dd>
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
  const [weightValue, setWeightValue] = useState(
    profile?.weight_value != null ? String(profile.weight_value) : "",
  );
  const [weightUnit, setWeightUnit] = useState(profile?.weight_unit ?? "lb");
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

      const weightNum = weightValue.trim() ? Number(weightValue) : null;
      if (weightNum !== null) {
        const bounds = weightUnit === "kg" ? [1, 300] : [1, 660];
        if (weightNum < bounds[0] || weightNum > bounds[1]) {
          throw new Error("Weight value is out of range.");
        }
      }

      const heightChanged =
        heightNum !== (profile?.height_value ?? null) ||
        (heightNum !== null && heightUnit !== (profile?.height_unit ?? "in"));
      const weightChanged =
        weightNum !== (profile?.weight_value ?? null) ||
        (weightNum !== null && weightUnit !== (profile?.weight_unit ?? "lb"));

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
        height_updated_at:
          heightNum === null ? null : heightChanged ? new Date().toISOString() : (profile?.height_updated_at ?? null),
        weight_value: weightNum,
        weight_unit: weightNum !== null ? weightUnit : null,
        weight_updated_at:
          weightNum === null ? null : weightChanged ? new Date().toISOString() : (profile?.weight_updated_at ?? null),
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
        <Field label="Weight">
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.1"
              min="0"
              className={`${inputClass} w-28`}
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
            />
            <select
              className={inputClass}
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value)}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
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
