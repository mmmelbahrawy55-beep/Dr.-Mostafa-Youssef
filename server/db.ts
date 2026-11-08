import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ar } from "../src/content/ar";
import { en } from "../src/content/en";
import { images } from "../src/lib/images";
import { hashPassword, nowIso, safeJson } from "./security";
import type { ContentItem, SiteSettings } from "../shared/types";

/**
 * Project root. Resolved from the module URL when we run as ESM (local dev),
 * and falls back to the working directory when the code is bundled to CJS for
 * serverless hosts, where `import.meta` is unavailable.
 */
const moduleUrl = (import.meta as { url?: string } | undefined)?.url;
const moduleRoot =
  moduleUrl && moduleUrl.startsWith("file:") ? path.resolve(fileURLToPath(new URL("..", moduleUrl))) : process.cwd();

/**
 * On Vercel the bundle directory is read-only, so runtime data (SQLite file,
 * uploaded screenshots, media) goes to the writable, but ephemeral, /tmp.
 * Point DATA_DIR/DB_PATH at a persistent location when a database is attached.
 */
const onVercel = Boolean(process.env.VERCEL);
export const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : moduleRoot;
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : onVercel
    ? "/tmp/data"
    : path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const SHOT_DIR = path.join(DATA_DIR, "screenshots");
export const DIST_DIR = path.join(ROOT, "dist");

for (const dir of [DATA_DIR, UPLOAD_DIR, SHOT_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(process.env.DB_PATH ?? path.join(DATA_DIR, "app.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL DEFAULT 'customer',
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL DEFAULT '',
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    blocked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    common TEXT NOT NULL DEFAULT '{}',
    ar TEXT NOT NULL DEFAULT '{}',
    en TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_content_collection ON content_items(collection, sort);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    program_id TEXT NOT NULL,
    program_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    days INTEGER NOT NULL DEFAULT 30,
    method TEXT NOT NULL,
    sender TEXT NOT NULL,
    reference TEXT NOT NULL,
    screenshot TEXT NOT NULL,
    screenshot_sha TEXT NOT NULL UNIQUE,
    reference_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    risk TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC);

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    program_id TEXT NOT NULL,
    program_name TEXT NOT NULL,
    payment_id INTEGER,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, ends_at DESC);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    actor_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    entity TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`);

/* ------------------------------- migrations ------------------------------- */

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("payments", "screenshot_width", "INTEGER");
ensureColumn("payments", "screenshot_height", "INTEGER");

const defaultSettings: SiteSettings = {
  contact: {
    phone: "+201004334487",
    whatsapp: "201004334487",
    email: "hello@drmostafayoussef.com",
    addressAr: "القاهرة، مصر — العيادة الرئيسية",
    addressEn: "Cairo, Egypt — Main clinic",
    hoursAr: "السبت – الخميس: ١٠ صباحًا – ٩ مساءً",
    hoursEn: "Saturday – Thursday: 10 AM – 9 PM",
    mapEmbed: "https://maps.google.com/maps?q=Cairo%2C%20Egypt&z=12&output=embed",
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    youtube: "https://www.youtube.com/",
    tiktok: "https://www.tiktok.com/",
  },
  payments: {
    vodafone: "01004334487",
    instapay: "mostafa@instapay",
    accountName: "مصطفى يوسف",
    bankNoteAr: "للمدفوعات البنكية تواصل معنا على واتساب لاستلام بيانات الحساب.",
    bankNoteEn: "For bank transfers, message us on WhatsApp to receive the account details.",
    instructionsAr:
      "حوّل قيمة الباقة على الرقم/العنوان الموضح، واحتفظ بصورة التحويل. ارفع الصورة هنا مع رقم العملية، وسيتم تفعيل اشتراكك تلقائيًا عند التحقق.",
    instructionsEn:
      "Transfer the plan amount to the number/address shown and keep the receipt. Upload the screenshot with the transaction reference and your subscription activates automatically once verified.",
    autoApprove: true,
  },
  hero: { image: images.hero },
  announcement: { ar: "", en: "", enabled: false },
};

function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value?: string } | undefined;
  if (!row?.value) return fallback;
  return safeJson(row.value, fallback);
}

export function getSettings(): SiteSettings {
  const saved = getSetting<Partial<SiteSettings>>("site", {});
  return {
    contact: { ...defaultSettings.contact, ...(saved.contact ?? {}) },
    payments: { ...defaultSettings.payments, ...(saved.payments ?? {}) },
    hero: { ...defaultSettings.hero, ...(saved.hero ?? {}) },
    announcement: { ...defaultSettings.announcement, ...(saved.announcement ?? {}) },
  };
}

export function saveSettings(next: SiteSettings) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(next));
}

export function getCopyOverrides(): { ar: Record<string, string>; en: Record<string, string> } {
  return getSetting("copy", { ar: {}, en: {} });
}

export function saveCopyOverrides(next: { ar: Record<string, string>; en: Record<string, string> }) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('copy', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(next));
}

export function logAudit(
  actor: { id?: number; name?: string } | null,
  action: string,
  entity = "",
  entityId: string | number = "",
  meta: Record<string, unknown> = {}
) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_name, action, entity, entity_id, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    actor?.id ?? null,
    actor?.name ?? "system",
    action,
    entity,
    String(entityId),
    JSON.stringify(meta),
    nowIso()
  );
}

export function listContent(collection: string, onlyActive = false): ContentItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM content_items WHERE collection = ? ${onlyActive ? "AND active = 1" : ""} ORDER BY sort ASC, id ASC`
    )
    .all(collection) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    collection: row.collection as ContentItem["collection"],
    sort: Number(row.sort),
    active: Boolean(row.active),
    common: safeJson(row.common, {}),
    ar: safeJson(row.ar, {}),
    en: safeJson(row.en, {}),
  }));
}

