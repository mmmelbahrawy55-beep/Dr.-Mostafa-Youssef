import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLang } from "./i18n";
import { useSiteData } from "./site-data";

/**
 * The public site is a single-page app, so the static index.html metadata only
 * describes the home page. This hook keeps the title, description, canonical
 * URL and Open Graph tags in sync with the active route and language.
 */
export const SITE_URL = "https://dr-mostafa-youssef.vercel.app";

type Meta = { title: string; description: string };

const PAGES: Record<string, { ar: Meta; en: Meta }> = {
  "/": {
    ar: {
      title: "د. مصطفى يوسف | تغذية علاجية وتدريب في الزقازيق",
      description:
        "برامج تغذية علاجية وتدريب مبني على العلم مع متابعة أسبوعية، وحساب سعرات مجاني، وحجز استشارة أونلاين. د. مصطفى يوسف — الزقازيق، مصر.",
    },
    en: {
      title: "Dr. Mostafa Youssef | Clinical Nutrition & Training in Zagazig",
      description:
        "Science-based nutrition and training plans with weekly follow-up, a free calorie calculator and online consultation booking. Zagazig, Egypt.",
    },
  },
  "/about": {
    ar: { title: "عن د. مصطفى يوسف | خبرة وتخصص", description: "تعرّف على خبرة د. مصطفى يوسف في التغذية العلاجية والتدريب، ومؤهلاته، وفلسفته في المتابعة." },
    en: { title: "About Dr. Mostafa Youssef | Credentials & approach", description: "Clinical nutrition and training background, credentials and the follow-up philosophy behind every plan." },
  },
  "/services": {
    ar: { title: "خدمات التغذية والتدريب | د. مصطفى يوسف", description: "تغذية علاجية، خطط تخسيس وتضخيم، تدريب شخصي، تحاليل ومكملات، ومتابعة أسبوعية." },
    en: { title: "Nutrition & training services | Dr. Mostafa Youssef", description: "Clinical nutrition, fat-loss and muscle-gain plans, personal training, labs, supplements and weekly follow-up." },
  },
  "/programs": {
    ar: { title: "باقات الاشتراك والأسعار | د. مصطفى يوسف", description: "اختار باقة التغذية والتدريب المناسبة لهدفك، وادفع بفودافون كاش أو إنستاباي مع تفعيل بعد التحقق." },
    en: { title: "Plans & pricing | Dr. Mostafa Youssef", description: "Choose the nutrition and training plan that fits your goal and pay with Vodafone Cash or InstaPay." },
  },
  "/results": {
    ar: { title: "نتائج حقيقية للعملاء | د. مصطفى يوسف", description: "قصص تحوّل ونتائج موثّقة لعملاء برامج التغذية والتدريب." },
    en: { title: "Client results | Dr. Mostafa Youssef", description: "Documented transformations from nutrition and training clients." },
  },
  "/calculator": {
    ar: { title: "حاسبة السعرات والماكروز المجانية", description: "احسب احتياجك اليومي من السعرات والبروتين والكارب والدهون مجانًا في دقيقة." },
    en: { title: "Free calorie & macro calculator", description: "Calculate your daily calories, protein, carbs, fat and water in under a minute." },
  },
  "/blog": {
    ar: { title: "مقالات التغذية والتدريب | د. مصطفى يوسف", description: "مقالات علمية مبسطة عن التغذية، التخسيس، التضخيم، والصحة." },
    en: { title: "Nutrition & training articles | Dr. Mostafa Youssef", description: "Clear, science-based articles about nutrition, fat loss, muscle gain and health." },
  },
  "/contact": {
    ar: { title: "تواصل مع د. مصطفى يوسف | حجز استشارة", description: "احجز استشارتك أو اسأل عن الباقات. واتساب: 01004334487 — الزقازيق، مصر." },
    en: { title: "Contact Dr. Mostafa Youssef | Book a consultation", description: "Book a consultation or ask about plans. WhatsApp: 01004334487 — Zagazig, Egypt." },
  },
  "/privacy": {
    ar: { title: "سياسة الخصوصية | د. مصطفى يوسف", description: "كيف نجمع بياناتك ونحميها ونستخدمها في تقديم خدمة التغذية والتدريب." },
    en: { title: "Privacy policy | Dr. Mostafa Youssef", description: "How your data is collected, protected and used to deliver nutrition and training services." },
  },
  "/terms": {
    ar: { title: "الشروط والأحكام | د. مصطفى يوسف", description: "شروط استخدام الموقع والاشتراكات والمدفوعات وإخلاء المسؤولية الطبي." },
    en: { title: "Terms & conditions | Dr. Mostafa Youssef", description: "Terms for using the site and plans, payments, and the medical disclaimer." },
  },
  "/refund": {
    ar: { title: "سياسة الاسترجاع | د. مصطفى يوسف", description: "شروط استرداد قيمة الباقات، والمدة، والاستثناءات، وطريقة تقديم الطلب." },
    en: { title: "Refund policy | Dr. Mostafa Youssef", description: "Refund terms for plans, timelines, exceptions and how to request a refund." },
  },
  "/login": {
    ar: { title: "تسجيل الدخول | د. مصطفى يوسف", description: "ادخل على حسابك لمتابعة باقتك ومدفوعاتك." },
    en: { title: "Sign in | Dr. Mostafa Youssef", description: "Sign in to track your plan, payments and progress." },
  },
  "/register": {
    ar: { title: "إنشاء حساب | د. مصطفى يوسف", description: "أنشئ حسابك واشترك في الباقة المناسبة لهدفك." },
    en: { title: "Create an account | Dr. Mostafa Youssef", description: "Create your account and subscribe to the plan that fits your goal." },
  },
  "/account": {
    ar: { title: "حسابي | د. مصطفى يوسف", description: "باقتك الحالية، مدفوعاتك، وتفاصيل حسابك في مكان واحد." },
    en: { title: "My account | Dr. Mostafa Youssef", description: "Your current plan, payments and account details in one place." },
  },
  "/admin": {
    ar: { title: "لوحة التحكم | د. مصطفى يوسف", description: "لوحة إدارة الموقع والمدفوعات والعملاء." },
    en: { title: "Dashboard | Dr. Mostafa Youssef", description: "Manage payments, clients, content and site settings." },
  },
};

