export type Lang = "ar" | "en";

export type IconKey = "nutrition" | "flame" | "muscle" | "coach" | "sport" | "lab";

export interface PageIntro {
  kicker: string;
  title: string;
  lead: string;
}

export interface Hero {
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  sub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  badges: string[];
  scroll: string;
  portraitName: string;
  portraitRole: string;
}

export interface Stat {
  value: number;
  suffix: string;
  label: string;
}

export interface Pillar {
  title: string;
  desc: string;
}

export interface Home {
  aboutKicker: string;
  aboutTitle: string;
  aboutLead: string;
  aboutCta: string;
  pillarsKicker: string;
  pillarsTitle: string;
  pillars: Pillar[];
  servicesKicker: string;
  servicesTitle: string;
  servicesSub: string;
  servicesCta: string;
  programsKicker: string;
  programsTitle: string;
  programsSub: string;
  programsCta: string;
  calcKicker: string;
  calcTitle: string;
  calcText: string;
  calcCta: string;
  calcBullets: string[];
  resultsKicker: string;
  resultsTitle: string;
  resultsSub: string;
  resultsCta: string;
  testimonialsKicker: string;
  testimonialsTitle: string;
  faqKicker: string;
  faqTitle: string;
  faqCta: string;
}

export interface About {
  intro: PageIntro;
  storyTitle: string;
  story: string[];
  valuesTitle: string;
  values: Pillar[];
  credsTitle: string;
  creds: { year: string; title: string; place: string }[];
  quote: string;
  ctaTitle: string;
  ctaText: string;
}

export interface Service {
  icon: IconKey;
  tag: string;
  title: string;
  desc: string;
  bullets: string[];
  image: string;
}

export interface Program {
  id: string;
  contentId?: string;
  amount?: number;
  days?: number;
  image?: string;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  popular: boolean;
  note: string;
}

export interface ProgramsPage extends PageIntro {
  popular: string;
  perMonth: string;
  currency: string;
  includes: string;
  note: string;
  cta: string;
  compareTitle: string;
  compareRows: { label: string; values: [string, string, string] }[];
  faqs: { q: string; a: string }[];
}

export interface Transform {
  name: string;
  duration: string;
  stat: string;
  before: string;
  after: string;
  summary: string;
}

export interface ResultsPage extends PageIntro {
  before: string;
  after: string;
  drag: string;
  statLabel: string;
  durationLabel: string;
  demoNote: string;
  cta: string;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  rating: number;
  result: string;
  avatar?: string;
}

export interface TestimonialSection {
  kicker: string;
  title: string;
}

export interface Calculator {
  kicker: string;
  title: string;
  lead: string;
  form: {
    gender: string;
    male: string;
    female: string;
    age: string;
    height: string;
    weight: string;
    activity: string;
    goal: string;
    calc: string;
    reset: string;
    activityLevels: { label: string; hint: string; value: number }[];
    goals: { label: string; value: "lose" | "maintain" | "gain" }[];
  };
  results: {
    bmi: string;
    bmiLabels: { under: string; normal: string; over: string; obese: string };
    bmr: string;
    tdee: string;
    target: string;
    protein: string;
    carbs: string;
    fat: string;
    water: string;
    ideal: string;
    send: string;
    disclaimer: string;
    unitKcal: string;
    unitG: string;
    unitKg: string;
    unitL: string;
    headline: string;
    goalNames: { lose: string; maintain: string; gain: string };
  };
}

export interface FaqSection {
  kicker: string;
  title: string;
  items: { q: string; a: string }[];
}

export interface PostBlock {
  h?: string;
  p: string;
}

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  cover: string;
  body: PostBlock[];
}

export interface BlogPage extends PageIntro {
  minRead: string;
  readArticle: string;
  back: string;
  related: string;
  empty: string;
}

export interface Contact {
  intro: PageIntro;
  form: {
    name: string;
    phone: string;
    goal: string;
    message: string;
    submit: string;
    note: string;
    goals: string[];
    errors: { name: string; phone: string };
    success: string;
  };
  info: {
    title: string;
    address: string;
    hours: string;
    phone: string;
    email: string;
    follow: string;
    whatsapp: string;
    call: string;
    responseNote: string;
  };
}

export interface Footer {
  tagline: string;
  quickLinks: string;
  servicesTitle: string;
  contactTitle: string;
  rights: string;
  disclaimer: string;
  privacy: string;
  terms: string;
}

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { h: string; p: string }[];
}

export interface Dict {
  nav: {
    home: string;
    about: string;
    services: string;
    programs: string;
    results: string;
    calculator: string;
    blog: string;
    contact: string;
  };
  ui: {
    book: string;
    whatsapp: string;
    call: string;
    free: string;
    viewAll: string;
    bookNow: string;
    scroll: string;
    languageLabel: string;
    menu: string;
    close: string;
    signIn: string;
    signInShort: string;
    signUp: string;
    subscribeNow: string;
    subscribePlan: string;
    dashboard: string;
    myAccount: string;
    accountAndPlan: string;
    securePayment: string;
    accountSection: string;
    subscriptionAndPayment: string;
  };
  hero: Hero;
  stats: Stat[];
  marquee: string[];
  home: Home;
  about: About;
  servicesPage: PageIntro & { note: string; cta: string };
  services: Service[];
  programsPage: ProgramsPage;
  programs: Program[];
  resultsPage: ResultsPage;
  results: Transform[];
  testimonials: Testimonial[];
  testimonialSection: TestimonialSection;
  calculator: Calculator;
  faq: FaqSection;
  blogPage: BlogPage;
  posts: Post[];
  contact: Contact;
  footer: Footer;
  legal: { privacy: LegalDoc; terms: LegalDoc };
  notFound: { title: string; text: string; cta: string };
  finalCta: { kicker: string; title: string; text: string; primary: string; secondary: string };
}
