import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-gradient-brand-hero px-4 py-12">
      <div className="w-full max-w-sm rounded-hero bg-brand-card p-8 shadow-card">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image
            src="/icons/logo-round.png"
            alt="RxTracker"
            width={56}
            height={56}
            className="rounded-full"
          />
          <h1 className="text-xl font-bold text-brand-navy">RxTracker</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
