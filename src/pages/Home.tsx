import { ArrowDown, Check, Flame, ShieldCheck, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { BeforeAfter } from "../components/ui/BeforeAfter";
import { Counter } from "../components/ui/Counter";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { FaqAccordion } from "../components/ui/FaqAccordion";
import { Marquee } from "../components/ui/Marquee";
import { ProgramCard } from "../components/ui/ProgramCard";
import { Reveal, Stagger, StaggerItem } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { ServiceCard } from "../components/ui/ServiceCard";
import type { Testimonial } from "../content/types";
import { images } from "../lib/images";
import { useLang } from "../lib/i18n";
import { navPaths } from "../lib/site";

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <article className="flex w-[19rem] shrink-0 flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:w-[21rem]">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5" aria-label={`${item.rating}/5`}>
          {Array.from({ length: item.rating }).map((_, index) => (
            <Star key={index} className="size-3.5 fill-lemon text-lemon" aria-hidden />
          ))}
        </div>
        <span className="rounded-full bg-lemon/10 px-2.5 py-1 text-[11px] font-bold text-lemon">{item.result}</span>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-cream/70">“{item.quote}”</p>
      <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-cream/10 font-display text-xs font-bold text-cream/70">
          {item.name.charAt(0)}
        </span>
        <div>
          <p className="text-sm font-semibold text-cream">{item.name}</p>
          <p className="text-[11px] text-cream/40">{item.role}</p>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { t, lang, settings } = useLang();
  const featured = t.results[0];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-14 pt-28 md:pb-20 md:pt-36">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at 50% 0%, #000 25%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, #000 25%, transparent 72%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 end-[-10%] size-[520px] rounded-full bg-lemon/[0.12] blur-[140px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 start-1/2 hidden -translate-x-1/2 select-none font-latin text-[17vw] leading-none text-outline opacity-[0.12] lg:block"
          aria-hidden
        >
          TRANSFORM
        </div>

        <div className="container-x relative grid items-center gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <Reveal>
              <span className="eyebrow">
                <span className="h-px w-8 bg-lemon/70" aria-hidden />
                {t.hero.kicker}
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="display-xl mt-6 text-[3.1rem] leading-[0.98] sm:text-7xl lg:text-[5.4rem]">
                <span className="block text-cream">{t.hero.titleLine1}</span>
                <span className="relative block text-lemon">
                  {t.hero.titleLine2}
                  <svg
                    viewBox="0 0 300 14"
                    className="absolute -bottom-2 start-0 w-40 text-lemon/40 sm:w-56"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path d="M2 9c60-6 130-8 296-3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-8 max-w-xl text-base leading-relaxed text-cream/60 md:text-lg">{t.hero.sub}</p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap gap-3">
                <CTA to={navPaths.contact} size="lg">
                  {t.hero.ctaPrimary}
                </CTA>
                <CTA to={navPaths.calculator} size="lg" variant="outline">
                  {t.hero.ctaSecondary}
                </CTA>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-xs text-cream/50 sm:text-sm">
                {t.hero.badges.map((badge) => (
                  <li key={badge} className="flex items-center gap-2">
                    <Check className="size-4 text-lemon" aria-hidden />
                    {badge}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="relative lg:col-span-5">
            <Reveal delay={0.15} y={40}>
              <div className="relative mx-auto w-full max-w-md lg:ms-auto">
                <div className="absolute -inset-4 rounded-[2.6rem] border border-lemon/15" aria-hidden />
                <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-ink-2">
                  <img
                    src={settings?.hero.image || images.hero}
                    alt={t.hero.portraitName}
                    className="aspect-[4/5] w-full object-cover"
                    fetchPriority="high"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/15 to-transparent" aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lemon">
                      <ShieldCheck className="size-4" aria-hidden />
                      {lang === "ar" ? "معتمد" : "Certified"}
                    </div>
                    <p className="mt-2 font-display text-lg font-bold text-cream">{t.hero.portraitName}</p>
                    <p className="text-xs text-cream/50">{t.hero.portraitRole}</p>
                  </div>
                </div>

                <div className="absolute -start-4 top-10 animate-floaty rounded-2xl border border-white/10 bg-ink/85 px-4 py-3 backdrop-blur md:-start-10">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-lemon text-ink">
                      <Flame className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="font-latin text-lg leading-none text-cream">12K</p>
                      <p className="mt-1 text-[10px] text-cream/50">
                        {lang === "ar" ? "كيلو دهون" : "kg fat lost"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-5 end-2 flex items-center gap-2 rounded-full border border-lemon/25 bg-ink/90 px-4 py-2.5 backdrop-blur md:end-6">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-lemon opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-lemon" />
                  </span>
                  <span className="text-[11px] font-semibold text-cream/80">
                    {lang === "ar" ? "متابعة أسبوعية" : "Weekly follow-up"}
                  </span>
                </div>

                <div className="absolute -start-8 -bottom-8 hidden size-24 animate-spin-slow items-center justify-center rounded-full bg-lemon text-ink md:flex">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
                    <defs>
                      <path id="badgeCircle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
                    </defs>
                    <text className="fill-ink text-[8px] font-bold uppercase" style={{ letterSpacing: "0.22em" }}>
                      <textPath href="#badgeCircle">NUTRITION · TRAINING · RESULTS ·</textPath>
                    </text>
                  </svg>
                  <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
                    <path d="M13.5 2 4.8 14h6.1L9 22l8.8-12h-6.1l1.8-8Z" />
                  </svg>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="container-x relative mt-16 md:mt-24">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-4">
            {t.stats.map((stat) => (
              <div key={stat.label} className="bg-ink px-5 py-7 text-center">
                <dd className="font-latin text-4xl text-lemon sm:text-5xl">
                  <Counter value={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="mt-2 text-[11px] text-cream/50 sm:text-xs">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-10 flex justify-center">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cream/30">
            {t.hero.scroll}
            <ArrowDown className="size-3.5" aria-hidden />
          </span>
        </div>
      </section>

      <Marquee items={t.marquee} />

      {/* About teaser */}
      <section className="container-x py-20 md:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="relative order-2 lg:order-1">
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3 overflow-hidden rounded-[1.75rem] border border-white/10">
                <img
                  src={images.about}
                  alt={t.hero.portraitName}
                  className="aspect-[3/4] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-4">
                <div className="overflow-hidden rounded-[1.4rem] border border-white/10">
                  <img src={images.foodAlt} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                </div>
                <div className="flex flex-1 flex-col justify-center rounded-[1.4rem] border border-lemon/25 bg-lemon/[0.07] p-5">
                  <p className="font-latin text-4xl leading-none text-lemon">8+</p>
                  <p className="mt-2 text-[11px] leading-snug text-cream/60">
                    {lang === "ar" ? "سنوات خبرة في التغذية والتدريب" : "Years in nutrition & training"}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <SectionHeading kicker={t.home.aboutKicker} title={t.home.aboutTitle} />
            <Reveal delay={0.08}>
              <p className="mt-5 text-base leading-relaxed text-cream/60 md:text-lg">{t.home.aboutLead}</p>
              <ul className="mt-8 space-y-4">
                {t.home.pillars.map((pillar, index) => (
                  <li key={pillar.title} className="flex gap-4">
                    <span className="font-latin text-sm text-lemon/60">0{index + 1}</span>
                    <div>
                      <p className="font-display text-base font-semibold text-cream">{pillar.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-cream/50">{pillar.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <CTA to={navPaths.about} variant="outline" size="md">
                  {t.home.aboutCta}
                </CTA>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="border-y border-white/10 bg-ink-2/60 py-20 md:py-28">
        <div className="container-x">
          <SectionHeading
            kicker={t.home.servicesKicker}
            title={t.home.servicesTitle}
            sub={t.home.servicesSub}
            action={
              <CTA to={navPaths.services} variant="outline" icon={false}>
                {t.home.servicesCta}
              </CTA>
            }
          />
          <Stagger className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.services.map((service) => (
              <StaggerItem key={service.title} className="h-full">
                <ServiceCard service={service} linkLabel={t.ui.viewAll} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Programs */}
      <section className="container-x py-20 md:py-28">
        <SectionHeading
          kicker={t.home.programsKicker}
          title={t.home.programsTitle}
          sub={t.home.programsSub}
          action={
            <CTA to={navPaths.programs} variant="outline" icon={false}>
              {t.home.programsCta}
            </CTA>
          }
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
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
      </section>

      {/* Calculator teaser */}
      <section className="container-x pb-20 md:pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-lemon/[0.14] via-ink-2 to-ink p-7 md:p-12">
            <div
              className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full border-[36px] border-lemon/10"
              aria-hidden
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <span className="eyebrow">{t.home.calcKicker}</span>
                <h2 className="mt-4 text-3xl leading-[1.12] md:text-4xl lg:text-5xl">{t.home.calcTitle}</h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/60 md:text-base">{t.home.calcText}</p>
                <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-cream/55">
                  {t.home.calcBullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-1.5">
                      <Check className="size-3.5 text-lemon" aria-hidden />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <CTA to={navPaths.calculator} size="lg" className="mt-8">
                  {t.home.calcCta}
                </CTA>
              </div>

              <div className="relative mx-auto w-full max-w-sm rounded-3xl border border-white/10 bg-ink/80 p-6 backdrop-blur">
                <div className="flex items-center justify-between text-[11px] text-cream/45">
                  <span>{lang === "ar" ? "نتيجتك المتوقعة" : "Your estimate"}</span>
                  <span className="rounded-full bg-lemon/15 px-2 py-0.5 font-semibold text-lemon">
                    {lang === "ar" ? "تلقائي" : "Instant"}
                  </span>
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-latin text-6xl leading-none text-lemon">2,450</span>
                  <span className="pb-2 text-xs text-cream/50">{t.calculator.results.unitKcal}</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: t.calculator.results.protein, value: "160", unit: t.calculator.results.unitG },
                    { label: t.calculator.results.carbs, value: "240", unit: t.calculator.results.unitG },
                    { label: t.calculator.results.fat, value: "70", unit: t.calculator.results.unitG },
                  ].map((macro) => (
                    <div key={macro.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3">
                      <p className="text-[10px] text-cream/40">{macro.label}</p>
                      <p className="mt-1 font-latin text-lg text-cream">
                        {macro.value}
                        <span className="text-[10px] text-cream/40"> {macro.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-lemon-deep to-lemon" />
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-cream/35">{t.calculator.results.disclaimer}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Results */}
      <section className="border-y border-white/10 bg-ink-2/60 py-20 md:py-28">
        <div className="container-x grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <BeforeAfter
              before={featured.before}
              after={featured.after}
              beforeLabel={t.resultsPage.before}
              afterLabel={t.resultsPage.after}
              name={featured.name}
            />
          </Reveal>
          <div>
            <SectionHeading kicker={t.home.resultsKicker} title={t.home.resultsTitle} sub={t.home.resultsSub} />
            <Reveal delay={0.08}>
              <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
                {t.results.slice(0, 3).map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="font-display text-sm font-semibold text-cream">{item.name}</p>
                      <p className="mt-0.5 text-xs text-cream/40">{item.duration}</p>
                    </div>
                    <span className="font-latin text-xl text-lemon">{item.stat}</span>
                  </div>
                ))}
              </div>
              <CTA to={navPaths.results} variant="outline" className="mt-8">
                {t.home.resultsCta}
              </CTA>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="container-x">
          <SectionHeading
            kicker={t.home.testimonialsKicker}
            title={t.home.testimonialsTitle}
            align="center"
            className="mx-auto max-w-2xl"
          />
        </div>
        <div className="marquee-mask mt-12 overflow-hidden">
          <div className="marquee-track gap-5">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex gap-5 pe-5" aria-hidden={copy === 1}>
                {t.testimonials.map((item) => (
                  <TestimonialCard key={`${copy}-${item.name}`} item={item} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x pb-20 md:pb-28">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionHeading kicker={t.home.faqKicker} title={t.home.faqTitle} />
            <Reveal delay={0.08}>
              <Link
                to={navPaths.contact}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lemon"
              >
                {t.home.faqCta}
                <span aria-hidden>←</span>
              </Link>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <FaqAccordion items={t.faq.items.slice(0, 4)} />
          </Reveal>
        </div>
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
