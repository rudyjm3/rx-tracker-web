"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { activateOnboarding } from "@/lib/onboarding";
import { useOnboarding } from "./OnboardingContext";

export function StepActivate() {
  const router = useRouter();
  const { profileId, drafts, reconcileMarks } = useOnboarding();
  const [activating, setActivating] = useState(false);

  async function handleActivate() {
    setActivating(true);
    try {
      await activateOnboarding(reconcileMarks, profileId);
      router.push("/dashboard?setup=complete");
    } catch (err) {
      // Some drafts may have already been created before the failure —
      // /medications is where the user can see and finish whatever's
      // left, since the dashboard's onboarding gate won't route them
      // back here once at least one medication is active.
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      router.push("/medications");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-text-muted">
        Ready to activate {drafts.length} medication{drafts.length === 1 ? "" : "s"}:
      </p>
      <ul className="flex flex-col gap-1">
        {drafts.map((draft) => (
          <li key={draft.id} className="text-sm text-brand-text">
            {draft.formData.name || "Untitled medication"}
            {draft.formData.asNeeded ? " (as needed)" : ""}
          </li>
        ))}
      </ul>
      <Button type="button" onClick={handleActivate} disabled={activating || drafts.length === 0}>
        {activating ? "Activating…" : "Activate & go to dashboard"}
      </Button>
    </div>
  );
}
