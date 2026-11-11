import type { ContentItem, CopyOverrides, SiteData } from "../../shared/types";
import type { Dict, IconKey, Lang, PostBlock } from "../content/types";
import { ensureProgramSystem } from "./program-system";
import { avatarFor } from "./images";

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const localized = (item: ContentItem, lang: Lang, key: string, fallback = "") =>
  str((item[lang] as Record<string, unknown> | undefined)?.[key], str((item.ar as Record<string, unknown> | undefined)?.[key], fallback));

const localizedArray = (item: ContentItem, lang: Lang, key: string): string[] => {
  const value = (item[lang] as Record<string, unknown> | undefined)?.[key];
  const fallback = (item.ar as Record<string, unknown> | undefined)?.[key];
  const chosen = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return chosen.map((entry) => String(entry));
};

const localizedBlocks = (item: ContentItem, lang: Lang): PostBlock[] => {
  const value = (item[lang] as Record<string, unknown> | undefined)?.body;
  const fallback = (item.ar as Record<string, unknown> | undefined)?.body;
  const chosen = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return chosen
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const block = entry as Record<string, unknown>;
      return { h: str(block.h) || undefined, p: str(block.p) };
    });
};

export const formatPrice = (amount: number) => new Intl.NumberFormat("en-US").format(Math.max(0, amount));

const ICONS: IconKey[] = ["nutrition", "flame", "muscle", "coach", "sport", "lab"];

const localizedSystem = (item: ContentItem, lang: Lang) => {
  const chosen = (item[lang] as Record<string, unknown> | undefined)?.system;
  const fallback = (item.ar as Record<string, unknown> | undefined)?.system;
  return ensureProgramSystem(chosen ?? fallback);
};

/** Flattens a nested object into `section.key.0` paths so the admin copy editor can edit every line. */
export function flattenStrings(value: unknown, prefix = "", output: Record<string, string> = {}) {
  if (typeof value === "string") {
    output[prefix] = value;
    return output;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    output[prefix] = String(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenStrings(entry, `${prefix}.${index}`, output));
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      flattenStrings(entry, prefix ? `${prefix}.${key}` : key, output);
    }
  }
  return output;
}

/** Applies flat `a.b.0` copy overrides onto a cloned dictionary. */
export function applyCopyOverrides(dict: Dict, overrides: Record<string, string> | undefined) {
  if (!overrides) return dict;
  for (const [path, value] of Object.entries(overrides)) {
    if (typeof value !== "string") continue;
    const parts = path.split(".");
    let cursor: unknown = dict;
    for (let index = 0; index < parts.length - 1; index += 1) {
      if (!cursor || typeof cursor !== "object") {
        cursor = null;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[parts[index]];
    }
    if (!cursor || typeof cursor !== "object") continue;
    const last = parts[parts.length - 1];
    const previous = (cursor as Record<string, unknown>)[last];
    if (typeof previous === "string" || typeof previous === "number" || previous === undefined) {
      (cursor as Record<string, unknown>)[last] = value;
    }
  }
  return dict;
}

function applySiteContent(dict: Dict, lang: Lang, data: SiteData) {
  if (data.programs) {
    dict.programs = data.programs.map((item, index) => {
      const amount = num(item.common.amount, 0);
      return {
        id: item.id.replace(/^prog-/, "") || `program-${index}`,
        contentId: item.id,
        amount,
        days: num(item.common.days, 30),
        image: str(item.common.image),
        name: localized(item, lang, "name", `الباقة ${index + 1}`),
        price: formatPrice(amount),
        tagline: localized(item, lang, "tagline"),
        features: localizedArray(item, lang, "features"),
        popular: Boolean(item.common.popular),
        note: localized(item, lang, "note"),
        system: localizedSystem(item, lang),
      };
    });
  }

  if (data.services) {
    dict.services = data.services.map((item, index) => {
      const iconRaw = str(item.common.icon, "nutrition") as IconKey;
      return {
        icon: ICONS.includes(iconRaw) ? iconRaw : "nutrition",
        tag: localized(item, lang, "tag"),
        title: localized(item, lang, "title", `الخدمة ${index + 1}`),
        desc: localized(item, lang, "desc"),
        bullets: localizedArray(item, lang, "bullets"),
        image: str(item.common.image),
      };
    });
  }

  if (data.testimonials) {
    dict.testimonials = data.testimonials.map((item, index) => ({
      name: localized(item, lang, "name"),
      role: localized(item, lang, "role"),
      quote: localized(item, lang, "quote"),
      rating: Math.min(5, Math.max(1, num(item.common.rating, 5))),
      result: localized(item, lang, "result"),
      avatar: avatarFor(index),
    }));
  }

  if (data.results) {
    dict.results = data.results.map((item, index) => ({
      name: localized(item, lang, "name", `الحالة ${index + 1}`),
      duration: localized(item, lang, "duration"),
      stat: localized(item, lang, "stat"),
      before: str(item.common.before),
      after: str(item.common.after),
      summary: localized(item, lang, "summary"),
    }));
  }

  if (data.posts) {
    dict.posts = data.posts.map((item, index) => ({
      slug: str(item.common.slug, item.id.replace(/^post-/, `post-${index}`)),
      title: localized(item, lang, "title"),
      excerpt: localized(item, lang, "excerpt"),
      date: str(item.common.date, new Date().toISOString().slice(0, 10)),
      readTime: str(item.common.readTime, "5"),
      category: localized(item, lang, "category"),
      cover: str(item.common.cover),
      body: localizedBlocks(item, lang),
    }));
  }

  if (data.faqs) {
    dict.faq.items = data.faqs.map((item) => ({
      q: localized(item, lang, "q"),
      a: localized(item, lang, "a"),
    }));
  }

  if (data.credentials && data.credentials.length > 0) {
    dict.about.creds = data.credentials.map((item) => ({
      year: localized(item, lang, "year"),
      title: localized(item, lang, "title"),
      place: localized(item, lang, "place"),
    }));
  }

  return dict;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function buildDict(base: Dict, lang: Lang, data: SiteData | null): Dict {
  const dict = clone(base);
  if (!data) return dict;
  applyCopyOverrides(dict, (data.copy as CopyOverrides | undefined)?.[lang]);
  return applySiteContent(dict, lang, data);
}
