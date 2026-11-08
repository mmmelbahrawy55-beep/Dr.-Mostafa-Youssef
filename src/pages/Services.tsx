import { Check } from "lucide-react";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { PageHero } from "../components/ui/PageHero";
import { Reveal } from "../components/ui/Reveal";
import { useLang } from "../lib/i18n";
import { whatsappLink } from "../lib/site";
import { cn } from "../lib/utils";

export default function Services() {
  const { t, lang } = useLang();

  return (
    <>
      <PageHero kicker={t.servicesPage.kicker} title={t.servicesPage.title} lead={t.servicesPage.lead}>
        <CTA href={whatsappLink(t.servicesPage.note)} target="_blank" rel="noreferrer">
          {t.servicesPage.cta}
        </CTA>
      </PageHero>

      <section className="container-x pb-16 md:pb-24">
        <div className="space-y-16 md:space-y-24">
          {t.services.map((service, index) => {
            const flipped = index % 2 === 1;
            return (
              <Reveal key={service.title}>
                <article className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                  <div className={cn("relative", flipped && "lg:order-2")}>
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/10">
                      <img
                        src={service.image}
                        alt={service.title}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" aria-hidden />
                      <span className="absolute bottom-4 start-4 rounded-full bg-ink/80 px-3 py-1.5 text-[11px] font-semibold text-lemon backdrop-blur">
                        0{index + 1} — {service.tag}
                      </span>
                    </div>
                  </div>

                  <div className={cn(flipped && "lg:order-1")}>
                    <h2 className="text-2xl leading-tight md:text-4xl">{service.title}</h2>
                    <p className="mt-4 text-sm leading-relaxed text-cream/60 md:text-base">{service.desc}</p>
                    <ul className="mt-6 space-y-3">
                      {service.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-sm text-cream/75">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-lemon/15 text-lemon">
                            <Check className="size-3" aria-hidden />
                          </span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                    <CTA
                      href={whatsappLink(
                        lang === "ar" ? `عايز أستشير في خدمة «${service.title}».` : `I'd like advice about "${service.title}".`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      variant="outline"
                      className="mt-7"
                    >
                      {t.servicesPage.cta}
                    </CTA>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-16">
          <div className="rounded-3xl border border-lemon/25 bg-lemon/[0.06] p-6 md:p-8">
            <p className="text-sm leading-relaxed text-cream/70 md:text-base">{t.servicesPage.note}</p>
            <CTA
              href={whatsappLink(lang === "ar" ? "عايز أعرف أبدأ منين." : "I'd like to know where to start.")}
              target="_blank"
              rel="noreferrer"
              className="mt-5"
              size="sm"
            >
              {t.ui.whatsapp}
            </CTA>
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
