"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const DISMISS_KEY = "rxtracker-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined" ? true : localStorage.getItem(DISMISS_KEY) === "1",
  );

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || !deferredPrompt) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  return (
    <div className="flex items-center gap-3 rounded-card bg-gradient-brand p-4 text-white shadow-card">
      <p className="flex-1 text-sm font-medium">
        Add RxTracker to your home screen for the best experience
      </p>
      <Button size="compact" variant="secondary" className="text-brand-navy" onClick={install}>
        Install
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-white/80 hover:text-white"
      >
        <X size={18} />
      </button>
    </div>
  );
}
