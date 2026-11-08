import { ArrowDown, Calculator as CalculatorIcon, RotateCcw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { CTA } from "../components/ui/CTA";
import { CtaBand } from "../components/ui/CtaBand";
import { PageHero } from "../components/ui/PageHero";
import { Reveal } from "../components/ui/Reveal";
import type { CalcResult, Gender, Goal } from "../lib/calc";
import { calculate, inRange } from "../lib/calc";
import { useLang } from "../lib/i18n";
import { whatsappLink } from "../lib/site";
import { cn, formatNumber } from "../lib/utils";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-cream/55">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function Calculator() {
  const { t, lang } = useLang();
  const copy = t.calculator;

  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState("30");
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("80");
  const [activity, setActivity] = useState<number>(copy.form.activityLevels[2].value);
  const [goal, setGoal] = useState<Goal>("lose");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ageNum = Number(age);
    const heightNum = Number(height);
    const weightNum = Number(weight);

    if (!inRange(ageNum, 12, 90) || !inRange(heightNum, 120, 230) || !inRange(weightNum, 35, 250)) {
      setError(
        lang === "ar"
          ? "راجع الأرقام: السن ١٢–٩٠، الطول ١٢٠–٢٣٠ سم، الوزن ٣٥–٢٥٠ كجم."
          : "Check your numbers: age 12–90, height 120–230 cm, weight 35–250 kg."
      );
      setResult(null);
      return;
    }

    setError(null);
    setResult(
      calculate({ gender, age: ageNum, height: heightNum, weight: weightNum, activity, goal })
    );
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setGender("male");
    setAge("30");
    setHeight("175");
    setWeight("80");
    setActivity(copy.form.activityLevels[2].value);
    setGoal("lose");
  };

  const buildMessage = () => {
    if (!result) return "";
    const genderLabel = gender === "male" ? copy.form.male : copy.form.female;
    const goalLabel = copy.results.goalNames[goal];
    const bmiLabel = copy.results.bmiLabels[result.bmiKey];

    if (lang === "ar") {
      return [
        "السلام عليكم د. مصطفى 👋",
        "نتيجة حاسبة السعرات:",
        `النوع: ${genderLabel} | السن: ${age} | الطول: ${height} سم | الوزن: ${weight} كجم`,
        `الهدف: ${goalLabel}`,
        `BMI: ${result.bmi} (${bmiLabel})`,
        `احتياجي اليومي: ${result.tdee} سعرة | هدفي: ${result.target} سعرة`,
        `بروتين ${result.protein} جم / كارب ${result.carbs} جم / دهون ${result.fat} جم`,
        `مياه: ${result.water} لتر`,
        "عايز أراجع الخطة معاك.",
      ].join("\n");
    }

    return [
      "Hi Dr. Mostafa 👋",
      "My calorie calculator result:",
      `${genderLabel} | Age: ${age} | Height: ${height} cm | Weight: ${weight} kg`,
      `Goal: ${goalLabel}`,
      `BMI: ${result.bmi} (${bmiLabel})`,
      `Maintenance: ${result.tdee} kcal | Target: ${result.target} kcal`,
      `Protein ${result.protein} g / Carbs ${result.carbs} g / Fat ${result.fat} g`,
      `Water: ${result.water} L`,
      "I'd like to review the plan with you.",
    ].join("\n");
  };

  return (
    <>
      <PageHero kicker={copy.kicker} title={copy.title} lead={copy.lead} />

      <section className="container-x pb-16 md:pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <Reveal>
            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold text-cream/55">{copy.form.gender}</span>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-ink/60 p-1">
                    {[
                      { value: "male" as const, label: copy.form.male },
                      { value: "female" as const, label: copy.form.female },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGender(option.value)}
                        className={cn(
                          "rounded-lg py-2.5 text-sm font-semibold transition-colors",
                          gender === option.value
                            ? "bg-lemon text-ink"
                            : "text-cream/60 hover:text-cream"
                        )}
                        aria-pressed={gender === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Field id="calc-age" label={copy.form.age}>
                  <input
                    id="calc-age"
                    className="field"
                    type="number"
                    inputMode="numeric"
                    min={12}
                    max={90}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    required
                  />
                </Field>

                <Field id="calc-height" label={copy.form.height}>
                  <input
                    id="calc-height"
                    className="field"
                    type="number"
                    inputMode="numeric"
                    min={120}
                    max={230}
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    required
                  />
                </Field>

                <Field id="calc-weight" label={copy.form.weight}>
                  <input
                    id="calc-weight"
                    className="field"
                    type="number"
                    inputMode="numeric"
                    min={35}
                    max={250}
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    required
                  />
                </Field>

                <Field id="calc-activity" label={copy.form.activity}>
                  <select
                    id="calc-activity"
                    className="field"
                    value={activity}
                    onChange={(event) => setActivity(Number(event.target.value))}
                  >
                    {copy.form.activityLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label} — {level.hint}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold text-cream/55">{copy.form.goal}</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {copy.form.goals.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGoal(option.value)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                          goal === option.value
                            ? "border-lemon bg-lemon/15 text-lemon"
                            : "border-white/10 text-cream/55 hover:border-white/25 hover:text-cream"
                        )}
                        aria-pressed={goal === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lemon px-6 py-3.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 sm:flex-none"
                >
                  {copy.form.calc}
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-sm font-semibold text-cream/60 transition-colors hover:text-cream"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  {copy.form.reset}
                </button>
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-cream/35">{copy.results.disclaimer}</p>
            </form>
          </Reveal>

          <Reveal delay={0.1} className="lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-[2rem] border border-lemon/20 bg-gradient-to-b from-lemon/[0.08] to-ink-2 p-6 md:p-8">
              <div className="flex items-center justify-between">
                <span className="eyebrow">{copy.results.headline}</span>
                <CalculatorIcon className="size-5 text-lemon/60" aria-hidden />
              </div>

              {!result ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-lemon/10 text-lemon">
                    <CalculatorIcon className="size-8" aria-hidden />
                  </span>
                  <p className="mt-5 max-w-xs text-sm leading-relaxed text-cream/45">
                    {lang === "ar"
                      ? "املأ بياناتك واضغط «احسب احتياجي» وهتشوف السعرات والماكروز فورًا."
                      : "Fill in your details and hit calculate to see your calories and macros instantly."}
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-xs text-cream/45">{copy.results.target}</p>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="font-latin text-6xl leading-none text-lemon">{formatNumber(result.target)}</span>
                    <span className="pb-2 text-xs text-cream/50">{copy.results.unitKcal}</span>
                  </div>
                  <p className="mt-2 text-xs text-cream/40">
                    {copy.results.goalNames[goal]} · {copy.form.activityLevels.find((level) => level.value === activity)?.label}
                  </p>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-ink/50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-cream/45">{copy.results.bmi}</p>
                      <span className="rounded-full bg-lemon/15 px-2.5 py-1 text-[11px] font-semibold text-lemon">
                        {copy.results.bmiLabels[result.bmiKey]}
                      </span>
                    </div>
                    <p className="mt-2 font-latin text-3xl text-cream">{result.bmi}</p>
                    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span className="w-[18%] bg-sky-400/70" />
                      <span className="w-[32%] bg-lemon" />
                      <span className="w-[22%] bg-amber-400/80" />
                      <span className="w-[28%] bg-red-400/80" />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: copy.results.protein, value: result.protein },
                      { label: copy.results.carbs, value: result.carbs },
                      { label: copy.results.fat, value: result.fat },
                    ].map((macro) => (
                      <div key={macro.label} className="rounded-xl border border-white/10 bg-ink/40 px-2 py-3 text-center">
                        <p className="text-[10px] text-cream/40">{macro.label}</p>
                        <p className="mt-1 font-latin text-xl text-cream">
                          {macro.value}
                          <span className="text-[10px] text-cream/40"> {copy.results.unitG}</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  <dl className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-ink/40 text-xs">
                    {[
                      { label: copy.results.bmr, value: `${formatNumber(result.bmr)} ${copy.results.unitKcal}` },
                      { label: copy.results.tdee, value: `${formatNumber(result.tdee)} ${copy.results.unitKcal}` },
                      { label: copy.results.water, value: `${result.water} ${copy.results.unitL}` },
                      {
                        label: copy.results.ideal,
                        value: `${result.idealMin} – ${result.idealMax} ${copy.results.unitKg}`,
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                        <dt className="text-cream/45">{row.label}</dt>
                        <dd className="font-semibold text-cream/80">{row.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <CTA
                    href={whatsappLink(buildMessage())}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 w-full"
                    icon={false}
                  >
                    {copy.results.send}
                  </CTA>
                  <p className="mt-3 text-[10px] leading-relaxed text-cream/35">{copy.results.disclaimer}</p>
                </div>
              )}
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-10 grid gap-4 sm:grid-cols-3">
          {t.home.calcBullets.map((bullet, index) => (
            <div key={bullet} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <span className="font-latin text-2xl text-lemon/60">0{index + 1}</span>
              <p className="mt-2 text-sm text-cream/60">{bullet}</p>
            </div>
          ))}
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
