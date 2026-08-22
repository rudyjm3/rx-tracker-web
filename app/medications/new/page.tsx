import { TopNav } from "@/components/layout/TopNav";
import { WizardShell } from "@/components/medications/wizard/WizardShell";

export default async function NewMedicationPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft } = await searchParams;

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-brand-navy">
          Add medication
        </h1>
        <WizardShell mode="create" draftId={draft} />
      </main>
    </>
  );
}
