import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarRange,
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  Target,
  UtensilsCrossed,
} from "lucide-react";
import type { SubscriptionDTO } from "../../../shared/types";
import { images } from "../../lib/images";
import { useLang } from "../../lib/i18n";
import { useSiteInfo } from "../../lib/use-site-info";
import { cn } from "../../lib/utils";
import { Photo } from "../ui/Photo";

interface MyProgramProps {
  subscription: SubscriptionDTO;
  daysLeft: number;
  totalDays: number;
}

export function MyProgram({ subscription, daysLeft, totalDays }: MyProgramProps) {
  const { t, lang } = useLang();
  const info = useSiteInfo();
  const ar = lang === "ar";
  const program = t.programs.find(
    (item) => item.contentId === subscription.programId || item.id === subscription.programId
  );
  const system = program?.system;
  const weeks = system?.weeks ?? [];
  const elapsed = Math.max(0, totalDays - daysLeft);
  const currentWeek = weeks.length
    ? Math.min(weeks.length - 1, Math.max(0, Math.floor(elapsed / 7)))
    : 0;
  const progress = Math.min(100, Math.max(2, Math.round((elapsed / Math.max(1, totalDays)) * 100)));

  const whatsapp = (info.whatsapp ?? "").replace(/\D/g, "");
  const message = ar
    ? `السلام عليكم دكتور مصطفى، عايز أبدأ متابعة برنامج «${program?.name ?? subscription.programName}».`
    : `Hello Dr. Mostafa, I'd like to start my “${program?.name ?? subscription.programName}” check-in.`;
  const contactHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`
    : "/contact";

  if (!program || !system || weeks.length === 0) {
    return (
      <div className="panel p-7 text-center md:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lemon/10 text-lemon">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl">{ar ? "برنامجك بيتجهّز" : "Your program is being prepared"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cream/50">
          {ar
            ? `باقة «${subscription.programName}» نشطة، والنظام التفصيلي بيتجهّز من فريق الدكتور. كلّمنا لو محتاج تبدأ فورًا.`
            : `Your “${subscription.programName}” plan is active. The detailed system is being prepared by the team — contact us if you want to start now.`}
        </p>
        <a
          href={contactHref}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-xs font-bold text-ink"
        >
          <MessageCircle className="size-4" aria-hidden />
          {ar ? "تواصل مع الفريق" : "Contact the team"}
        </a>
      </div>
    );
  }

  return (
    <div className="print-plan space-y-5">
      {/* Hero */}
      <div className="panel relative overflow-hidden">
        <Photo
          src={program.image || images.programTransform}
          alt={program.name}
          wrapperClassName="absolute inset-0"
          className="opacity-25"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40" aria-hidden />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1 text-[10px] font-bold text-lemon">
              <span className="size-1.5 animate-pulse rounded-full bg-lemon" aria-hidden />
              {ar ? "البرنامج شغال" : "Program active"}
            </span>
            <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-cream/60">
              {system.level || (ar ? "كل المستويات" : "All levels")}
            </span>
          </div>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-lemon/80">
            {ar ? "برنامجك الشخصي" : "Your personal program"}
          </p>
          <h2 className="mt-2 font-display text-3xl font-black text-cream md:text-4xl">{program.name}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cream/60">{system.summary || program.tagline}</p>

          <div className="mt-6 max-w-xl">
            <div className="flex items-center justify-between text-[10px] text-cream/45">
              <span>{ar ? "تقدم الباقة" : "Plan progress"}</span>
              <span className="font-latin text-cream/70">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lemon-deep via-lemon to-lemon-soft"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-cream/35">
              {ar
                ? `${elapsed} يوم من ${totalDays} — متبقي ${daysLeft} يوم`
                : `${elapsed} of ${totalDays} days — ${daysLeft} left`}
            </p>
          </div>

          <div className="no-print mt-6 flex flex-wrap gap-2">
            <a
              href={contactHref}
              target={whatsapp ? "_blank" : undefined}
              rel={whatsapp ? "noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-lemon px-4 py-2.5 text-xs font-bold text-ink transition-transform hover:-translate-y-0.5"
            >
              <MessageCircle className="size-4" aria-hidden />
              {ar ? "ابعت متابعتك" : "Send your check-in"}
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 px-4 py-2.5 text-xs font-bold text-cream/75 transition-colors hover:border-lemon/50 hover:text-lemon"
            >
              <Printer className="size-4" aria-hidden />
              {ar ? "طباعة / PDF" : "Print / PDF"}
            </button>
            <a
              href={`/subscribe/${program.contentId ?? program.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 px-4 py-2.5 text-xs font-bold text-cream/75 transition-colors hover:border-lemon/50 hover:text-lemon"
            >
              <Sparkles className="size-4" aria-hidden />
              {ar ? "تجديد الباقة" : "Renew"}
            </a>
          </div>
        </div>
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: CalendarRange, label: t.programsPage.weeks, value: String(weeks.length) },
          { icon: Dumbbell, label: t.programsPage.workouts, value: String(system.workouts.length) },
          { icon: UtensilsCrossed, label: t.programsPage.meals, value: String(system.meals.length) },
          {
            icon: CalendarCheck2,
            label: t.programsPage.checkInEvery,
            value: ar ? `${system.checkInEveryDays} يوم` : `${system.checkInEveryDays} days`,
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="panel-soft p-4">
              <span className="flex size-8 items-center justify-center rounded-xl bg-lemon/10 text-lemon">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="mt-3 font-display text-xl font-bold text-cream">{stat.value}</p>
              <p className="mt-0.5 text-[10px] text-cream/40">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Start + outcomes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5 md:p-6">
          <h3 className="flex items-center gap-2 text-base">
            <Target className="size-4 text-lemon" aria-hidden />
            {ar ? "ابدأ من هنا" : "Start here"}
          </h3>
          <ol className="mt-4 space-y-3">
            {(system.startSteps.length ? system.startSteps : [program.tagline]).map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-lemon/25 bg-lemon/10 font-latin text-[10px] text-lemon">
                  {index + 1}
                </span>
                <p className="text-xs leading-relaxed text-cream/65">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-5 md:p-6">
          <h3 className="flex items-center gap-2 text-base">
            <Flame className="size-4 text-lemon" aria-hidden />
            {ar ? "اللي هتوصله" : "What you'll achieve"}
          </h3>
          <ul className="mt-4 space-y-2.5">
            {system.outcomes.map((outcome) => (
              <li key={outcome} className="flex items-start gap-2.5 text-xs leading-relaxed text-cream/65">
                <Check className="mt-0.5 size-4 shrink-0 text-lemon" aria-hidden />
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Current week */}
      <div className="panel-premium relative overflow-hidden rounded-3xl p-5 md:p-7">
        <div className="pointer-events-none absolute -end-20 -top-20 size-52 rounded-full bg-lemon/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lemon">
              {ar ? "أسبوعك الحالي" : "Your current week"}
            </p>
            <h3 className="mt-1.5 text-xl md:text-2xl">{weeks[currentWeek]?.title}</h3>
          </div>
          <span className="rounded-full border border-lemon/30 bg-lemon/10 px-3 py-1 text-[10px] font-bold text-lemon">
            {ar ? `الأسبوع ${currentWeek + 1} من ${weeks.length}` : `Week ${currentWeek + 1} of ${weeks.length}`}
          </span>
        </div>
        <p className="relative mt-3 text-sm leading-relaxed text-cream/65">{weeks[currentWeek]?.focus}</p>
        <div className="relative mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-ink/35 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-lemon/80">
              <UtensilsCrossed className="size-3.5" aria-hidden />
              {ar ? "التغذية" : "Nutrition"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-cream/60">{weeks[currentWeek]?.nutrition}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink/35 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-lemon/80">
              <Dumbbell className="size-3.5" aria-hidden />
              {ar ? "التدريب" : "Training"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-cream/60">{weeks[currentWeek]?.training}</p>
          </div>
        </div>
        <p className="relative mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-cream/45">
          <CalendarCheck2 className="mt-0.5 size-3.5 shrink-0 text-lemon/70" aria-hidden />
          {weeks[currentWeek]?.checkIn}
        </p>
      </div>

      {/* Weeks */}
      <div className="panel overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-base">{ar ? "خطة الأسابيع كاملة" : "The full weekly plan"}</h3>
          <p className="mt-1 text-[11px] text-cream/40">
            {ar ? "افتح أي أسبوع تشوف تفاصيله — أسبوعك الحالي مفتوح تلقائيًا." : "Open any week for details — your current week is open by default."}
          </p>
        </div>
        <div className="divide-y divide-white/8">
          {weeks.map((week, index) => (
            <details key={`${week.title}-${index}`} open={index === currentWeek} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-xl border font-latin text-xs",
                    index === currentWeek
                      ? "border-lemon/40 bg-lemon text-ink"
                      : "border-white/12 bg-white/[0.03] text-cream/50"
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-cream">{week.title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-cream/40">{week.focus}</p>
                </div>
                <ChevronDown className="size-4 shrink-0 text-cream/30 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="grid gap-3 px-5 pb-5 ps-16 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold text-lemon/75">{ar ? "التغذية" : "Nutrition"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/55">{week.nutrition}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-lemon/75">{ar ? "التدريب" : "Training"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/55">{week.training}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-lemon/75">{ar ? "عادات الأسبوع" : "Weekly habits"}</p>
                  <ul className="mt-1 space-y-1">
                    {week.habits.map((habit) => (
                      <li key={habit} className="flex items-start gap-1.5 text-[11px] text-cream/55">
                        <Check className="mt-0.5 size-3 shrink-0 text-lemon/70" aria-hidden />
                        {habit}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-lemon/75">{ar ? "المتابعة" : "Check-in"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/55">{week.checkIn}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Meals + training */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5 md:p-6">
          <h3 className="flex items-center gap-2 text-base">
            <UtensilsCrossed className="size-4 text-lemon" aria-hidden />
            {ar ? "قالب الوجبات" : "Meal template"}
          </h3>
          <p className="mt-1 text-[10px] text-cream/35">
            {ar ? "أمثلة قابلة للتبديل — الكميات بتتحدد في خطتك." : "Swappable examples — exact portions come from your plan."}
          </p>
          <div className="mt-4 space-y-2">
            {system.meals.map((meal) => (
              <div key={meal.meal} className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                <p className="text-[10px] font-bold text-lemon/80">{meal.meal}</p>
                <p className="mt-1 text-xs leading-relaxed text-cream/60">{meal.idea}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5 md:p-6">
          <h3 className="flex items-center gap-2 text-base">
            <Dumbbell className="size-4 text-lemon" aria-hidden />
            {ar ? "تقسيم التدريب" : "Training split"}
          </h3>
          <p className="mt-1 text-[10px] text-cream/35">
            {ar ? "التمارين الأساسية لكل حصة — التفاصيل بالفيديو في خطة التدريب." : "Main movements per session — video details are in your training plan."}
          </p>
          <div className="mt-4 space-y-2">
            {system.workouts.map((workout) => (
              <div key={`${workout.day}-${workout.focus}`} className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-[10px] font-bold text-lemon/80">{workout.day}</p>
                  <p className="text-[10px] text-cream/45">{workout.focus}</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-cream/55">{workout.exercises.join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guidelines */}
      <div className="panel-soft p-5 md:p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-cream">
          <ShieldCheck className="size-4 text-lemon" aria-hidden />
          {ar ? "قواعد مهمة" : "Important rules"}
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {system.guidelines.map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-[11px] leading-relaxed text-cream/50">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-lemon/60" aria-hidden />
              {rule}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-[10px] leading-relaxed text-cream/35">
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-lemon/60" aria-hidden />
        {ar
          ? "البرنامج ده دليل تنظيمي، وأي تعديل في السعرات أو التمارين بيتم من فريق الدكتور حسب متابعتك. مش بديل عن استشارة طبية."
          : "This program is an organisational guide. Calorie and training changes come from the doctor's team based on your check-ins, and it is not a substitute for medical advice."}
      </p>
    </div>
  );
}
