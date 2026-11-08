import { Info } from "lucide-react";
import { BeforeAfter } from "../components/ui/BeforeAfter";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { PageHero } from "../components/ui/PageHero";
import { Reveal } from "../components/ui/Reveal";
import { useLang } from "../lib/i18n";
import { navPaths } from "../lib/site";

export default function Results() {
  const { t } = useLang();

  return (
    <>
      <PageHero kicker={t.resultsPage.kicker} title={t.resultsPage.title} lead={t.resultsPage.lead} />

      <section className="container-x pb-16 md:pb-24">
        <div className="grid gap-8 md:grid-cols-2">
          {t.results.map((item, index) => (
            <Reveal key={item.name} delay={(index % 2) * 0.06}>
              <article className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-4">
                <BeforeAfter
                  before={item.before}
                  after={item.after}
                  beforeLabel={t.resultsPage.before}
                  afterLabel={t.resultsPage.after}
                  name={item.name}
                />
                <div className="flex items-center justify-between gap-4 px-2 pb-1 pt-5">
                  <div>
                    <p className="font-display text-base font-semibold text-cream">{item.name}</p>
                    <p className="mt-0.5 text-xs text-cream/40">
                      {t.resultsPage.durationLabel}: {item.duration}
                    </p>
                  </div>
                  <span className="rounded-full bg-lemon/10 px-3 py-1.5 font-latin text-lg text-lemon">
                    {item.stat}
                  </span>
                </div>
                <p className="px-2 pb-2 pt-2 text-sm leading-relaxed text-cream/50">{item.summary}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8">
          <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-cream/40">
            <Info className="mt-0.5 size-4 shrink-0 text-lemon/70" aria-hidden />
            {t.resultsPage.demoNote}
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <CTA to={navPaths.contact} size="lg">
            {t.resultsPage.cta}
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
