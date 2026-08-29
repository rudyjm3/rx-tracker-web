import { TopNav } from "@/components/layout/TopNav";

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    question: "What does RxTracker do?",
    answer: (
      <p>
        RxTracker helps you keep track of medications, supplements, and OTC products —
        reminding you when a dose is due, logging whether it was taken, skipped, or missed, and
        tracking how much supply you have on hand. It also lets you log pain and mood alongside
        doses, manage a family of profiles from one account, and export a doctor visit report
        summarizing everything for an appointment.
      </p>
    ),
  },
  {
    question: "How do dose reminders and snoozing work?",
    answer: (
      <p>
        Each medication has one or more scheduled times (fixed times of day, or a repeating
        interval). When a dose becomes due, it appears on your Dashboard&apos;s Today Schedule
        with Take, Skip, and Snooze actions. Snoozing postpones the reminder by your chosen
        duration (5, 10, 15, or 30 minutes by default — set the default under Settings). If a
        dose isn&apos;t logged within your configured grace period after its scheduled time
        (also set under Settings, default 60 minutes), it&apos;s marked missed automatically.
      </p>
    ),
  },
  {
    question: "How does inventory tracking and refill logging work?",
    answer: (
      <p>
        When inventory tracking is enabled for a medication, RxTracker deducts the dose quantity
        from your on-hand count each time you log a dose as taken. When you refill a
        prescription, log the refill from the medication&apos;s menu with the date and new
        amount — RxTracker updates your current supply and remembers the refill in that
        medication&apos;s history. If your count ever drifts from reality (a manual pill count,
        for example), use Adjust Quantity to correct it without recording it as a refill. A
        medication nearing its low-supply threshold shows a refill reminder on the Dashboard.
      </p>
    ),
  },
  {
    question: "What does \"adherence\" mean and how is it calculated?",
    answer: (
      <p>
        Adherence is the share of your required doses that you actually took, out of every
        required dose that&apos;s already come due (taken, skipped, or missed — a dose still
        pending later today isn&apos;t counted yet either way). As-needed (PRN) medications
        aren&apos;t included, since they have no schedule to be adherent to. A dose taken after
        your grace period is still counted as &quot;taken&quot; for adherence — it&apos;s just
        flagged as late in the dose history.
      </p>
    ),
  },
  {
    question: "How do family profiles work?",
    answer: (
      <p>
        From the avatar menu in the top navigation, add a family member under Manage Family to
        create a profile for them — a name, relationship, and optional photo. Switching to a
        family member&apos;s profile shows their own medications, schedule, and history
        separately from yours; a banner appears reminding you which profile is active, with a
        one-click way back to your own. Each family member&apos;s data (medications, dose logs,
        allergies, and so on) is kept completely separate from yours and everyone else&apos;s.
      </p>
    ),
  },
  {
    question: "How do I export a doctor visit report?",
    answer: (
      <p>
        Open the Export page from the top navigation. It compiles your active medications,
        dose-change history, recent dose history, logged side effects, and allergies into one
        printable report. Click Print Report to open your browser&apos;s print dialog — the
        page is formatted to print cleanly (navigation and controls are hidden automatically) so
        you can hand a paper copy to your doctor or save it as a PDF.
      </p>
    ),
  },
];

export default function HelpPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Help &amp; FAQ</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Answers to common questions about how RxTracker works. Click a question to expand
              it.
            </p>
          </div>

          <section className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-control border border-brand-border p-3 open:bg-brand-bg"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-brand-navy marker:content-none">
                  <span className="flex items-center justify-between gap-2">
                    {faq.question}
                    <span
                      aria-hidden
                      className="text-brand-text-muted transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </span>
                </summary>
                <div className="mt-2 text-sm text-brand-text-muted">{faq.answer}</div>
              </details>
            ))}
          </section>

          <p className="text-xs text-brand-text-muted">
            Still have a question that isn&apos;t answered here? RxTracker is a tracking aid only
            and does not provide medical advice — for anything about your treatment itself,
            please check with your doctor or pharmacist.
          </p>
        </div>
      </main>
    </>
  );
}
