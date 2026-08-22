import { TopNav } from "@/components/layout/TopNav";

export default function DashboardPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="rounded-hero bg-gradient-brand-hero p-8 text-white shadow-card">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-white/80">
            Your dashboard is on the way — medications, today&apos;s
            schedule, and adherence will live here.
          </p>
        </div>
      </main>
    </>
  );
}
