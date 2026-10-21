"use client";

import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { Avatar } from "@/components/ui/Avatar";
import { X } from "lucide-react";
import { useSessionDismissal } from "@/components/layout/useSessionDismissal";
import { Button } from "@/components/ui/Button";

export function FamilyContextBanner() {
  const { activeProfile, setActiveProfileId } = useActiveProfile();
  const [dismissed, dismiss] = useSessionDismissal(
    `rxtracker-family-banner-dismissed:${activeProfile?.id ?? "none"}`,
  );

  if (!activeProfile || dismissed) return null;

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
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide banner"
          className="rounded-full p-1 text-brand-text-muted hover:bg-brand-bg"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
