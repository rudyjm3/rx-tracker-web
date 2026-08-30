import { TopNav } from "@/components/layout/TopNav";
import { PainTrackingClient } from "@/components/wellbeing/PainTrackingClient";

export default function PainTrackingPage() {
  return (
    <>
      <TopNav />
      {/* Hidden on print so the Pain Graph Modal's own print button (see
          GraphModal.tsx) prints just the chart, not the page behind it —
          the modal itself renders into a Radix portal outside this
          <main>, so it stays visible. */}
      <main data-no-print className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <PainTrackingClient />
      </main>
    </>
  );
}