function setMeta(selector: string, attr: string, value: string, create: () => Element) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  node.setAttribute(attr, value);
}

export function usePageMeta() {
  const { pathname } = useLocation();
  const { lang } = useLang();
  const { data } = useSiteData();

  useEffect(() => {
    const key = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
    const page = PAGES[key];
    const post = key.startsWith("/blog/")
      ? data?.posts?.find((item) => String((item.common as Record<string, unknown>)?.slug ?? "") === key.slice(6))
      : undefined;

    const postMeta: Meta | null = post
      ? {
          title: `${String((post[lang] as Record<string, unknown>)?.title ?? "")} | د. مصطفى يوسف`,
          description: String((post[lang] as Record<string, unknown>)?.excerpt ?? ""),
        }
      : null;

    const fallback: Meta =
      lang === "ar"
        ? { title: "د. مصطفى يوسف | تغذية علاجية وتدريب", description: "برامج تغذية علاجية وتدريب مع متابعة أسبوعية." }
        : { title: "Dr. Mostafa Youssef | Clinical Nutrition & Training", description: "Nutrition and training plans with weekly follow-up." };

    const meta = postMeta ?? (page ? page[lang] : null) ?? fallback;
    const fullTitle = meta.title.includes("مصطفى يوسف") || meta.title.includes("Mostafa Youssef") ? meta.title : `${meta.title} | د. مصطفى يوسف`;
    document.title = fullTitle;

    setMeta('meta[name="description"]', "content", meta.description, () => {
      const el = document.createElement("meta");
      el.setAttribute("name", "description");
      return el;
    });
    setMeta('meta[property="og:title"]', "content", fullTitle, () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:title");
      return el;
    });
    setMeta('meta[property="og:description"]', "content", meta.description, () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:description");
      return el;
    });
    setMeta('meta[property="og:url"]', "content", `${SITE_URL}${pathname}`, () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:url");
      return el;
    });
    setMeta('meta[property="og:locale"]', "content", lang === "ar" ? "ar_EG" : "en_US", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:locale");
      return el;
    });
    setMeta('link[rel="canonical"]', "href", `${SITE_URL}${pathname}`, () => {
      const el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      return el;
    });
  }, [pathname, lang, data]);
}
