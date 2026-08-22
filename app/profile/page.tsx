import { TopNav } from "@/components/layout/TopNav";
import { ProfileClient } from "@/components/profile/ProfileClient";

export default function ProfilePage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <ProfileClient />
      </main>
    </>
  );
}
