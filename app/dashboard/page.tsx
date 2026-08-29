import { TopNav } from "@/components/layout/TopNav";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <DashboardClient setupComplete={params.setup === "complete"} />
      </main>
    </>
  );
}
