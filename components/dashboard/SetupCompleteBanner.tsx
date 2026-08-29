import { CheckCircle2 } from "lucide-react";

export function SetupCompleteBanner() {
  return (
    <div className="flex items-start gap-2 rounded-card border border-status-success/40 bg-status-success/10 p-4">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-status-success" />
      <div className="text-sm text-brand-text">
        <span className="font-medium">You&rsquo;re all set. </span>
        Your medications are ready to track.
      </div>
    </div>
  );
}
