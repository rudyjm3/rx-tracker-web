import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { LEGAL_EFFECTIVE_DATE, type LegalSection } from "@/lib/legal-content";

// Inline markup in legal copy: **bold** and [label](href).
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/).map((part, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <Link key={i} href={link[2]} className="text-brand-blue hover:underline">
          {link[1]}
        </Link>
      );
    }
    return part;
  });
}

// Public page shell shared by /terms and /privacy: centered 720 px column,
// "Back" link, and a card with the brand, title, effective date and sections.
export function LegalDocument({
  title,
  sections,
  backHref,
}: {
  title: string;
  sections: LegalSection[];
  backHref: string;
}) {
  return (
    <main className="min-h-screen flex-1 bg-brand-bg px-4 py-8">
      <div className="mx-auto w-full max-w-[720px]">
        <Link
          href={backHref}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>

        <article className="rounded-card bg-brand-card p-7 shadow-card md:rounded-hero md:p-10">
          <div className="mb-6 flex items-center gap-3">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={48}
              height={48}
              className="rounded-xl"
              aria-hidden="true"
            />
            <span className="text-xl font-extrabold text-brand-navy">RxTracker</span>
          </div>

          <h1 className="mb-1 text-[1.6rem] font-extrabold leading-tight text-brand-navy">{title}</h1>
          <p className="mb-8 text-sm text-brand-text-muted">Effective date: {LEGAL_EFFECTIVE_DATE}</p>

          {sections.map((section) => (
            <section key={section.title} className="mb-7 last:mb-0">
              <h2 className="mb-2 text-[1.1rem] font-bold text-brand-navy">{section.title}</h2>
              {section.blocks.map((block, i) => {
                const afterList = i > 0 && "ul" in section.blocks[i - 1];
                if ("ul" in block) {
                  return (
                    <ul key={i} className="ml-5 list-disc leading-7 text-brand-text">
                      {block.ul.map((item) => (
                        <li key={item}>{renderInline(item)}</li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={i} className={`leading-6 text-brand-text ${afterList ? "mt-3" : ""}`}>
                    {renderInline(block.p)}
                  </p>
                );
              })}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
