import { ArrowUpRight, MessageCircle } from "lucide-react";
import { useLang } from "../../lib/i18n";
import { site, whatsappLink } from "../../lib/site";
import { CTA } from "./CTA";
import { Reveal } from "./Reveal";

interface CtaBandProps {
  kicker: string;
  title: string;
  text: string;
  primary: string;
  secondary: string;
}

export function CtaBand({ kicker, title, text, primary, secondary }: CtaBandProps) {
  const { lang } = useLang();

  return (
    <section className="container-x pb-20 md:pb-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-lemon px-6 py-12 text-ink md:px-14 md:py-16">
          <div
            className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full border-[40px] border-ink/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-28 -start-16 size-64 rounded-full border-[30px] border-ink/[0.07]"
            aria-hidden
          />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink/50">{kicker}</p>
              <h2 className="mt-4 text-3xl leading-[1.1] text-ink md:text-5xl">{title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink/70 md:text-base">{text}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0 lg:flex-col xl:flex-row">
              <CTA to="/contact" variant="dark" size="lg" icon={false}>
                <span className="flex items-center gap-2">
                  {primary}
                  <ArrowUpRight className="size-4" aria-hidden />
                </span>
              </CTA>
              <CTA
                href={whatsappLink(lang === "ar" ? "السلام عليكم، عايز أبدأ استشارة." : "Hi, I'd like to book a consultation.")}
                target="_blank"
                rel="noreferrer"
                variant="light"
                size="lg"
                icon={false}
              >
                <span className="flex items-center gap-2">
                  <MessageCircle className="size-4" aria-hidden />
                  {secondary}
                </span>
              </CTA>
            </div>
          </div>
          <div className="relative mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-ink/15 pt-6 text-xs font-semibold text-ink/60">
            <span dir="ltr">{site.phoneDisplay}</span>
            <span>{site.email}</span>
            <span>{lang === "ar" ? site.address.ar : site.address.en}</span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
