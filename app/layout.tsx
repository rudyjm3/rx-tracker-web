import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/layout/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RxTracker",
  description: "Medication tracking and reminders",
  icons: {
    icon: "/icons/favicon.ico",
    apple: "/icons/icon-192.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // Supabase isn't configured yet (missing/placeholder env vars) — render
    // the app in a signed-out state instead of crashing.
  }

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-text">
        <QueryProvider>
          <AuthProvider initialUser={user}>
            {children}
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
