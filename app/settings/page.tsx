import { TopNav } from "@/components/layout/TopNav";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <SettingsClient />
        </div>
      </main>
    </>
  );
}
