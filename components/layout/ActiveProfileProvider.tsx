"use client";

import { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/layout/AuthProvider";
import { getFamilyProfiles } from "@/lib/family";
import type { FamilyProfile } from "@/lib/types/profile";

const STORAGE_KEY = "rxtracker-active-profile";

interface ActiveProfileContextValue {
  activeProfileId: string | null; // null = the account owner
  activeProfile: FamilyProfile | null;
  familyProfiles: FamilyProfile[];
  setActiveProfileId: (id: string | null) => void;
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);

export function ActiveProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Lazy initializer (not an effect) so the persisted choice is read
  // synchronously on the client's first render rather than one render
  // late — localStorage isn't available during SSR, so this is null
  // there and picked up as soon as the client takes over.
  const [storedProfileId, setStoredProfileId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY),
  );

  // Same query key as FamilyClient's own useQuery(getFamilyProfiles) —
  // intentionally shared so the nav switcher and Manage Family read from
  // (and invalidate) one cache entry rather than each fetching it.
  const familyQuery = useQuery({
    queryKey: ["family-profiles"],
    queryFn: getFamilyProfiles,
    enabled: !!user,
  });
  const familyProfiles = familyQuery.data ?? [];

  // Deriving activeProfile from storedProfileId + the live family list
  // (rather than eagerly resetting storedProfileId in an effect when a
  // member is removed) means a stale id just stops matching anything —
  // this falls back to the owner on its own, no corrective effect needed.
  const activeProfile = storedProfileId
    ? (familyProfiles.find((p) => p.id === storedProfileId) ?? null)
    : null;
  const activeProfileId = activeProfile?.id ?? null;

  function setActiveProfileId(id: string | null) {
    setStoredProfileId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <ActiveProfileContext.Provider
      value={{ activeProfileId, activeProfile, familyProfiles, setActiveProfileId }}
    >
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const context = useContext(ActiveProfileContext);
  if (!context) {
    throw new Error("useActiveProfile must be used within an ActiveProfileProvider");
  }
  return context;
}