export function getContent(id: string): ContentItem | undefined {
  const row = db.prepare("SELECT * FROM content_items WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    id: String(row.id),
    collection: row.collection as ContentItem["collection"],
    sort: Number(row.sort),
    active: Boolean(row.active),
    common: safeJson(row.common, {}),
    ar: safeJson(row.ar, {}),
    en: safeJson(row.en, {}),
  };
}

export function upsertContent(item: ContentItem) {
  db.prepare(
    `INSERT INTO content_items (id, collection, sort, active, common, ar, en)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET collection = excluded.collection, sort = excluded.sort,
       active = excluded.active, common = excluded.common, ar = excluded.ar, en = excluded.en`
  ).run(
    item.id,
    item.collection,
    item.sort,
    item.active ? 1 : 0,
    JSON.stringify(item.common ?? {}),
    JSON.stringify(item.ar ?? {}),
    JSON.stringify(item.en ?? {})
  );
}

const seedPassword = process.env.ADMIN_PASSWORD || "Mostafa@2026!";
const seedEmail = (process.env.ADMIN_EMAIL || "admin@drmostafayoussef.com").toLowerCase();

function seedAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) return;
  const { salt, hash } = hashPassword(seedPassword);
  db.prepare(
    `INSERT INTO users (role, name, email, phone, password_salt, password_hash, created_at)
     VALUES ('admin', ?, ?, ?, ?, ?, ?)`
  ).run("د. مصطفى يوسف", seedEmail, "01004334487", salt, hash, nowIso());
}

function parseAmount(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return Number.parseInt(digits || "0", 10);
}

function seedContent() {
  const count = db.prepare("SELECT COUNT(*) AS total FROM content_items").get() as { total: number };
  if (Number(count.total) > 0) return;

  const programImages = [images.gym, images.hero, images.dumbbells];

  ar.programs.forEach((program, index) => {
    const other = en.programs[index];
    upsertContent({
      id: `prog-${program.id}`,
      collection: "programs",
      sort: index,
      active: true,
      common: {
        amount: parseAmount(program.price),
        days: 30,
        popular: program.popular,
        image: programImages[index] ?? images.gym,
      },
      ar: { name: program.name, tagline: program.tagline, features: program.features, note: program.note },
      en: {
        name: other?.name ?? program.name,
        tagline: other?.tagline ?? program.tagline,
        features: other?.features ?? program.features,
        note: other?.note ?? program.note,
      },
    });
  });

  ar.services.forEach((service, index) => {
    const other = en.services[index];
    upsertContent({
      id: `svc-${index + 1}`,
      collection: "services",
      sort: index,
      active: true,
      common: { icon: service.icon, image: service.image },
      ar: { tag: service.tag, title: service.title, desc: service.desc, bullets: service.bullets },
      en: {
        tag: other?.tag ?? service.tag,
        title: other?.title ?? service.title,
        desc: other?.desc ?? service.desc,
        bullets: other?.bullets ?? service.bullets,
      },
    });
  });

  ar.testimonials.forEach((item, index) => {
    const other = en.testimonials[index];
    upsertContent({
      id: `tst-${index + 1}`,
      collection: "testimonials",
      sort: index,
      active: true,
      common: { rating: item.rating },
      ar: { name: item.name, role: item.role, quote: item.quote, result: item.result },
      en: {
        name: other?.name ?? item.name,
        role: other?.role ?? item.role,
        quote: other?.quote ?? item.quote,
        result: other?.result ?? item.result,
      },
    });
  });

  ar.results.forEach((item, index) => {
    const other = en.results[index];
    upsertContent({
      id: `res-${index + 1}`,
      collection: "results",
      sort: index,
      active: true,
      common: { before: item.before, after: item.after },
      ar: { name: item.name, duration: item.duration, stat: item.stat, summary: item.summary },
      en: {
        name: other?.name ?? item.name,
        duration: other?.duration ?? item.duration,
        stat: other?.stat ?? item.stat,
        summary: other?.summary ?? item.summary,
      },
    });
  });

  ar.posts.forEach((post, index) => {
    const other = en.posts.find((entry) => entry.slug === post.slug);
    upsertContent({
      id: `post-${post.slug}`,
      collection: "posts",
      sort: index,
      active: true,
      common: {
        slug: post.slug,
        date: post.date,
        readTime: post.readTime,
        cover: post.cover,
      },
      ar: { title: post.title, excerpt: post.excerpt, category: post.category, body: post.body },
      en: {
        title: other?.title ?? post.title,
        excerpt: other?.excerpt ?? post.excerpt,
        category: other?.category ?? post.category,
        body: other?.body ?? post.body,
      },
    });
  });

  ar.faq.items.forEach((item, index) => {
    const other = en.faq.items[index];
    upsertContent({
      id: `faq-${index + 1}`,
      collection: "faqs",
      sort: index,
      active: true,
      common: {},
      ar: { q: item.q, a: item.a },
      en: { q: other?.q ?? item.q, a: other?.a ?? item.a },
    });
  });

  ar.about.creds.forEach((item, index) => {
    const other = en.about.creds[index];
    upsertContent({
      id: `cred-${index + 1}`,
      collection: "credentials",
      sort: index,
      active: true,
      common: {},
      ar: { year: item.year, title: item.title, place: item.place },
      en: {
        year: other?.year ?? item.year,
        title: other?.title ?? item.title,
        place: other?.place ?? item.place,
      },
    });
  });
}

seedAdmin();
seedContent();

if (!db.prepare("SELECT key FROM settings WHERE key = 'site'").get()) {
  saveSettings(defaultSettings);
}
