import { TopNav } from "@/components/layout/TopNav";
import { HistoryClient } from "@/components/history/HistoryClient";

export default function HistoryPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <HistoryClient />
      </main>
    </>
  );
}
