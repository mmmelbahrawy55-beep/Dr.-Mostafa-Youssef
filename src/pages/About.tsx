import { BadgeCheck, Quote } from "lucide-react";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { PageHero } from "../components/ui/PageHero";
import { Reveal, Stagger, StaggerItem } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { images } from "../lib/images";
import { useLang } from "../lib/i18n";
import { navPaths } from "../lib/site";

export default function About() {
  const { t, lang } = useLang();

  return (
    <>
      <PageHero
        kicker={t.about.intro.kicker}
        title={t.about.intro.title}
        lead={t.about.intro.lead}
      >
        <div className="flex flex-wrap gap-3">
          <CTA to={navPaths.contact}>{t.ui.book}</CTA>
          <CTA to={navPaths.calculator} variant="outline">
            {t.hero.ctaSecondary}
          </CTA>
        </div>
      </PageHero>

      <section className="container-x pb-20 md:pb-28">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-white/10">
              <img
                src={images.about}
                alt={t.hero.portraitName}
                className="aspect-[4/5] w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-6 end-6 rounded-2xl border border-lemon/30 bg-ink/90 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <BadgeCheck className="size-8 text-lemon" aria-hidden />
                <div>
                  <p className="font-display text-sm font-bold text-cream">
                    {lang === "ar" ? "متابعة شخصية" : "Personal coaching"}
                  </p>
                  <p className="text-[11px] text-cream/50">
                    {lang === "ar" ? "مش فريق خدمة عملاء" : "Not a call centre"}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <div>
            <SectionHeading kicker={t.about.intro.kicker} title={t.about.storyTitle} />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-cream/60">
              {t.about.story.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <Quote className="size-7 text-lemon" aria-hidden />
              <p className="mt-3 font-display text-lg leading-relaxed text-cream/85">{t.about.quote}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-ink-2/60 py-20 md:py-28">
        <div className="container-x">
          <SectionHeading kicker={t.about.valuesTitle} title={t.home.pillarsTitle} align="center" className="mx-auto max-w-2xl" />
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.about.values.map((value, index) => (
              <StaggerItem key={value.title} className="h-full">
                <div className="h-full rounded-3xl border border-white/10 bg-ink p-6 transition-colors hover:border-lemon/30">
                  <span className="font-latin text-3xl text-lemon/50">0{index + 1}</span>
                  <h3 className="mt-4 text-lg">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/55">{value.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <SectionHeading kicker={t.nav.about} title={t.about.credsTitle} />
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="overflow-hidden rounded-[2rem] border border-white/10">
            <img src={images.gym} alt="" className="h-full min-h-64 w-full object-cover" loading="lazy" />
          </Reveal>
          <div className="relative">
            <span className="absolute inset-y-2 start-[3.1rem] w-px bg-white/10" aria-hidden />
            <ul className="space-y-8">
              {t.about.creds.map((cred, index) => (
                <Reveal key={cred.title} delay={index * 0.06}>
                  <li className="relative flex gap-6">
                    <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-lemon/40 bg-ink text-[10px] font-bold text-lemon">
                      {index + 1}
                    </span>
                    <div className="pb-1">
                      <p className="font-latin text-sm text-lemon">{cred.year}</p>
                      <p className="mt-1 font-display text-base font-semibold text-cream">{cred.title}</p>
                      <p className="mt-0.5 text-sm text-cream/45">{cred.place}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container-x pb-20 md:pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 md:p-12">
            <div className="max-w-2xl">
              <h2 className="text-3xl leading-tight md:text-4xl">{t.about.ctaTitle}</h2>
              <p className="mt-4 text-sm leading-relaxed text-cream/60 md:text-base">{t.about.ctaText}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <CTA to={navPaths.contact}>{t.ui.book}</CTA>
                <CTA to={navPaths.programs} variant="outline">
                  {t.nav.programs}
                </CTA>
              </div>
            </div>
          </div>
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
