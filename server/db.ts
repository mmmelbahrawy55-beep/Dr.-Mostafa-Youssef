import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { ar } from "../src/content/ar";
import { en } from "../src/content/en";
import { images } from "../src/lib/images";
import { hashPassword, nowIso, safeJson } from "./security";
import type { ContentItem, SiteSettings } from "../shared/types";

/* ------------------------------- project root ------------------------------ */

const moduleUrl = (import.meta as { url?: string } | undefined)?.url;
const moduleRoot =
  moduleUrl && moduleUrl.startsWith("file:") ? path.resolve(fileURLToPath(new URL("..", moduleUrl))) : process.cwd();

const onVercel = Boolean(process.env.VERCEL);
export const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : moduleRoot;

/**
 * Uploads are staged on disk only long enough to validate the image and read
 * its bytes; the bytes themselves live in Redis (see putFile below), so the
 * ephemeral /tmp on Vercel never holds anything that must survive.
 */
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

/* --------------------------------- env files -------------------------------- */

/**
 * Local dev runs `tsx server/index.ts` directly, so load `.env.local` by hand.
 *
 * Only the keys this process actually needs are imported: a file pulled with
 * `vercel env pull` also contains `VERCEL=1` and friends, and copying those
 * across would make local runs think they are serverless and skip listening.
 */
const LOCAL_KEYS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "KV_URL",
  "REDIS_URL",
  "REDIS_PREFIX",
  "JWT_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

function loadLocalEnv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return;
  for (const candidate of [path.join(ROOT, ".env.local"), path.join(process.cwd(), ".env.local")]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match || !LOCAL_KEYS.includes(match[1])) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
    return;
  }
}
loadLocalEnv();

/* -------------------------------- redis client ------------------------------ */

const KV_URL = process.env.KV_REST_API_URL || process.env.REDIS_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

if (!KV_URL.startsWith("http") || KV_TOKEN.length < 20) {
  throw new Error(
    "[db] Missing Upstash credentials. Set KV_REST_API_URL and KV_REST_API_TOKEN (Vercel project env, or .env.local for local dev)."
  );
}

/**
 * `automaticDeserialization: false` keeps every value as the exact string we
 * stored, so JSON blobs round-trip untouched.
 */
export const redis = new Redis({ url: KV_URL, token: KV_TOKEN, automaticDeserialization: false });

/* ------------------------------ table primitives ---------------------------- */

type Row = Record<string, any>;

/**
 * Namespace every key so a development instance can share the same Upstash
 * database without ever touching production rows: `REDIS_PREFIX=dev`.
 */
const PREFIX = `${(process.env.REDIS_PREFIX || "dm").replace(/:+$/, "")}:`;

const tableKey = (table: string) => `${PREFIX}t:${table}`;
const seqKey = (table: string) => `${PREFIX}s:${table}`;
const settingKey = (key: string) => `${PREFIX}set:${key}`;
const fileKey = (name: string) => `${PREFIX}f:${name}`;
const uniqueKey = (name: string) => `${PREFIX}u:${name}`;
const rateKey = (bucket: string) => `${PREFIX}rl:${bucket}`;

/** `hgetall` answers with a flat [field, value, ...] array when auto-parse is off. */
function toPairs(raw: unknown): [string, string][] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const out: [string, string][] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) out.push([String(raw[i]), String(raw[i + 1])]);
    return out;
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, String(value)]);
  }
  return [];
}

function parseRow<T>(raw: unknown): T | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return undefined;
  }
}

export async function allRows<T = Row>(table: string): Promise<T[]> {
  const pairs = toPairs(await redis.hgetall(tableKey(table)));
  const rows: T[] = [];
  for (const [, value] of pairs) {
    const row = parseRow<T>(value);
    if (row) rows.push(row);
  }
  return rows;
}

export async function getRow<T = Row>(table: string, id: string | number): Promise<T | undefined> {
  return parseRow<T>(await redis.hget(tableKey(table), String(id)));
}

export async function findRow<T = Row>(
  table: string,
  predicate: (row: T) => boolean
): Promise<T | undefined> {
  const rows = await allRows<T>(table);
  return rows.find(predicate);
}

