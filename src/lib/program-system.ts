import type { Lang, ProgramMeal, ProgramSystem, ProgramWeek, ProgramWorkout } from "../content/types";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown) =>
  Array.isArray(value) ? value.map((entry) => text(entry)).filter((entry) => entry.trim().length > 0) : [];

const week = (value: unknown): ProgramWeek => {
  const source = (value ?? {}) as Record<string, unknown>;
  return {
    title: text(source.title),
    focus: text(source.focus),
    nutrition: text(source.nutrition),
    training: text(source.training),
    habits: list(source.habits),
    checkIn: text(source.checkIn),
  };
};

const meal = (value: unknown): ProgramMeal => {
  const source = (value ?? {}) as Record<string, unknown>;
  return { meal: text(source.meal), idea: text(source.idea) };
};

const workout = (value: unknown): ProgramWorkout => {
  const source = (value ?? {}) as Record<string, unknown>;
  return { day: text(source.day), focus: text(source.focus), exercises: list(source.exercises) };
};

export function emptyProgramSystem(): ProgramSystem {
  return {
    summary: "",
    level: "",
    checkInEveryDays: 7,
    outcomes: [],
    startSteps: [],
    weeks: [],
    meals: [],
    workouts: [],
    guidelines: [],
  };
}

/** Accepts whatever the API stored (old items, hand-edited JSON) and returns a safe shape. */
export function ensureProgramSystem(value: unknown): ProgramSystem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyProgramSystem();
  const source = value as Record<string, unknown>;
  const checkIn = Number(source.checkInEveryDays);
  return {
    summary: text(source.summary),
    level: text(source.level),
    checkInEveryDays: Number.isFinite(checkIn) ? Math.min(90, Math.max(1, Math.round(checkIn))) : 7,
    outcomes: list(source.outcomes),
    startSteps: list(source.startSteps),
    weeks: Array.isArray(source.weeks) ? source.weeks.map(week) : [],
    meals: Array.isArray(source.meals) ? source.meals.map(meal) : [],
    workouts: Array.isArray(source.workouts) ? source.workouts.map(workout) : [],
    guidelines: list(source.guidelines),
  };
}

