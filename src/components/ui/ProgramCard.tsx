import { ArrowUpRight, CalendarRange, Check, Dumbbell, Sparkles, UtensilsCrossed } from "lucide-react";
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
  weeksLabel: string;
  workoutsLabel: string;
  mealsLabel: string;
  daysLabel: string;
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
  weeksLabel,
  workoutsLabel,
  mealsLabel,
  daysLabel,
  className,
}: ProgramCardProps) {
  const system = program.system;
  const stats = [
    { icon: CalendarRange, label: weeksLabel, value: String(system.weeks.length) },
    { icon: Dumbbell, label: workoutsLabel, value: String(system.workouts.length) },
    { icon: UtensilsCrossed, label: mealsLabel, value: String(system.meals.length) },
  ];

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[2rem] border transition-all duration-500 hover:-translate-y-1.5",
        program.popular
          ? "border-lemon/45 bg-gradient-to-b from-lemon/[0.09] via-ink-2 to-ink-2 shadow-[0_35px_90px_-50px_rgba(212,255,63,0.55)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:shadow-[0_35px_90px_-60px_rgba(0,0,0,0.9)]",
        className
      )}
    >
      {program.popular && (
        <span className="pointer-events-none absolute inset-x-12 top-0 z-20 h-px bg-gradient-to-r from-transparent via-lemon to-transparent" aria-hidden />
      )}

      <div className="relative">
        <Photo
          src={program.image || images.gym}
          alt={program.name}
          aspect="aspect-[16/10]"
          className="transition-transform duration-700 group-hover:scale-[1.05]"
          overlay
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" aria-hidden />

        <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-2">
          <span className="rounded-full border border-white/15 bg-ink/55 px-3 py-1 text-[10px] font-semibold text-cream/75 backdrop-blur-md">
            {program.days ?? 30} {daysLabel}
          </span>
          {program.popular ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-lemon px-3 py-1 text-[10px] font-bold text-ink shadow-lg">
              <Sparkles className="size-3" aria-hidden />
              {popularLabel}
            </span>
          ) : (
            <span className="rounded-full border border-white/12 bg-ink/40 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-cream/50 backdrop-blur-md">
              {system.level}
            </span>
          )}
        </div>

        <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3">
          <div className="flex items-end gap-1.5">
            <span className="font-latin text-4xl leading-none text-lemon drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] md:text-5xl">
              {program.price}
            </span>
            <span className="pb-1 text-[11px] text-cream/60">{currency}</span>
          </div>
          <span className="pb-1 text-[10px] text-cream/45">{perMonth}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-7">
        <h3 className="text-xl md:text-2xl">{program.name}</h3>
        <p className="mt-2 min-h-[2.6rem] text-sm leading-relaxed text-cream/55">{program.tagline}</p>

        {system.weeks.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl border border-white/8 bg-white/[0.025] p-1.5">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl px-2 py-2.5 text-center">
                  <Icon className="mx-auto size-3.5 text-lemon/80" aria-hidden />
                  <p className="mt-1.5 font-latin text-base leading-none text-cream">{stat.value}</p>
                  <p className="mt-1 text-[8px] leading-tight text-cream/35">{stat.label}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="my-5 h-px bg-white/10" />

        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/35">{includesLabel}</p>
        <ul className="mt-3.5 flex flex-1 flex-col gap-2.5">
          {program.features.slice(0, 6).map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug text-cream/75">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-lemon/12 text-lemon">
                <Check className="size-2.5" aria-hidden />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {program.note && <p className="mt-4 text-[11px] leading-relaxed text-cream/35">{program.note}</p>}

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
