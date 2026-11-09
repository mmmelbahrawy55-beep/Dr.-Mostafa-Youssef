export const site = {
  phoneDisplay: "0100 433 4487",
  phone: "+201004334487",
  whatsapp: "201004334487",
  email: "hello@drmostafayoussef.com",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  youtube: "https://www.youtube.com/",
  tiktok: "https://www.tiktok.com/",
  address: {
    ar: "الزقازيق، مصر — العيادة الرئيسية",
    en: "Zagazig, Egypt — Main clinic",
  },
  hours: {
    ar: "السبت – الخميس: ١٠ صباحًا – ٩ مساءً",
    en: "Saturday – Thursday: 10 AM – 9 PM",
  },
  mapEmbed: "https://maps.google.com/maps?q=Zagazig%2C%20Egypt&z=12&output=embed",
  locale: { ar: "ar-EG", en: "en-US" },
} as const;

export const whatsappLink = (message?: string) =>
  `https://wa.me/${site.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

export const telLink = `tel:${site.phone}`;

export const navPaths = {
  home: "/",
  about: "/about",
  services: "/services",
  programs: "/programs",
  results: "/results",
  calculator: "/calculator",
  blog: "/blog",
  contact: "/contact",
} as const;
