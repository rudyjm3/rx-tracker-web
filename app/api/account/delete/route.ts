import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Permanently deletes the caller's own auth account (and, via each app
// table's `on delete cascade` to auth.users, every row of their data).
// Requires the service-role key — never exposed to the browser — so this
// runs server-side only, after independently re-verifying who the caller
// is from their own session cookie rather than trusting a client-supplied
// user id.
export async function POST(request: Request) {
  const { confirmEmail } = await request.json().catch(() => ({}));
  if (typeof confirmEmail !== "string") {
    return NextResponse.json({ error: "confirmEmail is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation did not match. Account not deleted." },
      { status: 400 },
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Account deletion is not configured on this server." },
      { status: 500 },
    );
  }

  const admin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Avatar objects live under the user's own uid folder but aren't
  // linked to auth.users by a foreign key, so deleting the user first
  // would leave them orphaned in storage rather than being cleaned up
  // automatically.
  const { data: avatarFiles } = await admin.storage.from("avatars").list(user.id);
  if (avatarFiles && avatarFiles.length > 0) {
    await admin.storage
      .from("avatars")
      .remove(avatarFiles.map((file) => `${user.id}/${file.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
