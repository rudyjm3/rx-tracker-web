"use client";

import { useCallback, useSyncExternalStore } from "react";

// Banner dismissal that lasts until the app is opened again: sessionStorage
// survives navigation and reloads but is cleared when the tab/app is closed.
// Backed by useSyncExternalStore so the server render (and hydration) see
// "not dismissed" and the client picks up the stored value right after,
// keeping server and client markup identical.
const listeners = new Set<() => void>();
// Dismissals made while sessionStorage is unavailable last for this page load.
const memoryDismissed = new Set<string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function readDismissed(key: string): boolean {
  if (memoryDismissed.has(key)) return true;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function useSessionDismissal(key: string): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(key),
    () => false,
  );

  const dismiss = useCallback(() => {
    memoryDismissed.add(key);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — the dismissal just lasts for this page load.
    }
    listeners.forEach((listener) => listener());
  }, [key]);

  return [dismissed, dismiss];
}
