import { TopNav } from "@/components/layout/TopNav";
import { FamilyClient } from "@/components/family/FamilyClient";

export default function FamilyPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <FamilyClient />
      </main>
    </>
  );
}
