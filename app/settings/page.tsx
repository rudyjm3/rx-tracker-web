import { TopNav } from "@/components/layout/TopNav";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <SettingsClient />
      </main>
    </>
  );
}
