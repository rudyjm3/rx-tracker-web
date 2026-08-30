import { TopNav } from "@/components/layout/TopNav";
import { ProfileClient } from "@/components/profile/ProfileClient";

export default function ProfilePage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <ProfileClient />
        </div>
      </main>
    </>
  );
}
