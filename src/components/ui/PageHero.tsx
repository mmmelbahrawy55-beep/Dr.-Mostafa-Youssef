import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageHeroProps {
  kicker: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHero({ kicker, title, lead, children, className }: PageHeroProps) {
  return (
    <section className={cn("relative overflow-hidden pb-14 pt-32 md:pb-20 md:pt-40", className)}>
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[380px] w-[640px] -translate-x-1/2 rounded-full bg-lemon/10 blur-[130px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden
      />
      <div className="pointer-events-none absolute end-7 top-1/2 hidden -translate-y-1/2 items-center gap-3 [writing-mode:vertical-rl] lg:flex">
        <span className="font-latin text-[9px] uppercase tracking-[0.32em] text-cream/20">Est. 2018</span>
        <span className="h-16 w-px bg-white/12" aria-hidden />
        <span className="font-latin text-[9px] uppercase tracking-[0.32em] text-lemon/35">Zagazig · EG</span>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lemon/25 to-transparent"
        aria-hidden
      />
      <div className="container-x relative">
        <div className="eyebrow">
          <span className="h-px w-8 bg-lemon/70" aria-hidden />
          {kicker}
        </div>
        <h1 className="display-xl mt-5 max-w-4xl text-[2.5rem] leading-[1.05] sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        {lead && <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream/60 md:text-lg">{lead}</p>}
        {children && <div className="mt-9">{children}</div>}
      </div>
    </section>
  );
}
