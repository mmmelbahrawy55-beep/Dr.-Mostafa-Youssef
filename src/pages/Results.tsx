import { ArrowUpRight, Info, Quote, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { BeforeAfter } from "../components/ui/BeforeAfter";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { PageHero } from "../components/ui/PageHero";
import { Reveal } from "../components/ui/Reveal";
import { useLang } from "../lib/i18n";
import { navPaths } from "../lib/site";

export default function Results() {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const [featured, ...rest] = t.results;

  return (
    <>
      <PageHero kicker={t.resultsPage.kicker} title={t.resultsPage.title} lead={t.resultsPage.lead} />

      <section className="container-x pb-16 md:pb-24">
        {featured && (
          <Reveal>
            <article className="panel-premium grid overflow-hidden rounded-[2.25rem] p-4 lg:grid-cols-[1.08fr_0.92fr] lg:gap-2 lg:p-6">
              <BeforeAfter
                before={featured.before}
                after={featured.after}
                beforeLabel={t.resultsPage.before}
                afterLabel={t.resultsPage.after}
                name={featured.name}
                stat={featured.stat}
                hint={t.resultsPage.drag}
              />

              <div className="flex flex-col justify-center p-4 pt-7 md:p-7 lg:ps-10">
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow">
                    <span className="h-px w-7 bg-lemon/70" aria-hidden />
                    {ar ? "الحالة المميزة" : "Featured case"}
                  </span>
                  <span className="font-latin text-5xl leading-none text-white/10">01</span>
                </div>

                <h2 className="mt-5 text-3xl leading-tight md:text-4xl">{featured.name}</h2>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[11px] text-cream/60">
                    <Timer className="size-3.5 text-lemon" aria-hidden />
                    {t.resultsPage.durationLabel}: {featured.duration}
                  </span>
                  <span className="rounded-full bg-lemon px-4 py-1.5 font-latin text-lg leading-none text-ink">
                    {featured.stat}
                  </span>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-cream/60 md:text-base">{featured.summary}</p>

                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <Quote className="mt-0.5 size-4 shrink-0 text-lemon/70" aria-hidden />
                  <p className="text-[11px] leading-relaxed text-cream/45">
                    {ar
                      ? "النتيجة مش مجرد رقم على الميزان — المتابعة بتعدّل الخطة على القياسات والطاقة والتحاليل."
                      : "The result is more than a scale number — the plan is adjusted from measurements, energy and labs."}
                  </p>
                </div>

                <Link
                  to={navPaths.contact}
                  className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-lemon transition-colors hover:text-lemon-soft"
                >
                  {t.resultsPage.cta}
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </div>
            </article>
          </Reveal>
        )}

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {rest.map((item, index) => (
            <Reveal key={item.name} delay={(index % 2) * 0.06}>
              <article className="panel h-full overflow-hidden rounded-[2rem] p-3.5 md:p-4">
                <BeforeAfter
                  before={item.before}
                  after={item.after}
                  beforeLabel={t.resultsPage.before}
                  afterLabel={t.resultsPage.after}
                  name={item.name}
                  stat={item.stat}
                  hint={t.resultsPage.drag}
                />
                <div className="px-2 pb-1 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-latin text-xs text-lemon/50">0{index + 2}</span>
                      <p className="font-display text-sm font-bold text-cream">{item.name}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-cream/40">
                      <Timer className="size-3" aria-hidden />
                      {item.duration}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-cream/50">{item.summary}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6">
          <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-cream/40">
            <Info className="mt-0.5 size-4 shrink-0 text-lemon/70" aria-hidden />
            {t.resultsPage.demoNote}
          </p>
        </Reveal>

        <Reveal className="mt-9">
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
