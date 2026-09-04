"use client";

import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

const loginFeatures = [
  {
    title: "Smart reminders",
    description: "Never miss a dose again",
  },
  {
    title: "Track with confidence",
    description: "Log doses and monitor adherence",
  },
  {
    title: "Better health outcomes",
    description: "Stay informed and in control",
  },
];

const signupFeatures = [
  {
    title: "Medication reminders",
    description: "Get notified so you never miss a dose",
  },
  {
    title: "Refill tracking",
    description: "Know when to reorder and avoid running out",
  },
  {
    title: "Dose history",
    description: "Log and review your dose history",
  },
  {
    title: "Adherence reports",
    description: "See your progress and stay on track",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignup = pathname?.includes("signup");
  const features = isSignup ? signupFeatures : loginFeatures;

  return (
    <main className="grid min-h-screen flex-1 grid-cols-1 bg-brand-card md:grid-cols-[55fr_45fr]">
      <section className="relative hidden overflow-hidden bg-gradient-brand-hero px-12 pt-12 text-white md:flex md:flex-col md:justify-between">
        <div className="relative z-10 max-w-[440px]">
          <div className="flex items-center gap-3">
            <Image
              src="/images/auth/logo-round.png"
              alt=""
              width={56}
              height={56}
              className="rounded-2xl shadow-lg shadow-brand-dark-navy/20"
              aria-hidden="true"
              priority
            />
            <span className="text-2xl font-extrabold tracking-[-0.02em]">
              RxTracker
            </span>
          </div>

          <p className="mb-4 mt-7 text-[2.35rem] font-extrabold leading-[1.12] tracking-[-0.04em] text-white">
            {isSignup ? (
              <>
                Take control of
                <br />
                your health.
              </>
            ) : (
              <>
                Stay on track
                <br />
                with every dose.
              </>
            )}
          </p>

          <p className="mb-8 max-w-[340px] text-base leading-7 text-white/80">
            {isSignup
              ? "Join thousands of people who trust RxTracker to manage their medications every day."
              : "RxTracker helps you manage your medications, set reminders, and build healthier habits."}
          </p>

          <ul className="flex list-none flex-col gap-5 p-0">
            {features.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-black text-white shadow-md shadow-brand-blue/25">
                  ✓
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-white">
                    {feature.title}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-white/75">
                    {feature.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <AuthIllustration isSignup={isSignup} />

        <div className="relative z-10 mb-8 flex max-w-[420px] items-start gap-3 text-sm text-white/75">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
          <p>
            <span className="block">Your health information is secure with us.</span>
            <span className="mt-1 block text-xs">
              We use industry-standard encryption to protect your data.
            </span>
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-start justify-center bg-brand-bg px-5 pt-12 md:items-center md:bg-brand-card md:px-8 md:py-10">
        <div className="w-full max-w-[420px] rounded-card bg-brand-card p-7 shadow-card md:max-w-[520px] md:rounded-hero md:p-10">
          <div className="mb-7 flex flex-col items-center gap-3 md:hidden">
            <Image
              src="/images/auth/logo-round.png"
              alt=""
              width={58}
              height={58}
              className="rounded-2xl"
              aria-hidden="true"
            />
            <span className="text-xl font-extrabold text-brand-navy">RxTracker</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

function AuthIllustration({ isSignup }: { isSignup: boolean }) {
  if (isSignup) {
    return (
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute left-8 top-28 h-24 w-24 rounded-full bg-white/10 blur-sm" />
        <div className="absolute left-14 top-[48%] h-2 w-2 rounded-full bg-white/35" />
        <div className="absolute left-[16%] top-[34%] grid grid-cols-5 gap-2 opacity-30">
          {Array.from({ length: 25 }).map((_, index) => (
            <span key={index} className="h-1 w-1 rounded-full bg-white" />
          ))}
        </div>

        <div className="absolute bottom-[18%] right-[-18px] h-[430px] w-[340px] origin-bottom-right scale-[0.72] lg:right-6 lg:scale-[0.86] xl:right-12 xl:scale-100">
          <Image
            src="/images/auth/med-drop.png"
            alt=""
            width={130}
            height={170}
            className="absolute bottom-[150px] left-0 w-[82px] drop-shadow-2xl"
          />
          <Image
            src="/images/auth/med-bottle.png"
            alt=""
            width={260}
            height={390}
            className="absolute bottom-0 left-0 w-[180px] drop-shadow-2xl"
          />
          <Image
            src="/images/auth/med-capsule.png"
            alt=""
            width={190}
            height={190}
            className="absolute bottom-[-20px] left-[118px] w-[118px] rotate-[-10deg] drop-shadow-2xl"
          />
          <Image
            src="/images/auth/med-pill.png"
            alt=""
            width={170}
            height={170}
            className="absolute bottom-[-28px] left-[42px] w-[88px] rotate-[-8deg] drop-shadow-2xl"
          />
          <div className="absolute bottom-[70px] right-0 h-[310px] w-[210px] rounded-[38px] border border-white/55 bg-white/25 p-4 shadow-2xl shadow-brand-dark-navy/20 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between text-[10px] font-bold text-brand-navy">
              <span>Today</span>
              <span>+</span>
            </div>
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-brand-cyan bg-white/80 text-2xl font-extrabold text-brand-navy">
              75%
            </div>
            {["8:00 AM", "12:00 PM", "8:00 PM"].map((time) => (
              <div key={time} className="mb-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-brand-navy">
                <span>{time}</span>
                <span className="rounded-full bg-status-success px-1.5 text-white">✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div className="absolute right-[34%] top-16 h-14 w-14 rounded-full bg-white/10" />
      <div className="absolute right-[25%] top-28 h-16 w-16 rounded-full border border-white/20" />
      <div className="absolute right-[11%] top-[31%] h-16 w-16 rounded-full bg-white/10 blur-xl" />

      <div className="absolute bottom-[12%] right-[-8px] h-[420px] w-[390px] origin-bottom-right scale-[0.76] lg:right-8 lg:scale-[0.9] xl:right-14 xl:scale-100">
        <Image
          src="/images/auth/med-bottle.png"
          alt=""
          width={320}
          height={480}
          className="absolute bottom-[86px] left-[88px] w-[240px] drop-shadow-2xl"
          priority
        />
        <Image
          src="/images/auth/med-inhaler.png"
          alt=""
          width={210}
          height={210}
          className="absolute bottom-[90px] right-0 w-[160px] rotate-[8deg] drop-shadow-2xl"
        />
        <Image
          src="/images/auth/med-pill.png"
          alt=""
          width={150}
          height={150}
          className="absolute bottom-[82px] left-[30px] w-[104px] rotate-[-20deg] drop-shadow-2xl"
        />
        <Image
          src="/images/auth/med-capsule.png"
          alt=""
          width={170}
          height={170}
          className="absolute bottom-0 left-[170px] w-[122px] rotate-[-15deg] drop-shadow-2xl"
        />
        <Image
          src="/images/auth/med-drop.png"
          alt=""
          width={120}
          height={156}
          className="absolute right-0 top-[90px] w-[72px] rotate-[8deg] drop-shadow-2xl"
        />
        <Image
          src="/images/auth/med-drop.png"
          alt=""
          width={95}
          height={124}
          className="absolute right-[70px] top-[60px] w-[58px] rotate-[-10deg] drop-shadow-2xl"
        />
        <Image
          src="/images/auth/med-drop.png"
          alt=""
          width={95}
          height={124}
          className="absolute left-0 top-[185px] w-[68px] rotate-[12deg] drop-shadow-2xl"
        />
      </div>
    </div>
  );
}