/** Ready-to-edit structure created for every new plan added from the dashboard. */
export function starterProgramSystem(lang: Lang): ProgramSystem {
  if (lang === "en") {
    return {
      summary:
        "A four-week guided block: we set your baseline, build the meal structure and give you a routine you can actually keep.",
      level: "All levels",
      checkInEveryDays: 7,
      outcomes: [
        "A calorie and macro target built around your real day",
        "A flexible meal template with local food options",
        "A weekly training split you can do at home or in the gym",
        "A clear weekly check-in so the plan keeps adapting",
      ],
      startSteps: [
        "Complete your assessment and send current measurements from your account.",
        "Photograph three normal meals during your first three days.",
        "Start with week one only — do not change everything at once.",
        "Send your first weight and measurements before the week ends.",
      ],
      weeks: [
        {
          title: "Week 1 — Baseline",
          focus: "Measure where you are and lock in meal times.",
          nutrition: "Three meals plus an optional snack; protein at every meal.",
          training: "Three light resistance sessions and a daily step target.",
          habits: ["Sleep 7 hours", "2 litres of water", "Log every meal"],
          checkIn: "Weight, measurements and photos at the end of the week.",
        },
        {
          title: "Week 2 — Consistency",
          focus: "Repeat the same structure until it stops feeling new.",
          nutrition: "Keep calories stable and rotate the protein sources.",
          training: "Add one set to each main lift; keep technique clean.",
          habits: ["Prep two meals in advance", "Walk after dinner", "No skipped breakfast"],
          checkIn: "Weekly weight trend and adherence notes.",
        },
        {
          title: "Week 3 — Smart adjustment",
          focus: "Use the data to adjust portions, not willpower.",
          nutrition: "Small carb adjustment around training days.",
          training: "Increase weekly volume by roughly 10%.",
          habits: ["Plan the weekend meals", "Hit fibre target", "Sleep routine"],
          checkIn: "Measurements, energy and hunger score.",
        },
        {
          title: "Week 4 — Review & lock in",
          focus: "Keep what worked and plan the next block.",
          nutrition: "Hold the current intake and build a maintenance day.",
          training: "Deload the last two sessions, then retest.",
          habits: ["Repeat your best week", "Book the next check-in", "Set the next goal"],
          checkIn: "Full comparison and next-block decision.",
        },
      ],
      meals: [
        { meal: "Breakfast", idea: "Eggs or cheese, local bread, vegetables and fruit." },
        { meal: "Lunch", idea: "Lean protein, rice or potatoes, a large salad." },
        { meal: "Dinner", idea: "Grilled protein, cooked vegetables and a small carb portion." },
        { meal: "Snack", idea: "Yoghurt with fruit or a small handful of nuts." },
        { meal: "Pre-workout", idea: "Banana and coffee, or dates with water." },
      ],
      workouts: [
        { day: "Day 1", focus: "Full body", exercises: ["Goblet squat", "Incline push-up", "Band row", "Plank"] },
        { day: "Day 2", focus: "Upper body", exercises: ["Dumbbell press", "Lat pulldown", "Lateral raise", "Curl"] },
        { day: "Day 3", focus: "Lower body", exercises: ["Romanian deadlift", "Split squat", "Calf raise", "Dead bug"] },
        { day: "Day 4", focus: "Active recovery", exercises: ["30-minute walk", "Hip mobility", "Chest stretch"] },
      ],
      guidelines: [
        "Send your check-in on the same day every week.",
        "Do not cut calories on your own — message the team first.",
        "Sleep and steps matter as much as the training sessions.",
        "Any new pain or medication change should be reported immediately.",
      ],
    };
  }

  return {
    summary: "٤ أسابيع تأسيس واضحة: نحدد نقطة البداية، نرتّب وجباتك، ونبني روتين تقدر تكمل عليه.",
    level: "كل المستويات",
    checkInEveryDays: 7,
    outcomes: [
      "هدف سعرات وماكروز مبني على يومك الحقيقي",
      "قالب وجبات مرن بأكل متوفر في بيتك",
      "تقسيم تدريب أسبوعي ينفع في البيت أو الجيم",
      "متابعة أسبوعية واضحة تعدّل الخطة أول بأول",
    ],
    startSteps: [
      "املأ تقييم الحالة وابعت قياساتك الحالية من حسابك.",
      "صوّر ٣ وجبات عادية خلال أول ٣ أيام.",
      "ابدأ بالأسبوع الأول بس — من غير ما تغيّر كل حاجة مرة واحدة.",
      "ابعت أول وزن وقياسات قبل نهاية الأسبوع.",
    ],
    weeks: [
      {
        title: "الأسبوع ١ — نقطة البداية",
        focus: "قياس الحالة وتثبيت مواعيد الأكل.",
        nutrition: "٣ وجبات + سناك اختياري، وبروتين في كل وجبة.",
        training: "٣ حصص مقاومة خفيفة مع هدف خطوات يومي.",
        habits: ["نوم ٧ ساعات", "٢ لتر مياه", "تسجيل كل وجبة"],
        checkIn: "وزن وقياسات وصور في نهاية الأسبوع.",
      },
      {
        title: "الأسبوع ٢ — الاستمرارية",
        focus: "نفس الهيكل يتكرر لحد ما يبقى عادة.",
        nutrition: "تثبيت السعرات مع تنويع مصادر البروتين.",
        training: "زوّد مجموعة واحدة في كل تمرين أساسي.",
        habits: ["حضّر وجبتين مقدمًا", "مشي بعد العشاء", "متفوّتش الفطار"],
        checkIn: "اتجاه الوزن وملاحظات الالتزام.",
      },
      {
        title: "الأسبوع ٣ — تعديل ذكي",
        focus: "نستخدم الأرقام نعدّل الكميات بدل الاعتماد على الإرادة.",
        nutrition: "تعديل بسيط للكارب حوالين أيام التمرين.",
        training: "زيادة حجم التدريب حوالي ١٠٪.",
        habits: ["خطط لوجبات الويكند", "وصّل هدف الألياف", "روتين نوم ثابت"],
        checkIn: "قياسات + طاقة + درجة الجوع.",
      },
      {
        title: "الأسبوع ٤ — مراجعة وتثبيت",
        focus: "نحافظ على اللي نفع ونخطط للمرحلة الجاية.",
        nutrition: "تثبيت السعرات الحالية وبناء يوم صيانة.",
        training: "تخفيف آخر حصتين ثم إعادة اختبار.",
        habits: ["كرر أفضل أسبوع", "احجز المتابعة الجاية", "حدد الهدف القادم"],
        checkIn: "مقارنة كاملة وقرار المرحلة القادمة.",
      },
    ],
    meals: [
      { meal: "الفطار", idea: "بيض أو جبن + خبز بلدي + خضار + فاكهة." },
      { meal: "الغداء", idea: "بروتين قليل الدهن + رز أو بطاطس + سلطة كبيرة." },
      { meal: "العشاء", idea: "بروتين مشوي + خضار مطبوخ + كمية صغيرة نشويات." },
      { meal: "سناك", idea: "زبادي فواكه أو حفنة صغيرة مكسرات." },
      { meal: "قبل التمرين", idea: "موزة وقهوة، أو تمر مع مياه." },
    ],
    workouts: [
      { day: "اليوم ١", focus: "جسم كامل", exercises: ["قرفصاء بالدمبل", "دفع من مستوى عالي", "سحب بمطاط", "بلانك"] },
      { day: "اليوم ٢", focus: "الجزء العلوي", exercises: ["ضغط دمبل", "سحب أمامي", "رفرفة جانبية", "بايسبس"] },
      { day: "اليوم ٣", focus: "الجزء السفلي", exercises: ["رفعة روماني", "طعنات", "سمانة", "Dead bug"] },
      { day: "اليوم ٤", focus: "استشفاء", exercises: ["مشي ٣٠ دقيقة", "موبيلتي hips", "تمدد صدر"] },
    ],
    guidelines: [
      "ابعت متابعتك في نفس اليوم كل أسبوع.",
      "متنزّلش السعرات لوحدك — كلّم الفريق الأول.",
      "النوم والخطوات مهمين زي التمرين بالظبط.",
      "أي ألم جديد أو تغيير في الدوا لازم يتبلّغ فورًا.",
    ],
  };
}
