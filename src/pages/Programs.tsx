import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarRange,
  Check,
  Dumbbell,
  Minus,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { FaqAccordion } from "../components/ui/FaqAccordion";
import { PageHero } from "../components/ui/PageHero";
import { ProgramCard } from "../components/ui/ProgramCard";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { useLang } from "../lib/i18n";
import { cn } from "../lib/utils";

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
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const [selectedId, setSelectedId] = useState("");
  const active =
    t.programs.find((program) => (program.contentId ?? program.id) === selectedId) ??
    t.programs.find((program) => program.popular) ??
    t.programs[0];
  const system = active?.system;

  const statRows = [
    {
      label: t.programsPage.weeks,
      values: t.programs.map((program) => String(program.system.weeks.length)),
    },
    {
      label: t.programsPage.workouts,
      values: t.programs.map((program) => String(program.system.workouts.length)),
    },
    {
      label: t.programsPage.meals,
      values: t.programs.map((program) => String(program.system.meals.length)),
    },
    {
      label: t.programsPage.checkInEvery,
      values: t.programs.map((program) =>
        ar ? `${program.system.checkInEveryDays} يوم` : `${program.system.checkInEveryDays} days`
      ),
    },
    {
      label: t.programsPage.level,
      values: t.programs.map((program) => program.system.level || "—"),
    },
  ];

  const featureRows: { label: string; values: string[]; owner: number }[] = [];
  for (const [ownerIndex, program] of t.programs.entries()) {
    for (const feature of program.features) {
      if (featureRows.some((row) => row.label === feature)) continue;
      featureRows.push({
        label: feature,
        values: t.programs.map((entry) => (entry.features.includes(feature) ? "✓" : "—")),
        owner: ownerIndex,
      });
    }
  }

  // A higher tier that says "everything in …" inherits the lower tier's rows.
  const inheritsAll = (features: string[]) => features.some((feature) => /كل اللي في|everything in/i.test(feature));
  for (const row of featureRows) {
    row.values = t.programs.map((program, index) =>
      row.values[index] === "✓" || (index > row.owner && inheritsAll(program.features)) ? "✓" : "—"
    );
  }

  const compareRows = [...statRows, ...featureRows];
  const sampleWeek = system?.weeks[0];

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
                weeksLabel={t.programsPage.weeks}
                workoutsLabel={t.programsPage.workouts}
                mealsLabel={t.programsPage.meals}
                daysLabel={ar ? "يوم" : "days"}
              />
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-cream/40">{t.programsPage.note}</p>
      </section>

      {active && system && system.weeks.length > 0 && (
        <section className="border-y border-white/10 bg-ink-2/55 py-20 md:py-24">
          <div className="container-x">
            <SectionHeading
              kicker={t.programsPage.kicker}
              title={t.programsPage.inside}
              sub={t.programsPage.insideSub}
            />

            <div className="mt-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {t.programs.map((program) => {
                const id = program.contentId ?? program.id;
                const isActive = program === active;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-[11px] font-bold transition-colors",
                      isActive
                        ? "border-lemon bg-lemon text-ink"
                        : "border-white/12 bg-white/[0.03] text-cream/55 hover:border-lemon/40 hover:text-cream"
                    )}
                  >
                    {program.name}
                  </button>
                );
              })}
            </div>

            <Reveal key={active.id} className="mt-4">
              <div className="panel-premium overflow-hidden rounded-[2rem]">
                <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
                  <div className="p-6 md:p-9">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-lemon/25 bg-lemon/10 px-3 py-1 text-[10px] font-bold text-lemon">
                        {system.level || (ar ? "كل المستويات" : "All levels")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-[10px] text-cream/55">
                        <CalendarCheck2 className="size-3 text-lemon/80" aria-hidden />
                        {t.programsPage.checkInEvery} {system.checkInEveryDays} {ar ? "يوم" : "days"}
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-3xl font-black md:text-4xl">{active.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-cream/60 md:text-base">
                      {system.summary || active.tagline}
                    </p>

                    <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-cream/35">
                      {ar ? "النتائج المتوقعة" : "What you'll achieve"}
                    </p>
                    <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {system.outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-2 text-xs leading-relaxed text-cream/65">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-lemon" aria-hidden />
                          {outcome}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 rounded-2xl border border-lemon/15 bg-lemon/[0.04] p-4">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold text-lemon">
                        <Sparkles className="size-3.5" aria-hidden />
                        {t.programsPage.sampleWeek}
                      </p>
                      <p className="mt-2 font-display text-sm font-bold text-cream">
                        {sampleWeek?.title} — {sampleWeek?.focus}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-cream/50">
                        {sampleWeek?.nutrition}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 bg-ink/25 p-6 md:p-8 lg:border-s lg:border-t-0">
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { icon: CalendarRange, label: t.programsPage.weeks, value: system.weeks.length },
                        { icon: Dumbbell, label: t.programsPage.workouts, value: system.workouts.length },
                        { icon: UtensilsCrossed, label: t.programsPage.meals, value: system.meals.length },
                        {
                          icon: CalendarCheck2,
                          label: t.programsPage.checkInEvery,
                          value: `${system.checkInEveryDays} ${ar ? "يوم" : "d"}`,
                        },
                      ].map((stat) => {
                        const Icon = stat.icon;
                        return (
                          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <Icon className="size-4 text-lemon/80" aria-hidden />
                            <p className="mt-2.5 font-latin text-2xl leading-none text-cream">{stat.value}</p>
                            <p className="mt-1 text-[9px] text-cream/35">{stat.label}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {system.startSteps.slice(0, 3).map((step, index) => (
                        <div key={step} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-lemon/10 font-latin text-[8px] text-lemon">
                            {index + 1}
                          </span>
                          <p className="text-[10px] leading-relaxed text-cream/50">{step}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-latin text-4xl leading-none text-lemon">{active.price}</p>
                        <p className="mt-1 text-[10px] text-cream/40">
                          {t.programsPage.currency} {t.programsPage.perMonth}
                        </p>
                      </div>
                      <Link
                        to={`/subscribe/${active.contentId ?? active.id}`}
                        className="shine inline-flex items-center gap-1.5 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink transition-transform hover:-translate-y-0.5"
                      >
                        {t.programsPage.cta}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </Link>
                    </div>

                    <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-cream/35">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lemon/60" aria-hidden />
                      {t.programsPage.fullPlanNote}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="container-x py-20 md:py-24">
        <SectionHeading kicker={t.programsPage.compareTitle} title={t.programsPage.compareTitle} />
        <Reveal className="mt-8 overflow-x-auto rounded-[1.6rem] border border-white/10">
          <table className="w-full min-w-[680px] border-collapse text-start">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="px-5 py-4 text-start text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/40">
                  {t.programsPage.includes}
                </th>
                {t.programs.map((program) => (
                  <th key={program.id} className="px-4 py-4 text-center font-display text-sm font-semibold text-cream">
                    {program.name}
                    {program.popular && (
                      <span className="ms-2 rounded-full bg-lemon px-2 py-0.5 text-[9px] font-bold text-ink">★</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, rowIndex) => (
                <tr key={row.label} className={rowIndex % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}>
                  <td className="px-5 py-3.5 text-xs text-cream/65">{row.label}</td>
                  {row.values.map((value, valueIndex) => (
                    <td key={`${row.label}-${valueIndex}`} className="px-4 py-3.5 text-center">
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
