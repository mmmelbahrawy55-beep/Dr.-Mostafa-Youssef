import { CalendarRange, Plus, Trash2 } from "lucide-react";
import type { ProgramSystem } from "../../content/types";
import { ensureProgramSystem } from "../../lib/program-system";
import { cn } from "../../lib/utils";

const inputClass = "field py-2 text-xs";
const areaClass = "field min-h-16 resize-y text-xs leading-relaxed";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-semibold text-cream/45">{label}</span>
      {children}
    </label>
  );
}

function LinesField({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        className={cn(areaClass, "min-h-20")}
        value={values.join("\n")}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.split("\n").filter((line) => line.trim()))}
      />
    </Field>
  );
}

export function ProgramSystemEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: ProgramSystem) => void;
}) {
  const system = ensureProgramSystem(value);
  const patch = (partial: Partial<ProgramSystem>) => onChange({ ...system, ...partial });

  const addWeek = () =>
    patch({
      weeks: [
        ...system.weeks,
        { title: "", focus: "", nutrition: "", training: "", habits: [], checkIn: "" },
      ],
    });

  const addMeal = () => patch({ meals: [...system.meals, { meal: "", idea: "" }] });
  const addWorkout = () => patch({ workouts: [...system.workouts, { day: "", focus: "", exercises: [] }] });

  return (
    <div className="space-y-3 rounded-xl border border-lemon/15 bg-lemon/[0.025] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-lemon">
          <CalendarRange className="size-3.5" aria-hidden />
          نظام البرنامج
        </p>
        <span className="text-[9px] text-cream/30">
          {system.weeks.length} أسبوع · {system.workouts.length} تمرين · {system.meals.length} وجبة
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_110px_120px]">
        <Field label="ملخص البرنامج">
          <textarea
            className={cn(areaClass, "min-h-16")}
            value={system.summary}
            onChange={(event) => patch({ summary: event.target.value })}
          />
        </Field>
        <Field label="المستوى">
          <input
            className={inputClass}
            value={system.level}
            placeholder="مبتدئ"
            onChange={(event) => patch({ level: event.target.value })}
          />
        </Field>
        <Field label="متابعة كل (يوم)">
          <input
            type="number"
            min={1}
            max={90}
            className={inputClass}
            value={system.checkInEveryDays}
            onChange={(event) => patch({ checkInEveryDays: Number(event.target.value) })}
          />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <LinesField
          label="النتائج المتوقعة"
          values={system.outcomes}
          placeholder="سطر لكل نتيجة"
          onChange={(outcomes) => patch({ outcomes })}
        />
        <LinesField
          label="خطوات البداية"
          values={system.startSteps}
          placeholder="سطر لكل خطوة"
          onChange={(startSteps) => patch({ startSteps })}
        />
        <LinesField
          label="قواعد وملاحظات"
          values={system.guidelines}
          placeholder="سطر لكل ملاحظة"
          onChange={(guidelines) => patch({ guidelines })}
        />
      </div>

      <div className="rounded-lg border border-white/8 bg-ink/30 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold text-cream/55">خطة الأسابيع</p>
          <button
            type="button"
            onClick={addWeek}
            className="inline-flex items-center gap-1 rounded-full border border-lemon/25 bg-lemon/5 px-2.5 py-1 text-[9px] font-bold text-lemon"
          >
            <Plus className="size-3" aria-hidden /> أسبوع
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {system.weeks.length === 0 && (
            <p className="py-3 text-center text-[10px] text-cream/25">مفيش أسابيع — أضف أول أسبوع.</p>
          )}
          {system.weeks.map((week, index) => (
            <div key={index} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-lemon/70">الأسبوع {index + 1}</span>
                <button
                  type="button"
                  onClick={() => patch({ weeks: system.weeks.filter((_, current) => current !== index) })}
                  className="rounded-md p-1 text-cream/30 hover:bg-red-500/10 hover:text-red-200"
                  aria-label={`حذف الأسبوع ${index + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="عنوان الأسبوع">
                  <input
                    className={inputClass}
                    value={week.title}
                    onChange={(event) =>
                      patch({
                        weeks: system.weeks.map((entry, current) =>
                          current === index ? { ...entry, title: event.target.value } : entry
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="التركيز">
                  <input
                    className={inputClass}
                    value={week.focus}
                    onChange={(event) =>
                      patch({
                        weeks: system.weeks.map((entry, current) =>
                          current === index ? { ...entry, focus: event.target.value } : entry
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="التغذية">
                  <textarea
                    className={areaClass}
                    value={week.nutrition}
                    onChange={(event) =>
                      patch({
                        weeks: system.weeks.map((entry, current) =>
                          current === index ? { ...entry, nutrition: event.target.value } : entry
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="التدريب">
                  <textarea
                    className={areaClass}
                    value={week.training}
                    onChange={(event) =>
                      patch({
                        weeks: system.weeks.map((entry, current) =>
                          current === index ? { ...entry, training: event.target.value } : entry
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="عادات الأسبوع">
                  <textarea
                    className={areaClass}
                    value={week.habits.join("\n")}
                    placeholder="سطر لكل عادة"
                    onChange={(event) =>
                      patch({
                        weeks: system.weeks.map((entry, current) =>
                          current === index
                            ? {
                                ...entry,
                                habits: event.target.value.split("\n").filter((line) => line.trim()),
                              }
                            : entry
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="متابعة نهاية الأسبوع">
                  <textarea
                    className={areaClass}
                    value={week.checkIn}
                    onChange={(event) =>
                      patch({
                        weeks: system.weeks.map((entry, current) =>
                          current === index ? { ...entry, checkIn: event.target.value } : entry
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-lg border border-white/8 bg-ink/30 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-cream/55">قالب الوجبات</p>
            <button
              type="button"
              onClick={addMeal}
              className="inline-flex items-center gap-1 rounded-full border border-lemon/25 bg-lemon/5 px-2.5 py-1 text-[9px] font-bold text-lemon"
            >
              <Plus className="size-3" aria-hidden /> وجبة
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {system.meals.map((meal, index) => (
              <div key={index} className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    className={cn(inputClass, "py-1.5 text-[11px]")}
                    value={meal.meal}
                    placeholder="اسم الوجبة"
                    onChange={(event) =>
                      patch({
                        meals: system.meals.map((entry, current) =>
                          current === index ? { ...entry, meal: event.target.value } : entry
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => patch({ meals: system.meals.filter((_, current) => current !== index) })}
                    className="shrink-0 rounded-md p-1.5 text-cream/30 hover:bg-red-500/10 hover:text-red-200"
                    aria-label="حذف الوجبة"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <textarea
                  className={cn(areaClass, "mt-1.5 min-h-14 text-[11px]")}
                  value={meal.idea}
                  placeholder="مثال: بروتين + رز + سلطة"
                  onChange={(event) =>
                    patch({
                      meals: system.meals.map((entry, current) =>
                        current === index ? { ...entry, idea: event.target.value } : entry
                      ),
                    })
                  }
                />
              </div>
            ))}
            {system.meals.length === 0 && <p className="py-2 text-center text-[10px] text-cream/25">أضف وجبة.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-ink/30 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-cream/55">تقسيم التدريب</p>
            <button
              type="button"
              onClick={addWorkout}
              className="inline-flex items-center gap-1 rounded-full border border-lemon/25 bg-lemon/5 px-2.5 py-1 text-[9px] font-bold text-lemon"
            >
              <Plus className="size-3" aria-hidden /> حصة
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {system.workouts.map((workout, index) => (
              <div key={index} className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    className={cn(inputClass, "py-1.5 text-[11px]")}
                    value={workout.day}
                    placeholder="اليوم ١"
                    onChange={(event) =>
                      patch({
                        workouts: system.workouts.map((entry, current) =>
                          current === index ? { ...entry, day: event.target.value } : entry
                        ),
                      })
                    }
                  />
                  <input
                    className={cn(inputClass, "py-1.5 text-[11px]")}
                    value={workout.focus}
                    placeholder="صدر + كتف"
                    onChange={(event) =>
                      patch({
                        workouts: system.workouts.map((entry, current) =>
                          current === index ? { ...entry, focus: event.target.value } : entry
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => patch({ workouts: system.workouts.filter((_, current) => current !== index) })}
                    className="shrink-0 rounded-md p-1.5 text-cream/30 hover:bg-red-500/10 hover:text-red-200"
                    aria-label="حذف الحصة"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <textarea
                  className={cn(areaClass, "mt-1.5 min-h-14 text-[11px]")}
                  value={workout.exercises.join("\n")}
                  placeholder="تمرين في كل سطر"
                  onChange={(event) =>
                    patch({
                      workouts: system.workouts.map((entry, current) =>
                        current === index
                          ? {
                              ...entry,
                              exercises: event.target.value.split("\n").filter((line) => line.trim()),
                            }
                          : entry
                      ),
                    })
                  }
                />
              </div>
            ))}
            {system.workouts.length === 0 && <p className="py-2 text-center text-[10px] text-cream/25">أضف حصة.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
