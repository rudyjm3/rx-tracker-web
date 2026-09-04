import Image from "next/image";

const authFeatures = [
  "Track adherence",
  "Medication plans",
  "Refill reminders",
  "Adherence reports",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen flex-1 grid-cols-1 bg-brand-card md:grid-cols-[55fr_45fr]">
      <section className="relative hidden overflow-hidden bg-gradient-brand-hero px-12 pt-12 text-white md:flex md:flex-col md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={44}
              height={44}
              className="rounded-[10px]"
              aria-hidden="true"
            />
            <span className="text-[1.3rem] font-extrabold">RxTracker</span>
          </div>

          <p className="my-10 text-[2.1rem] font-extrabold leading-tight text-white">
            Stay on track
            <br />
            with every dose.
          </p>

          <ul className="flex list-none flex-col gap-3 p-0 text-[0.95rem] font-semibold text-white/90">
            {authFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-white/20 text-sm text-white">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <Image
          src="/images/blue-white-pill-graphic.png"
          alt=""
          width={680}
          height={680}
          className="pointer-events-none mx-auto block w-4/5 max-w-[340px] self-end opacity-[0.22] select-none"
          aria-hidden="true"
          priority
        />
      </section>

      <section className="flex min-h-screen items-start justify-center bg-brand-bg px-5 pt-12 md:items-center md:bg-brand-card md:px-8 md:py-10">
        <div className="w-full max-w-[420px] rounded-card bg-brand-card p-7 shadow-card md:rounded-none md:p-0 md:shadow-none">
          <div className="mb-7 flex items-center gap-3 md:hidden">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={44}
              height={44}
              className="rounded-[10px]"
              aria-hidden="true"
            />
            <span className="text-[1.3rem] font-extrabold text-brand-navy">
              RxTracker
            </span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
