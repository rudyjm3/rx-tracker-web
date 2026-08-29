import { TopNav } from "@/components/layout/TopNav";
import { MedicationsListClient } from "@/components/medications/MedicationsListClient";

export default function MedicationsPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-brand-navy">Medication Plan</h1>
        <MedicationsListClient />
      </main>
    </>
  );
}
