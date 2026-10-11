import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY_SECTIONS } from "@/lib/legal-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Privacy Policy — RxTracker" };

// Public page (also linked from the sign-in / sign-up screens): signed-in
// visitors go back to the dashboard, everyone else to sign-in.
export default async function PrivacyPolicyPage() {
  let signedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    signedIn = false;
  }

  return (
    <LegalDocument
      title="Privacy Policy"
      sections={PRIVACY_SECTIONS}
      backHref={signedIn ? "/dashboard" : "/login"}
    />
  );
}
