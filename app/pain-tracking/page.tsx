import { TopNav } from "@/components/layout/TopNav";
import { PainTrackingClient } from "@/components/wellbeing/PainTrackingClient";

export default function PainTrackingPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <PainTrackingClient />
      </main>
    </>
  );
}
