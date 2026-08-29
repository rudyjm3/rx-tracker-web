"use client";

import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export function FamilyContextBanner() {
  const { activeProfile, setActiveProfileId } = useActiveProfile();

  if (!activeProfile) return null;

  return (
    <div className="border-b border-brand-border bg-status-warning/10">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm text-brand-text">
        <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-full">
          <Avatar
            pictureUrl={activeProfile.profile_picture}
            label={activeProfile.display_name}
            color={activeProfile.avatar_color}
          />
        </span>
        <span className="flex-1">
          Viewing <span className="font-semibold">{activeProfile.display_name}</span>&apos;s medications
        </span>
        <Button size="compact" variant="secondary" onClick={() => setActiveProfileId(null)}>
          Switch back to Me
        </Button>
      </div>
    </div>
  );
}