export async function nextId(table: string): Promise<number> {
  return Number(await redis.incr(seqKey(table)));
}

/**
 * Atomically claims a receipt hash / transaction reference. Returns false when
 * another request already owns it, which closes the check-then-write race
 * between two simultaneous uploads of the same screenshot.
 */
export async function reserveOnce(name: string): Promise<boolean> {
  const result = await redis.set(uniqueKey(name), "1", { nx: true });
  return Boolean(result);
}

export async function releaseOnce(name: string): Promise<void> {
  await redis.del(uniqueKey(name));
}

/** Shared rate-limit counter; INCR+EXPIRE works across serverless instances. */
export async function rateCount(bucket: string, seconds: number): Promise<number> {
  const key = rateKey(bucket);
  const count = Number(await redis.incr(key));
  if (count === 1) await redis.expire(key, seconds);
  return count;
}

export async function putRow(table: string, row: Row): Promise<void> {
  await redis.hset(tableKey(table), { [String(row.id)]: JSON.stringify(row) });
}

export async function patchRow<T extends Row>(
  table: string,
  id: string | number,
  patch: Partial<T>
): Promise<T | undefined> {
  const current = await getRow<T>(table, id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  await putRow(table, next);
  return next;
}

export async function deleteRow(table: string, id: string | number): Promise<void> {
  await redis.hdel(tableKey(table), String(id));
}

/* --------------------------------- settings --------------------------------- */

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const raw = await redis.get(settingKey(key));
  if (raw === null || raw === undefined || raw === "") return fallback;
  return safeJson(String(raw), fallback);
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await redis.set(settingKey(key), JSON.stringify(value));
}

const defaultSettings: SiteSettings = {
  contact: {
    phone: "+201004334487",
    whatsapp: "201004334487",
    email: "hello@drmostafayoussef.com",
    addressAr: "الزقازيق، مصر — العيادة الرئيسية",
    addressEn: "Zagazig, Egypt — Main clinic",
    hoursAr: "السبت – الخميس: ١٠ صباحًا – ٩ مساءً",
    hoursEn: "Saturday – Thursday: 10 AM – 9 PM",
    mapEmbed: "https://maps.google.com/maps?q=Zagazig%2C%20Egypt&z=12&output=embed",
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
    // Receipt screenshots are not machine-verifiable yet, so activation starts
    // in manual review. The doctor can enable automatic activation from
    // settings once he accepts that risk.
    autoApprove: false,
  },
  hero: { image: images.hero },
  announcement: { ar: "", en: "", enabled: false },
};

export async function getSettings(): Promise<SiteSettings> {
  const saved = await getSetting<Partial<SiteSettings>>("site", {});
  return {
    contact: { ...defaultSettings.contact, ...(saved.contact ?? {}) },
    payments: { ...defaultSettings.payments, ...(saved.payments ?? {}) },
    hero: { ...defaultSettings.hero, ...(saved.hero ?? {}) },
    announcement: { ...defaultSettings.announcement, ...(saved.announcement ?? {}) },
  };
}

export async function saveSettings(next: SiteSettings): Promise<void> {
  await setSetting("site", next);
}

/**
 * Session signing key. `JWT_SECRET` wins; otherwise a random key is stored in
 * Redis once, so every serverless instance signs with the same secret and
 * logins survive cold starts even if the env var was forgotten.
 */
export async function getJwtSecret(): Promise<string> {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const key = settingKey("jwt-secret");
  const existing = await redis.get(key);
  if (existing) return String(existing);

  const generated = randomBytes(48).toString("hex");
  const claimed = await redis.set(key, generated, { nx: true });
  if (claimed) return generated;

  const stored = await redis.get(key);
  return stored ? String(stored) : generated;
}

export async function getCopyOverrides(): Promise<{ ar: Record<string, string>; en: Record<string, string> }> {
  return getSetting("copy", { ar: {}, en: {} });
}

export async function saveCopyOverrides(next: {
  ar: Record<string, string>;
  en: Record<string, string>;
}): Promise<void> {
  await setSetting("copy", next);
}

