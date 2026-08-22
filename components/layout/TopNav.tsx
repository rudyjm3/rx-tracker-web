"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

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
  const { user, signOut } = useAuth();

  return (
    <header data-no-print className="border-b border-brand-border bg-brand-card">
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

            <span className="hidden text-sm text-brand-text-muted sm:inline">
              {user.email}
            </span>
            <Button variant="secondary" size="compact" onClick={signOut}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
