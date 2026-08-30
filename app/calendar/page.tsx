import { Suspense } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export default function CalendarPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense>
          <CalendarClient />
        </Suspense>
      </main>
    </>
  );
}