/* ---------------------------------- audit ----------------------------------- */

export async function logAudit(
  actor: { id?: number; name?: string } | null | undefined,
  action: string,
  entity = "",
  entityId: string | number = "",
  meta: Record<string, unknown> = {}
): Promise<void> {
  const id = await nextId("audit_log");
  await putRow("audit_log", {
    id,
    actor_id: actor?.id ?? null,
    actor_name: actor?.name ?? "system",
    action,
    entity,
    entity_id: String(entityId),
    meta: JSON.stringify(meta),
    created_at: nowIso(),
  });
}

export async function listAudit(limit = 200) {
  const rows = await allRows<Row>("audit_log");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
}

/* --------------------------------- content ---------------------------------- */

function toContentItem(row: Row): ContentItem {
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

export async function listContent(collection: string, onlyActive = false): Promise<ContentItem[]> {
  const rows = await allRows<Row>("content_items");
  return rows
    .filter((row) => row.collection === collection && (!onlyActive || Boolean(row.active)))
    .sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.id).localeCompare(String(b.id)))
    .map(toContentItem);
}

export async function getContent(id: string): Promise<ContentItem | undefined> {
  const row = await getRow<Row>("content_items", id);
  return row ? toContentItem(row) : undefined;
}

export async function upsertContent(item: ContentItem): Promise<void> {
  await putRow("content_items", {
    id: item.id,
    collection: item.collection,
    sort: item.sort,
    active: item.active ? 1 : 0,
    common: JSON.stringify(item.common ?? {}),
    ar: JSON.stringify(item.ar ?? {}),
    en: JSON.stringify(item.en ?? {}),
  });
}

export async function deleteContent(id: string, collection: string): Promise<void> {
  const existing = await getContent(id);
  if (!existing || existing.collection !== collection) return;
  await deleteRow("content_items", id);
}

/* ---------------------------------- users ----------------------------------- */

export type UserRow = {
  id: number;
  role: "customer" | "admin";
  name: string;
  email: string;
  phone: string;
  password_salt: string;
  password_hash: string;
  blocked: number;
  session_version?: number;
  created_at: string;
};

export async function findUserById(id: number): Promise<UserRow | undefined> {
  return getRow<UserRow>("users", id);
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await allRows<UserRow>("users");
  return rows.find((row) => row.email === email);
}

export async function findAdmin(): Promise<UserRow | undefined> {
  const rows = await allRows<UserRow>("users");
  return rows.find((row) => row.role === "admin");
}

export async function createUser(input: {
  role: "customer" | "admin";
  name: string;
  email: string;
  phone: string;
  password_salt: string;
  password_hash: string;
}): Promise<UserRow> {
  const id = await nextId("users");
  const row: UserRow = { ...input, id, blocked: 0, session_version: 0, created_at: nowIso() };
  await putRow("users", row);
  return row;
}

export async function updateUser(id: number, patch: Partial<UserRow>): Promise<UserRow | undefined> {
  return patchRow<UserRow>("users", id, patch);
}

export async function listCustomerRows(): Promise<UserRow[]> {
  const rows = await allRows<UserRow>("users");
  return rows.filter((row) => row.role === "customer");
}

export type CustomerSummary = {
  id: number;
  activeSubscriptions: number;
  spent: number;
  endsAt: string | null;
};

/** Per-customer rollups, computed in JS now that the tables are Redis hashes. */
export async function customerSummaries(now: string): Promise<Map<number, CustomerSummary>> {
  const [subs, payments] = await Promise.all([allRows<Row>("subscriptions"), allRows<Row>("payments")]);
  const out = new Map<number, CustomerSummary>();

  for (const sub of subs) {
    if (sub.status !== "active" || String(sub.ends_at) <= now) continue;
    const entry =
      out.get(Number(sub.user_id)) ??
      ({ id: Number(sub.user_id), activeSubscriptions: 0, spent: 0, endsAt: null } as CustomerSummary);
    entry.activeSubscriptions += 1;
    if (!entry.endsAt || String(sub.ends_at) > entry.endsAt) entry.endsAt = String(sub.ends_at);
    out.set(entry.id, entry);
  }

  for (const payment of payments) {
    if (!["approved", "auto_approved"].includes(String(payment.status))) continue;
    const userId = Number(payment.user_id);
    const entry =
      out.get(userId) ?? ({ id: userId, activeSubscriptions: 0, spent: 0, endsAt: null } as CustomerSummary);
    entry.spent += Number(payment.amount ?? 0);
    out.set(userId, entry);
  }

  return out;
}

