"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, HelpCircle, Menu, Settings, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/layout/AuthProvider";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { ResumeSetupBanner } from "@/components/layout/ResumeSetupBanner";
import { FamilyContextBanner } from "@/components/layout/FamilyContextBanner";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Avatar } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { getUserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/cn";
import { fallbackDisplayName } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/medications", label: "Medications" },
  { href: "/calendar", label: "Calendar" },
  { href: "/export", label: "Export" },
  { href: "/pain-tracking", label: "Pain Tracking" },
  { href: "/mood-wellbeing", label: "Mood & Wellbeing" },
];

export function TopNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { activeProfileId, activeProfile, familyProfiles, setActiveProfileId } =
    useActiveProfile();

  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
    enabled: !!user,
  });
  const email = user?.email ?? "";
  const ownerName =
    profileQuery.data?.display_name?.trim() ||
    fallbackDisplayName(profileQuery.data?.first_name, profileQuery.data?.last_name, email) ||
    email;

  const currentLabel = activeProfile?.display_name ?? ownerName;
  const currentPicture = activeProfile?.profile_picture ?? profileQuery.data?.profile_picture ?? null;
  const currentColor = activeProfile?.avatar_color ?? "#6366f1";

  return (
    <header data-no-print className="border-b border-brand-border bg-brand-card">
      {user && pathname !== "/settings" && <ResumeSetupBanner />}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/icons/logo-round.png"
            alt="RxTracker"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="text-lg font-bold text-brand-navy">
            RxTracker
          </span>
        </Link>
        {user && (
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-control px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-deep-blue text-white"
                        : "text-brand-text hover:bg-brand-bg",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  className="rounded-control p-2 text-brand-text hover:bg-brand-bg lg:hidden"
                >
                  <Menu size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {NAV_LINKS.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="My profile"
                  title={email}
                  className="block h-9 w-9 shrink-0 overflow-hidden rounded-full"
                >
                  <Avatar pictureUrl={currentPicture} label={currentLabel} color={currentColor} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <CircleUser size={15} />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setActiveProfileId(null)}
                  className={activeProfileId === null ? "bg-brand-bg" : undefined}
                >
                  <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-full">
                    <Avatar pictureUrl={profileQuery.data?.profile_picture ?? null} label={ownerName} />
                  </span>
                  {ownerName}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/family" className="flex items-center gap-2">
                    <Users size={15} />
                    Manage Family
                  </Link>
                </DropdownMenuItem>
                {familyProfiles.length > 0 && (
                  <>
                    <DropdownMenuLabel>Family members</DropdownMenuLabel>
                    {familyProfiles.map((fp) => (
                      <DropdownMenuItem
                        key={fp.id}
                        onSelect={() => setActiveProfileId(fp.id)}
                        className={activeProfileId === fp.id ? "bg-brand-bg" : undefined}
                      >
                        <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-full">
                          <Avatar
                            pictureUrl={fp.profile_picture}
                            label={fp.display_name}
                            color={fp.avatar_color}
                          />
                        </span>
                        <span className="flex-1">{fp.display_name}</span>
                        {fp.relationship && (
                          <span className="text-xs text-brand-text-muted">{fp.relationship}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-control p-2 text-brand-text hover:bg-brand-bg"
            >
              <Settings size={18} />
            </Link>
            <Link
              href="/help"
              aria-label="Help"
              className="rounded-control p-2 text-brand-text hover:bg-brand-bg"
            >
              <HelpCircle size={18} />
            </Link>
          </div>
        )}
      </div>
      {user && <FamilyContextBanner />}
    </header>
  );
}
