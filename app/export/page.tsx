import { TopNav } from "@/components/layout/TopNav";
import { ExportClient } from "@/components/export/ExportClient";

export default function ExportPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <ExportClient />
      </main>
    </>
  );
}
