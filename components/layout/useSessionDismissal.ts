"use client";

import { useCallback, useEffect, useState } from "react";

// Banner dismissal that lasts until the app is opened again: sessionStorage
// survives navigation and reloads but is cleared when the tab/app is closed.
// Read in an effect (not the initial state) to keep server and client
// renders identical.
export function useSessionDismissal(key: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — the dismissal just lasts for this render tree.
    }
  }, [key]);

  return [dismissed, dismiss];
}
