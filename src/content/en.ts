import { images } from "../lib/images";
import type { Dict } from "./types";

export const en: Dict = {
  nav: {
    home: "Home",
    about: "About",
    services: "Services",
    programs: "Programs",
    results: "Results",
    calculator: "Calculator",
    blog: "Articles",
    contact: "Contact",
  },

  ui: {
    book: "Book a consultation",
    whatsapp: "Message me on WhatsApp",
    call: "Call",
    free: "Free",
    viewAll: "View all",
    bookNow: "Book now",
    scroll: "Scroll",
    languageLabel: "العربية",
    menu: "Menu",
    close: "Close",
  },

  hero: {
    kicker: "Clinical nutrition · Training · Follow-up",
    titleLine1: "Not a diet.",
    titleLine2: "A full transformation.",
    sub: "A nutrition plan built around your labs and body, training designed for your goal, and weekly follow-up on WhatsApp — science, not starvation.",
    ctaPrimary: "Book your consultation",
    ctaSecondary: "Calculate your calories free",
    badges: ["Weekly custom plan", "WhatsApp follow-up", "Labs & supplements"],
    scroll: "Discover more",
    portraitName: "Dr. Mostafa Youssef",
    portraitRole: "Clinical Nutritionist & Fitness Coach",
  },

  stats: [
    { value: 1500, suffix: "+", label: "Clients who hit their goal" },
    { value: 8, suffix: "+", label: "Years of experience" },
    { value: 12, suffix: "K", label: "Kilos of fat lost" },
    { value: 98, suffix: "%", label: "Follow-up & adherence" },
  ],

  marquee: [
    "Clinical nutrition",
    "Fat loss",
    "Muscle building",
    "Personal training",
    "Labs & supplements",
    "Meal plans",
    "Online coaching",
  ],

  home: {
    aboutKicker: "About the doctor",
    aboutTitle: "Science first. Results after.",
    aboutLead:
      "I'm Mostafa Youssef, a clinical nutritionist and fitness coach. My job isn't to get you to lose 5 kilos and regain them — it's to help you understand your body and keep a system you can live with.",
    aboutCta: "More about me",
    pillarsKicker: "How I work",
    pillarsTitle: "Why people stay?",
    pillars: [
      {
        title: "A plan built for you",
        desc: "No templates. Your plan is built around your labs, your schedule, your budget and the food you actually enjoy.",
      },
      {
        title: "Follow-up, not a monthly message",
        desc: "Weekly adjustments, answers to your questions and measurement reviews — follow-up is what makes the difference.",
      },
      {
        title: "Results you can keep",
        desc: "The goal is to teach you a system for life, not a diet you finish and forget.",
      },
    ],
    servicesKicker: "Services",
    servicesTitle: "Everything your body needs, in one place.",
    servicesSub: "From labs and the nutrition plan to training and follow-up — one clear path.",
    servicesCta: "All services",
    programsKicker: "Programs",
    programsTitle: "Pick the plan that matches your goal.",
    programsSub: "No long contracts — month to month, cancel whenever you want.",
    programsCta: "Compare programs",
    calcKicker: "Free tool",
    calcTitle: "Know your calories in 30 seconds.",
    calcText:
      "Enter your height, weight, age and goal, get your daily needs plus your protein, carb and fat split — then send the result to me on WhatsApp so we can review it together.",
    calcCta: "Open the calculator",
    calcBullets: ["Mifflin-St Jeor formula", "Protein based on your weight", "Daily water estimate"],
    resultsKicker: "Results",
    resultsTitle: "People like you… changed course.",
    resultsSub: "Consistent coaching and monthly measurements — not context-free before/after photos.",
    resultsCta: "See all cases",
    testimonialsKicker: "Testimonials",
    testimonialsTitle: "Words from people who did it.",
    faqKicker: "FAQ",
    faqTitle: "Everything you ask about.",
    faqCta: "Read all questions",
  },

  about: {
    intro: {
      kicker: "About the doctor",
      title: "Mostafa Youssef, nutrition and training.",
      lead: "A clinical nutritionist and certified fitness coach working with clients across Egypt and the Gulf, online and in clinic — with one goal: results you can keep.",
    },
    storyTitle: "The story",
    story: [
      "It started with a love of training, but what changed my path was seeing people spend years in the gym without results, and others crash-diet only to regain more than they lost. The problem usually isn't willpower — it's the plan.",
      "So I specialised in clinical nutrition and training together: understand the labs and the medical picture, build a realistic plan around the person's day and budget, and follow up week by week until the result holds.",
      "Today I coach clients across Egypt and the Gulf, online and in clinic, and about 7 in 10 clients stay beyond three months — that's the number I care about most.",
    ],
    valuesTitle: "How I work",
    values: [
      {
        title: "Science before talk",
        desc: "Every decision is based on formulas, assessment and labs — not a social media trend.",
      },
      {
        title: "Realistic before perfect",
        desc: "A plan you follow 90% of the time beats a perfect plan you can't keep.",
      },
      {
        title: "Clarity at every step",
        desc: "You know what you're doing and why, and you review your own numbers week by week.",
      },
      {
        title: "Privacy and respect",
        desc: "Your data and labs stay between us — with zero judgement about your body.",
      },
    ],
    credsTitle: "Specialisation & credentials",
    creds: [
      { year: "2014", title: "BSc in Health Sciences & Nutrition", place: "Cairo University" },
      { year: "2016", title: "Diploma in Clinical Nutrition", place: "Faculty of Medicine" },
      { year: "2018", title: "Certified Personal Trainer", place: "NASM — equivalent" },
      { year: "2021", title: "Sports Nutrition Specialisation", place: "Accredited international program" },
    ],
    quote: "A diet you can't keep is a failure from day one. Choose a plan that fits your life, not the other way around.",
    ctaTitle: "Want to start with your labs and your day?",
    ctaText: "A 30-minute first consultation to understand your case and map out a clear plan.",
  },

  servicesPage: {
    kicker: "Services",
    title: "Services built around your case, not a trend.",
    lead: "Every service starts with a full assessment and labs, and ends with a plan you can actually follow plus real follow-up.",
    note: "Not sure what to pick? Send me your case on WhatsApp and I'll tell you where to start.",
    cta: "Talk to me",
  },

  services: [
    {
      icon: "nutrition",
      tag: "Most sensitive",
      title: "Clinical nutrition",
      desc: "A nutrition plan that works with your medical condition instead of ignoring it — from insulin resistance to cholesterol and digestive issues.",
      bullets: [
        "Full assessment + lab review",
        "Food swaps that fit your day and budget",
        "Plan adjusted with any new medication or lab result",
      ],
      image: images.food,
    },
    {
      icon: "flame",
      tag: "Most requested",
      title: "Fat loss & conditioning",
      desc: "A calculated calorie deficit and smart training so you lose fat while keeping muscle — without crashing or starving.",
      bullets: [
        "Precise calorie and macro targets",
        "Resistance training to protect muscle",
        "Weekly weight and measurement reviews",
      ],
      image: images.gym,
    },
    {
      icon: "muscle",
      tag: "Clear results",
      title: "Muscle building",
      desc: "Protein and carbs where they belong, progressive weekly training, so you gain real muscle — not water.",
      bullets: [
        "Calculated surplus (lean bulk)",
        "Progressive 4–6 day training plan",
        "Measurements and supplement review",
      ],
      image: images.dumbbells,
    },
    {
      icon: "coach",
      tag: "Fully flexible",
      title: "Personal training — online or in gym",
      desc: "A video-based training plan, form correction and follow-up, whether at the gym or at home with minimal equipment.",
      bullets: ["Video guidance for every exercise", "Form checks on WhatsApp", "Home alternatives when equipment is limited"],
      image: images.hero,
    },
    {
      icon: "sport",
      tag: "For athletes",
      title: "Sports nutrition",
      desc: "For athletes and gym players: nutrient timing around training, supplements, and nutrition through Ramadan and competition.",
      bullets: ["Pre and post-workout nutrition", "Ramadan and competition plans", "Safe, evidence-based supplement guide"],
      image: images.protein,
    },
    {
      icon: "lab",
      tag: "Real follow-up",
      title: "Coaching, labs & supplements",
      desc: "Regular lab and measurement reviews, plan adjustments as you go, and safe supplements without the hype.",
      bullets: ["Periodic lab reviews", "Plan adjustment every two weeks", "Supplements chosen on scientific standards"],
      image: images.foodAlt,
    },
  ],

  programsPage: {
    kicker: "Programs & pricing",
    title: "One plan built for you. At a clear price.",
    lead: "No hidden fees, no long contracts. Pick a plan, start with an assessment, then get a real plan and real follow-up.",
    popular: "Most popular",
    perMonth: "/ month",
    currency: "EGP",
    includes: "What's included",
    note: "Prices in Egyptian pounds. Online coaching outside Egypt is the same value; payment via Vodafone Cash, InstaPay or bank transfer.",
    cta: "Start this plan",
    compareTitle: "Quick comparison",
    compareRows: [
      { label: "Monthly nutrition plan", values: ["✓", "✓", "✓"] },
      { label: "Calorie & macro targets", values: ["✓", "✓", "✓"] },
      { label: "Video training plan", values: ["—", "✓", "✓"] },
      { label: "WhatsApp follow-up", values: ["Every 15 days", "Weekly", "Priority reply"] },
      { label: "Plan adjusted to results", values: ["—", "✓", "✓"] },
      { label: "Supplement guide", values: ["—", "✓", "✓"] },
      { label: "InBody composition scan", values: ["—", "—", "✓"] },
      { label: "Two calls per month", values: ["—", "—", "✓"] },
    ],
    faqs: [
      {
        q: "Can I change plans later?",
        a: "Absolutely. Most clients start with Start Right and upgrade to Transformation after a month once we see adherence and results.",
      },
      {
        q: "Are lab tests included?",
        a: "The tests themselves aren't included in the plan price, but I recommend exactly what you need and where to do it, and we review the results together.",
      },
      {
        q: "Is there a guarantee?",
        a: "There's no result guarantee because results depend on your adherence, but my commitment to follow-up and adjustments is full until we reach the goal.",
      },
    ],
  },

  programs: [
    {
      id: "start",
      name: "Start Right",
      price: "1,200",
      tagline: "For getting weight down steadily, without the complexity.",
      features: [
        "Custom monthly nutrition plan",
        "Calorie and macro targets",
        "A wide food-swap list",
        "Follow-up every 15 days",
        "WhatsApp questions group",
      ],
      popular: false,
      note: "Good if your health is stable and you have time to execute the plan yourself.",
    },
    {
      id: "transform",
      name: "Transformation",
      price: "2,200",
      tagline: "Nutrition + training + weekly follow-up — the plan that changes how you look.",
      features: [
        "Everything in Start Right",
        "Weekly video training plan",
        "Weekly weight and measurement review",
        "Plan adjusted to your results",
        "Direct WhatsApp access to me",
        "Safe supplement guide",
      ],
      popular: true,
      note: "Most popular — the best balance of price and results.",
    },
    {
      id: "elite",
      name: "Elite",
      price: "3,500",
      tagline: "Full coaching for maximum results in minimum time.",
      features: [
        "Everything in Transformation",
        "Monthly InBody composition scan",
        "Periodic labs and review",
        "Two video calls per month",
        "Plans for events, travel and Ramadan",
        "All-day priority replies",
      ],
      popular: false,
      note: "Limited capacity: 10 clients per month to protect coaching quality.",
    },
  ],

  resultsPage: {
    kicker: "Results",
    title: "Real transformations, not filters.",
    lead: "Drag the slider to see the difference. Every case has a different timeline and goal — follow-up is what really moves the needle.",
    before: "Before",
    after: "After",
    drag: "Drag",
    statLabel: "Result",
    durationLabel: "Duration",
    demoNote: "Photos shown are placeholders for the demo — they'll be replaced with real client photos after consent.",
    cta: "Want a result like this? Start your consultation",
  },

  results: [
    {
      name: "Mohamed Abdelrahman",
      duration: "7 months",
      stat: "− 24 kg",
      before: images.gymMan,
      after: images.hero,
      summary: "Fat loss while keeping muscle, with better blood pressure and daily energy.",
    },
    {
      name: "Nourhan Samy",
      duration: "5 months",
      stat: "− 16 kg",
      before: images.heroAlt,
      after: images.woman,
      summary: "Postpartum program focused on protein and light resistance training at home.",
    },
    {
      name: "Ahmed Fathy",
      duration: "9 months",
      stat: "+ 9 kg muscle",
      before: images.gym,
      after: images.dumbbells,
      summary: "A clean bulking phase with progressive loading while keeping body fat stable.",
    },
    {
      name: "Sara Ibrahim",
      duration: "6 months",
      stat: "− 12 kg",
      before: images.gymMan,
      after: images.coach,
      summary: "Working with PCOS and insulin resistance, restoring cycle regularity and improving labs.",
    },
  ],

  testimonialSection: {
    kicker: "Testimonials",
    title: "Words from people who did it.",
  },

  testimonials: [
    {
      name: "Mohamed A.",
      role: "Engineer — Cairo",
      quote:
        "First time I've stuck with a program past two months. The weekly check-ins keep you going, and the food is normal — no starvation.",
      rating: 5,
      result: "− 24 kg",
    },
    {
      name: "Sara E.",
      role: "Dentist — Giza",
      quote:
        "I had insulin resistance and PCOS. The plan fit my work, and my labs genuinely improved.",
      rating: 5,
      result: "− 12 kg",
    },
    {
      name: "Ahmed F.",
      role: "Gym athlete — Alexandria",
      quote: "Progressive training done right — no injuries. I gained 9 kg of muscle without adding fat.",
      rating: 5,
      result: "+ 9 kg muscle",
    },
    {
      name: "Nourhan S.",
      role: "Mother of two — Mansoura",
      quote:
        "After pregnancy I felt lost. A home plan with simple equipment and food my family eats made it possible.",
      rating: 5,
      result: "− 16 kg",
    },
    {
      name: "Karim M.",
      role: "Founder — Dubai",
      quote: "Coached online from Dubai, quick replies and constant adjustments. My HbA1c went from 7.2 to 5.6.",
      rating: 5,
      result: "HbA1c 5.6",
    },
  ],

  calculator: {
    kicker: "Free tool",
    title: "Calorie & macro calculator",
    lead: "Numbers are estimates based on the Mifflin-St Jeor equation. Send them to me on WhatsApp and I'll review them with you for free.",
    form: {
      gender: "Gender",
      male: "Male",
      female: "Female",
      age: "Age",
      height: "Height (cm)",
      weight: "Weight (kg)",
      activity: "Activity level",
      goal: "Goal",
      calc: "Calculate my needs",
      reset: "Reset",
      activityLevels: [
        { label: "Sedentary", hint: "Desk job, no training", value: 1.2 },
        { label: "Lightly active", hint: "Training 1–3 days/week", value: 1.375 },
        { label: "Moderately active", hint: "Training 3–5 days", value: 1.55 },
        { label: "Very active", hint: "Training 6–7 days", value: 1.725 },
        { label: "Athlete", hint: "Two sessions per day", value: 1.9 },
      ],
      goals: [
        { label: "Lose fat", value: "lose" },
        { label: "Maintain weight", value: "maintain" },
        { label: "Build muscle", value: "gain" },
      ],
    },
    results: {
      bmi: "Body mass index",
      bmiLabels: { under: "Underweight", normal: "Normal", over: "Overweight", obese: "Obese" },
      bmr: "Basal metabolic rate",
      tdee: "Daily maintenance",
      target: "Your daily target",
      protein: "Protein",
      carbs: "Carbs",
      fat: "Fat",
      water: "Water per day",
      ideal: "Approx. ideal weight",
      send: "Send the result on WhatsApp",
      disclaimer: "Estimates only — not a substitute for a medical consultation or lab tests.",
      unitKcal: "kcal",
      unitG: "g",
      unitKg: "kg",
      unitL: "L",
      headline: "Your result is ready",
      goalNames: { lose: "Fat loss", maintain: "Maintenance", gain: "Muscle building" },
    },
  },

  faq: {
    kicker: "FAQ",
    title: "Everything you ask about.",
    items: [
      {
        q: "Is the program online or in clinic?",
        a: "Both are available. Online runs through WhatsApp and video calls; in Cairo we meet at the clinic. The content and follow-up are identical.",
      },
      {
        q: "Do I need lab tests before we start?",
        a: "Not always, but in many cases we request basic labs (glucose, lipids, vitamin D, thyroid) so the plan is safe and accurate.",
      },
      {
        q: "I have diabetes / hypertension / PCOS — can I start?",
        a: "Yes, and these are exactly the cases where clinical nutrition matters most. We adjust around your medication and labs, and coordinate with your doctor when needed.",
      },
      {
        q: "How soon will I see results?",
        a: "The first change in weight and energy usually shows in 2–4 weeks. Visible shape and measurement changes typically appear after 6–8 weeks of adherence.",
      },
      {
        q: "Will I have to give up my favourite food?",
        a: "No. We fit your favourite food inside your calories and balance the rest. Deprivation is the fastest route to quitting and regaining.",
      },
      {
        q: "What payment methods do you accept?",
        a: "Vodafone Cash, InstaPay or bank transfer. Payment is monthly in advance and renews based on your continuation.",
      },
    ],
  },

  blogPage: {
    kicker: "Articles",
    title: "Advice worth your time.",
    lead: "Short, simple articles on nutrition and training — science-based, away from the trends.",
    minRead: "min read",
    readArticle: "Read article",
    back: "All articles",
    related: "More articles",
    empty: "No articles in this category yet.",
  },

  posts: [
    {
      slug: "why-weight-stalls",
      title: "7 reasons your weight stalls (and how to fix them)",
      excerpt:
        "A plateau doesn't mean the plan failed. There are very common causes, and most have nothing to do with willpower.",
      date: "2026-10-18",
      readTime: "6",
      category: "Fat loss",
      cover: images.gym,
      body: [
        {
          p: "When the scale stops for two weeks, most people's first move is to eat even less. That's usually wrong: metabolism adapts to severe restriction, so the weight holds and fatigue climbs.",
        },
        {
          h: "1. Hidden liquid calories",
          p: "Juices, milky coffee, soft drinks can add 300–600 kcal a day without you noticing. Fix: water and black coffee, and track your drinks for a week.",
        },
        {
          h: "2. Eyeballing portions",
          p: "Research shows people underestimate portion size by around 20%. A kitchen scale isn't overkill — it's the difference between a real plan and a paper one.",
        },
        {
          h: "3. Poor sleep and stress",
          p: "Under 6 hours of sleep raises cortisol and hunger and lowers adherence. Aim for 7–8 hours and cut screens an hour before bed.",
        },
        {
          h: "4. Daily activity, not the workout",
          p: "One hour of training doesn't offset ten hours of sitting. Walking 7–8k steps a day moves the needle more than anything else.",
        },
        {
          p: "Other causes include miscalculated intake, water and weight fluctuations, or medication. If weight is flat for three weeks with full adherence, it's time to review the plan — not cut food further.",
        },
      ],
    },
    {
      slug: "protein-guide",
      title: "Protein: how many grams do you actually need?",
      excerpt:
        "The popular 2 g/kg rule doesn't fit everyone. Here's the scientific range for your goal.",
      date: "2026-09-30",
      readTime: "5",
      category: "Nutrition",
      cover: images.protein,
      body: [
        {
          p: "Protein is the most important macro in a diet — not just for muscle, but for satiety and preserving lean mass while losing weight.",
        },
        {
          h: "The practical range",
          p: "For most people: 1.6–2.2 g per kilo of body weight. Losing fat? Stay at the high end (2–2.2) to protect muscle. Building? 1.6–2 is plenty.",
        },
        {
          h: "Spread it across meals",
          p: "Split it over 3–4 meals at 25–40 g each. Even distribution gives a stronger muscle-building signal than all of it in one meal.",
        },
        {
          h: "Practical sources",
          p: "Chicken, fish, eggs, dairy, lentils, beans, tofu. You don't need supplements unless the rest of your diet falls short.",
        },
        {
          p: "One caveat: if you have kidney disease, check with your doctor before raising protein. For healthy people, these ranges are safe.",
        },
      ],
    },
    {
      slug: "intermittent-fasting",
      title: "Intermittent fasting: is it for you?",
      excerpt:
        "Intermittent fasting isn't magic, and it isn't for everyone. Read this before you try it.",
      date: "2026-09-12",
      readTime: "7",
      category: "Systems",
      cover: images.food,
      body: [
        {
          p: "Intermittent fasting isn't a diet — it's a way to schedule meals. Results come from total calories, and fasting is a tool that helps some people control them.",
        },
        {
          h: "Who benefits?",
          p: "People who don't enjoy breakfast, or who eat a lot at night. Fasting makes calorie reduction easier without precise tracking and improves hunger control for many.",
        },
        {
          h: "Who should avoid it?",
          p: "Pregnant and breastfeeding women, people with diabetes on medication (especially insulin), anyone with a history of disordered eating, and athletes bulking or prepping for competition.",
        },
        {
          h: "The most common protocol: 16/8",
          p: "Fast 16 hours, eat within 8. Start with 12/12 for a week, then 14/10, then 16/8. The key is enough protein in your meals.",
        },
        {
          p: "Bottom line: try it for a month, assess your energy, adherence and gym performance, and continue only if you feel good. If you get headaches, intense hunger or poor performance, go back to a normal schedule.",
        },
      ],
    },
  ],

  contact: {
    intro: {
      kicker: "Contact",
      title: "Let's start here.",
      lead: "Send me your case and goal, and I'll reply as soon as possible with the right starting point.",
    },
    form: {
      name: "Name",
      phone: "Mobile number",
      goal: "Your main goal",
      message: "Tell me about your case (optional)",
      submit: "Send the request on WhatsApp",
      note: "The button opens WhatsApp with your message ready — nothing is stored on this website.",
      goals: ["Fat loss", "Muscle building", "Clinical nutrition", "Personal training", "Online coaching"],
      errors: { name: "Please enter your name.", phone: "Please enter a valid mobile number." },
      success: "Your message is ready in WhatsApp.",
    },
    info: {
      title: "Contact details",
      address: "Address",
      hours: "Working hours",
      phone: "Phone",
      email: "Email",
      follow: "Follow me",
      whatsapp: "Direct WhatsApp",
      call: "Call",
      responseNote: "Replies usually within 2–4 hours during working hours.",
    },
  },

  footer: {
    tagline: "Clinical nutrition and training held to scientific standards… with results you can live with.",
    quickLinks: "Quick links",
    servicesTitle: "Services",
    contactTitle: "Contact",
    rights: "All rights reserved.",
    disclaimer: "Medical content on this site is informational only and is not a substitute for a medical consultation or lab tests.",
    privacy: "Privacy policy",
    terms: "Terms & conditions",
  },

  legal: {
    privacy: {
      title: "Privacy policy",
      updated: "Last updated: November 2026",
      sections: [
        {
          h: "Data we collect",
          p: "This site does not store your data on a server. Forms open WhatsApp directly from your device. If you share health information with us, it is used for your assessment only.",
        },
        {
          h: "How we use your data",
          p: "To choose the right program, build your nutrition and training plan, and follow up. We never sell or share your data with third parties for marketing.",
        },
        {
          h: "Retention",
          p: "We keep data and lab results for the duration of your coaching and delete them at your request at any time.",
        },
        {
          h: "Your rights",
          p: "You may access, correct or delete your data. Email us or message on WhatsApp and we'll act on it.",
        },
      ],
    },
    terms: {
      title: "Terms & conditions",
      updated: "Last updated: November 2026",
      sections: [
        {
          h: "Nature of the service",
          p: "The content and programs shown are educational and advisory, and are not a substitute for diagnosis or medical treatment by a licensed physician.",
        },
        {
          h: "Adherence",
          p: "Results depend on your adherence to the plan and follow-up. No specific result or timeline is guaranteed, and all photos are illustrative.",
        },
        {
          h: "Payment & cancellation",
          p: "Payment is monthly in advance. You may cancel renewal before the next month begins. The current month is non-refundable once coaching has started.",
        },
        {
          h: "Acceptable use",
          p: "Republishing or reselling the content or custom plans is prohibited. Content belongs to the clinic and is for personal use only.",
        },
      ],
    },
  },

  notFound: {
    title: "Page not found.",
    text: "The link seems wrong or the page moved. Let's get you back on track.",
    cta: "Back to home",
  },

  finalCta: {
    kicker: "Your first step",
    title: "Start today, not tomorrow.",
    text: "A 30-minute first consultation to understand your body and goal, and map a clear plan you can start immediately.",
    primary: "Book your consultation",
    secondary: "Message me on WhatsApp",
  },
};
