import { TopNav } from "@/components/layout/TopNav";
import { FamilyMemberDetailClient } from "@/components/family/FamilyMemberDetailClient";

export default async function FamilyMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <FamilyMemberDetailClient profileId={id} />
      </main>
    </>
  );
}
