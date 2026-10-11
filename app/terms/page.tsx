import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS_SECTIONS } from "@/lib/legal-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Terms of Use — RxTracker" };

// Public page (also linked from the sign-in / sign-up screens): signed-in
// visitors go back to the dashboard, everyone else to sign-in.
export default async function TermsofUsePage() {
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
      title="Terms of Use"
      sections={TERMS_SECTIONS}
      backHref={signedIn ? "/dashboard" : "/login"}
    />
  );
}
