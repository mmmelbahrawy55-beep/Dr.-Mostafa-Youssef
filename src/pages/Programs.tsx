import { Check, Minus } from "lucide-react";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { FaqAccordion } from "../components/ui/FaqAccordion";
import { PageHero } from "../components/ui/PageHero";
import { ProgramCard } from "../components/ui/ProgramCard";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { useLang } from "../lib/i18n";

function Cell({ value }: { value: string }) {
  if (value === "✓") {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-lemon/15 text-lemon">
        <Check className="size-3.5" aria-hidden />
      </span>
    );
  }
  if (value === "—") {
    return <Minus className="mx-auto size-4 text-cream/25" aria-hidden />;
  }
  return <span className="text-xs font-medium text-cream/70">{value}</span>;
}

export default function Programs() {
  const { t } = useLang();

  return (
    <>
      <PageHero kicker={t.programsPage.kicker} title={t.programsPage.title} lead={t.programsPage.lead} />

      <section className="container-x pb-16 md:pb-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {t.programs.map((program, index) => (
            <Reveal key={program.id} delay={index * 0.08} className="h-full">
              <ProgramCard
                program={program}
                popularLabel={t.programsPage.popular}
                perMonth={t.programsPage.perMonth}
                currency={t.programsPage.currency}
                includesLabel={t.programsPage.includes}
                ctaLabel={t.programsPage.cta}
                ctaTo={`/subscribe/${program.contentId ?? program.id}`}
              />
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-cream/40">{t.programsPage.note}</p>
      </section>

      <section className="container-x pb-20 md:pb-24">
        <SectionHeading kicker={t.programsPage.compareTitle} title={t.programsPage.compareTitle} />
        <Reveal className="mt-8 overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-start">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="px-5 py-4 text-start text-xs font-semibold uppercase tracking-[0.14em] text-cream/40">
                  {t.programsPage.includes}
                </th>
                {t.programs.map((program) => (
                  <th key={program.id} className="px-4 py-4 text-center font-display text-sm font-semibold text-cream">
                    {program.name}
                    {program.popular && (
                      <span className="ms-2 rounded-full bg-lemon px-2 py-0.5 text-[9px] font-bold text-ink">
                        ★
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.programsPage.compareRows.map((row, rowIndex) => (
                <tr
                  key={row.label}
                  className={rowIndex % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}
                >
                  <td className="px-5 py-4 text-sm text-cream/65">{row.label}</td>
                  {row.values.map((value, valueIndex) => (
                    <td key={`${row.label}-${valueIndex}`} className="px-4 py-4 text-center">
                      <Cell value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="container-x pb-20 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHeading kicker={t.faq.kicker} title={t.faq.title} />
          <FaqAccordion items={t.programsPage.faqs} />
        </div>
        <Reveal className="mt-10">
          <CTA to="/contact" variant="outline">
            {t.ui.book}
          </CTA>
        </Reveal>
      </section>

      <CtaBand
        kicker={t.finalCta.kicker}
        title={t.finalCta.title}
        text={t.finalCta.text}
        primary={t.finalCta.primary}
        secondary={t.finalCta.secondary}
      />
    </>
  );
}
