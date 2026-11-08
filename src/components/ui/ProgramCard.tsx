import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { Program } from "../../content/types";
import { images } from "../../lib/images";
import { cn } from "../../lib/utils";
import { Photo } from "./Photo";

interface ProgramCardProps {
  program: Program;
  popularLabel: string;
  perMonth: string;
  currency: string;
  includesLabel: string;
  ctaLabel: string;
  ctaTo: string;
  className?: string;
}

export function ProgramCard({
  program,
  popularLabel,
  perMonth,
  currency,
  includesLabel,
  ctaLabel,
  ctaTo,
  className,
}: ProgramCardProps) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border transition-all duration-500 hover:-translate-y-1",
        program.popular
          ? "border-lemon/50 bg-gradient-to-b from-lemon/[0.1] via-ink-2 to-ink-2 shadow-[0_30px_80px_-40px_rgba(212,255,63,0.5)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/25",
        className
      )}
    >
      <div className="relative">
        <Photo
          src={program.image || images.gym}
          alt={program.name}
          aspect="aspect-[16/10]"
          className="transition-transform duration-700 group-hover:scale-[1.04]"
          overlay
        />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
          <span className="rounded-full bg-ink/70 px-3 py-1 text-[10px] font-bold text-cream/80 backdrop-blur">
            {program.days ?? 30} يوم
          </span>
          {program.popular && (
            <span className="rounded-full bg-lemon px-3 py-1 text-[10px] font-bold text-ink shadow-lg">{popularLabel}</span>
          )}
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
          <div className="flex items-end gap-1.5">
            <span className="font-latin text-4xl leading-none text-lemon drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] md:text-5xl">
              {program.price}
            </span>
            <span className="pb-1 text-xs text-cream/70">{currency}</span>
          </div>
          <span className="pb-1 text-[11px] text-cream/50">{perMonth}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-7">
        <h3 className="text-xl md:text-2xl">{program.name}</h3>
        <p className="mt-2 min-h-[2.75rem] text-sm leading-relaxed text-cream/55">{program.tagline}</p>

        <div className="my-5 h-px bg-white/10" />

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/35">{includesLabel}</p>
        <ul className="mt-4 flex flex-1 flex-col gap-2.5">
          {program.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug text-cream/75">
              <Check className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs leading-relaxed text-cream/40">{program.note}</p>
        <Link
          to={ctaTo}
          className={cn(
            "group/cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5",
            program.popular
              ? "shine bg-lemon text-ink hover:shadow-[0_18px_45px_-14px_rgba(212,255,63,0.65)]"
              : "border border-white/20 text-cream hover:border-lemon/70 hover:text-lemon"
          )}
        >
          {ctaLabel}
          <ArrowUpRight className="size-4 transition-transform group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5 rtl:group-hover/cta:-translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
