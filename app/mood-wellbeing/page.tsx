import { TopNav } from "@/components/layout/TopNav";
import { MoodWellbeingClient } from "@/components/wellbeing/MoodWellbeingClient";

export default function MoodWellbeingPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <MoodWellbeingClient />
      </main>
    </>
  );
}