/* ------------------------------- subscriptions ------------------------------ */

export type SubscriptionRow = {
  id: number;
  user_id: number;
  program_id: string;
  program_name: string;
  payment_id: number | null;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
};

export async function listSubscriptionsByUser(userId: number): Promise<SubscriptionRow[]> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  return rows
    .filter((row) => Number(row.user_id) === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function findActiveSubscription(
  userId: number,
  programId: string,
  now: string
): Promise<SubscriptionRow | undefined> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  return rows
    .filter(
      (row) =>
        Number(row.user_id) === userId &&
        row.program_id === programId &&
        row.status === "active" &&
        String(row.ends_at) > now
    )
    .sort((a, b) => String(b.ends_at).localeCompare(String(a.ends_at)))[0];
}

export async function updateSubscriptionEnds(id: number, endsAt: string): Promise<void> {
  await patchRow("subscriptions", id, { ends_at: endsAt });
}

export async function createSubscription(input: {
  user_id: number;
  program_id: string;
  program_name: string;
  payment_id: number | null;
  starts_at: string;
  ends_at: string;
}): Promise<number> {
  const id = await nextId("subscriptions");
  await putRow("subscriptions", { ...input, id, status: "active", created_at: nowIso() });
  return id;
}

export async function expireOldSubscriptions(now: string): Promise<void> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  for (const row of rows) {
    if (row.status === "active" && String(row.ends_at) <= now) {
      await patchRow("subscriptions", row.id, { status: "expired" });
    }
  }
}

export async function findSubscriptionByPayment(paymentId: number): Promise<SubscriptionRow | undefined> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  return rows.find((row) => Number(row.payment_id) === paymentId);
}

export async function setSubscriptionStatus(id: number, status: string): Promise<void> {
  await patchRow("subscriptions", id, { status });
}

export async function allSubscriptions(): Promise<SubscriptionRow[]> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function countActiveSubscriptions(now: string): Promise<number> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  return rows.filter((row) => row.status === "active" && String(row.ends_at) > now).length;
}

export async function countExpiringSoon(now: string, horizon: string): Promise<number> {
  const rows = await allRows<SubscriptionRow>("subscriptions");
  return rows.filter(
    (row) => row.status === "active" && String(row.ends_at) > now && String(row.ends_at) <= horizon
  ).length;
}

/* --------------------------------- payments --------------------------------- */

export type PaymentRow = {
  id: number;
  user_id: number;
  program_id: string;
  program_name: string;
  amount: number;
  days: number;
  method: string;
  sender: string;
  reference: string;
  screenshot: string;
  screenshot_sha: string;
  reference_key: string;
  status: string;
  risk: string;
  note: string;
  created_at: string;
  reviewed_at: string | null;
  screenshot_width?: number | null;
  screenshot_height?: number | null;
};

