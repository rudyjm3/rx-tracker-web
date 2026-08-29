"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AllergyPanel } from "@/components/profile/AllergyPanel";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { getFamilyProfile } from "@/lib/family";
import { calculateAge, formatFeetInches, heightToInches } from "@/lib/utils";

interface FamilyMemberDetailClientProps {
  profileId: string;
}

export function FamilyMemberDetailClient({ profileId }: FamilyMemberDetailClientProps) {
  const router = useRouter();
  const { setActiveProfileId } = useActiveProfile();
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["family-profile", profileId],
    queryFn: () => getFamilyProfile(profileId),
  });
  const profile = profileQuery.data;
  const age = profile ? calculateAge(profile.birth_date, profile.birth_year) : null;

  function handleSwitch() {
    setActiveProfileId(profileId);
    router.push("/dashboard");
  }

  if (profileQuery.isLoading) {
    return <p className="text-sm text-brand-text-muted">Loading…</p>;
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-status-danger">Couldn&rsquo;t find that family member.</p>
        <Link href="/family" className="text-sm text-brand-deep-blue hover:underline">
          Back to Family
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/family" className="text-sm text-brand-deep-blue hover:underline">
          ← Back to Family
        </Link>
        <Button type="button" onClick={handleSwitch}>
          Switch to this profile
        </Button>
      </div>

      <section className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4">
        <div className="flex items-center gap-3">
          {profile.profile_picture ? (
            <button
              type="button"
              onClick={() => setAvatarLightboxOpen(true)}
              aria-label="View larger profile picture"
              className="block h-14 w-14 shrink-0 overflow-hidden rounded-full"
            >
              <Avatar
                pictureUrl={profile.profile_picture}
                label={profile.display_name}
                color={profile.avatar_color}
              />
            </button>
          ) : (
            <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-full">
              <Avatar pictureUrl={null} label={profile.display_name} color={profile.avatar_color} />
            </span>
          )}
          <div>
            <p className="text-lg font-semibold text-brand-text">{profile.display_name}</p>
            {profile.relationship && (
              <p className="text-sm text-brand-text-muted">{profile.relationship}</p>
            )}
          </div>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          {profile.relationship && <Row label="Relationship" value={profile.relationship} />}
          {profile.birth_date && (
            <Row
              label="Birthdate"
              value={`${new Date(`${profile.birth_date}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}${age !== null ? ` (${age} years old)` : ""}`}
            />
          )}
          {!profile.birth_date && age !== null && <Row label="Age" value={`${age} years old`} />}
          {profile.height_value != null && (
            <Row
              label="Height"
              value={`${profile.height_value} ${profile.height_unit} (${formatFeetInches(heightToInches(profile.height_value, profile.height_unit ?? "in"))})`}
            />
          )}
        </dl>
      </section>

      <section className="rounded-card border border-brand-border bg-brand-card p-4">
        <AllergyPanel profileId={profile.id} />
      </section>

      <ImageLightbox
        imageUrl={profile.profile_picture ?? ""}
        caption={profile.display_name}
        open={avatarLightboxOpen && !!profile.profile_picture}
        onClose={() => setAvatarLightboxOpen(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-brand-text-muted">{label}</dt>
      <dd className="text-right font-medium text-brand-text">{value}</dd>
    </div>
  );
}
