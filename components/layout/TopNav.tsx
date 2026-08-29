"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/layout/AuthProvider";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { ResumeSetupBanner } from "@/components/layout/ResumeSetupBanner";
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
import { fallbackDisplayName } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/medications", label: "Medications" },
  { href: "/pain-tracking", label: "Pain Tracking" },
  { href: "/mood-wellbeing", label: "Mood & Wellbeing" },
  { href: "/history", label: "History" },
  { href: "/export", label: "Export" },
  { href: "/family", label: "Family" },
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
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
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-4 lg:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-brand-text hover:text-brand-deep-blue"
                >
                  {link.label}
                </Link>
              ))}
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
                  <Link href="/profile">My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/family">Manage Family</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Switch profile</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => setActiveProfileId(null)}
                  className={activeProfileId === null ? "bg-brand-bg" : undefined}
                >
                  <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-full">
                    <Avatar pictureUrl={profileQuery.data?.profile_picture ?? null} label={ownerName} />
                  </span>
                  {ownerName}
                </DropdownMenuItem>
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
                    {fp.display_name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