export async function listPaymentsByUser(userId: number): Promise<PaymentRow[]> {
  const rows = await allRows<PaymentRow>("payments");
  return rows
    .filter((row) => Number(row.user_id) === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function getPayment(id: number): Promise<PaymentRow | undefined> {
  return getRow<PaymentRow>("payments", id);
}

export async function findPaymentBySha(sha: string): Promise<PaymentRow | undefined> {
  const rows = await allRows<PaymentRow>("payments");
  return rows.find((row) => row.screenshot_sha === sha);
}

export async function findPaymentByReferenceKey(key: string): Promise<PaymentRow | undefined> {
  const rows = await allRows<PaymentRow>("payments");
  return rows.find((row) => row.reference_key === key);
}

export async function createPayment(input: Omit<PaymentRow, "id">): Promise<number> {
  const id = await nextId("payments");
  await putRow("payments", { ...input, id });
  return id;
}

export async function updatePayment(
  id: number,
  patch: Partial<PaymentRow>
): Promise<PaymentRow | undefined> {
  return patchRow<PaymentRow>("payments", id, patch);
}

export async function allPayments(): Promise<PaymentRow[]> {
  const rows = await allRows<PaymentRow>("payments");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

const APPROVED = ["approved", "auto_approved"];

export async function paymentStats() {
  const rows = await allRows<PaymentRow>("payments");
  const today = nowIso().slice(0, 10);
  const month = today.slice(0, 7);

  const approved = rows.filter((row) => APPROVED.includes(String(row.status)));
  const sum = (list: PaymentRow[]) => list.reduce((total, row) => total + Number(row.amount ?? 0), 0);

  const monthly: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - i);
    const key = date.toISOString().slice(0, 7);
    monthly.push({ month: key, total: sum(approved.filter((row) => String(row.created_at).slice(0, 7) === key)) });
  }

  return {
    revenue: sum(approved),
    todayRevenue: sum(approved.filter((row) => String(row.created_at).slice(0, 10) === today)),
    monthRevenue: sum(approved.filter((row) => String(row.created_at).slice(0, 7) === month)),
    pendingCount: rows.filter((row) => row.status === "pending").length,
    pendingAmount: sum(rows.filter((row) => row.status === "pending")),
    approved: rows.filter((row) => row.status === "approved").length,
    auto: rows.filter((row) => row.status === "auto_approved").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
    monthly,
  };
}

/* --------------------------------- messages --------------------------------- */

export type MessageRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  goal: string;
  body: string;
  read: number;
  created_at: string;
};

export async function createMessage(input: {
  name: string;
  phone: string;
  email: string;
  goal: string;
  body: string;
}): Promise<void> {
  const id = await nextId("messages");
  await putRow("messages", { ...input, id, read: 0, created_at: nowIso() });
}

export async function listMessages(limit = 500): Promise<MessageRow[]> {
  const rows = await allRows<MessageRow>("messages");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
}

export async function setMessageRead(id: number, read: boolean): Promise<void> {
  await patchRow("messages", id, { read: read ? 1 : 0 });
}

export async function deleteMessage(id: number): Promise<void> {
  await deleteRow("messages", id);
}

export async function countUnreadMessages(): Promise<number> {
  const rows = await allRows<MessageRow>("messages");
  return rows.filter((row) => !row.read).length;
}

/* ---------------------------------- media ----------------------------------- */

export type MediaRow = {
  id: number;
  url: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
};

export async function createMedia(input: Omit<MediaRow, "id">): Promise<number> {
  const id = await nextId("media");
  await putRow("media", { ...input, id });
  return id;
}

export async function listMedia(limit = 200): Promise<MediaRow[]> {
  const rows = await allRows<MediaRow>("media");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
}

export async function getMedia(id: number): Promise<MediaRow | undefined> {
  return getRow<MediaRow>("media", id);
}

export async function deleteMedia(id: number): Promise<void> {
  await deleteRow("media", id);
}

/* --------------------------------- file store -------------------------------- */

type StoredFile = { mime: string; data: string };

/**
 * Binary payloads (payment screenshots, media-library images) are base64 JSON
 * blobs in Redis. Upstash caps a single value at 10 MB, and Vercel caps a
 * serverless request body at 4.5 MB, so the wire limit stays at 4 MB.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function putFile(name: string, buffer: Buffer, mime: string): Promise<void> {
  const payload: StoredFile = { mime, data: buffer.toString("base64") };
  if (JSON.stringify(payload).length > 9_500_000) {
    throw new Error("FILE_TOO_LARGE");
  }
  await redis.set(fileKey(name), JSON.stringify(payload));
}

export async function getFile(name: string): Promise<{ mime: string; buffer: Buffer } | undefined> {
  const raw = await redis.get(fileKey(name));
  if (!raw) return undefined;
  const parsed = safeJson<StoredFile | null>(String(raw), null);
  if (!parsed?.data) return undefined;
  return { mime: parsed.mime || "application/octet-stream", buffer: Buffer.from(parsed.data, "base64") };
}

export async function deleteFile(name: string): Promise<void> {
  await redis.del(fileKey(name));
}

/* ----------------------------------- seed ----------------------------------- */

