import { TopNav } from "@/components/layout/TopNav";
import { MoodWellbeingClient } from "@/components/wellbeing/MoodWellbeingClient";

export default function MoodWellbeingPage() {
  return (
    <>
      <TopNav />
      {/* Hidden on print so the Mood Graph Modal's own print button (see
          GraphModal.tsx) prints just the chart, not the page behind it —
          the modal itself renders into a Radix portal outside this
          <main>, so it stays visible. */}
      <main data-no-print className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <MoodWellbeingClient />
      </main>
    </>
  );
}