const explicitAdminPassword = process.env.ADMIN_PASSWORD;
const seedPassword = explicitAdminPassword || randomBytes(18).toString("base64url");
const seedEmail = (process.env.ADMIN_EMAIL || "admin@drmostafayoussef.com").toLowerCase();

function parseAmount(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return Number.parseInt(digits || "0", 10);
}

async function seedAdmin() {
  if (await findAdmin()) return;
  const { salt, hash } = hashPassword(seedPassword);
  await createUser({
    role: "admin",
    name: "د. مصطفى يوسف",
    email: seedEmail,
    phone: "01004334487",
    password_salt: salt,
    password_hash: hash,
  });

  if (!explicitAdminPassword) {
    // Never ship a documented default password. On a fresh database we create
    // a random one and leave it in a git-ignored file (Vercel: /tmp, see logs).
    const file = path.join(DATA_DIR, "admin-password.txt");
    writeFileSync(file, `email: ${seedEmail}\npassword: ${seedPassword}\n`, { mode: 0o600 });
    console.log(`[db] Seeded admin ${seedEmail}; password written to ${file}`);
  }
}

async function seedContent() {
  if ((await allRows("content_items")).length > 0) return;

  const programImages = [images.gym, images.hero, images.dumbbells];

  const add = (item: ContentItem) => upsertContent(item);

  for (const [index, program] of ar.programs.entries()) {
    const other = en.programs[index];
    await add({
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
  }

  for (const [index, service] of ar.services.entries()) {
    const other = en.services[index];
    await add({
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
  }

  for (const [index, item] of ar.testimonials.entries()) {
    const other = en.testimonials[index];
    await add({
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
  }

  for (const [index, item] of ar.results.entries()) {
    const other = en.results[index];
    await add({
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
  }

  for (const [index, post] of ar.posts.entries()) {
    const other = en.posts.find((entry) => entry.slug === post.slug);
    await add({
      id: `post-${post.slug}`,
      collection: "posts",
      sort: index,
      active: true,
      common: { slug: post.slug, date: post.date, readTime: post.readTime, cover: post.cover },
      ar: { title: post.title, excerpt: post.excerpt, category: post.category, body: post.body },
      en: {
        title: other?.title ?? post.title,
        excerpt: other?.excerpt ?? post.excerpt,
        category: other?.category ?? post.category,
        body: other?.body ?? post.body,
      },
    });
  }

  for (const [index, item] of ar.faq.items.entries()) {
    const other = en.faq.items[index];
    await add({
      id: `faq-${index + 1}`,
      collection: "faqs",
      sort: index,
      active: true,
      common: {},
      ar: { q: item.q, a: item.a },
      en: { q: other?.q ?? item.q, a: other?.a ?? item.a },
    });
  }

  for (const [index, item] of ar.about.creds.entries()) {
    const other = en.about.creds[index];
    await add({
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
  }
}

async function seedUniqueClaimMarkers() {
  // Backfill the atomic claim markers for receipts submitted before the
  // reservation keys existed, so an old screenshot can never be reused.
  const payments = await allRows<{ screenshot_sha?: string; reference_key?: string }>("payments");
  for (const payment of payments) {
    if (payment.screenshot_sha) await redis.set(uniqueKey(`shot:${payment.screenshot_sha}`), "1", { nx: true });
    if (payment.reference_key) await redis.set(uniqueKey(`ref:${payment.reference_key}`), "1", { nx: true });
  }
}

async function seed() {
  await seedAdmin();
  await seedContent();
  await seedUniqueClaimMarkers();
  if (!(await getSetting<SiteSettings | null>("site", null))) {
    await saveSettings(defaultSettings);
  }
}

/** Runs once per cold start; idempotent, so concurrent instances are safe. */
await seed();
