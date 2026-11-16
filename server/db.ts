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

/* --------------------------------- sessions -------------------------------- */

const sessionKey = (id: string) => `${PREFIX}sess:${id}`;
const userSessionsKey = (userId: number) => `${PREFIX}usess:${userId}`;
const challengeKey = (id: string) => `${PREFIX}chal:${id}`;
const failKey = (bucket: string) => `${PREFIX}fail:${bucket}`;

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionRecord = {
  id: string;
  user_id: number;
  created_at: string;
  last_seen: string;
  ip: string;
  user_agent: string;
};

/**
 * Sessions are server-side records, not just signed cookies, so a stolen or
 * forgotten device can be revoked without invalidating every other login.
 */
export async function saveSession(record: SessionRecord): Promise<void> {
  await redis.set(sessionKey(record.id), JSON.stringify(record), { ex: SESSION_TTL_SECONDS });
  await redis.sadd(userSessionsKey(record.user_id), record.id);
  await redis.expire(userSessionsKey(record.user_id), SESSION_TTL_SECONDS);
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  return parseRow<SessionRecord>(await redis.get(sessionKey(id)));
}

/** Sliding expiry, but writes at most once every five minutes per session. */
export async function touchSession(record: SessionRecord): Promise<void> {
  if (Date.now() - Date.parse(record.last_seen) < 5 * 60_000) return;
  const next = { ...record, last_seen: nowIso() };
  await redis.set(sessionKey(record.id), JSON.stringify(next), { ex: SESSION_TTL_SECONDS });
}

export async function revokeSession(id: string): Promise<void> {
  const record = await getSession(id);
  await redis.del(sessionKey(id));
  if (record) await redis.srem(userSessionsKey(record.user_id), id);
}

export async function listSessions(userId: number): Promise<SessionRecord[]> {
  const ids = ((await redis.smembers(userSessionsKey(userId))) ?? []) as string[];
  const records = await Promise.all(ids.map((id) => getSession(id)));
  const live: SessionRecord[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    const record = records[index];
    if (record) live.push(record);
    else await redis.srem(userSessionsKey(userId), ids[index]);
  }
  return live.sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)));
}

export async function revokeAllSessions(userId: number, exceptId?: string): Promise<number> {
  const ids = ((await redis.smembers(userSessionsKey(userId))) ?? []) as string[];
  let removed = 0;
  for (const id of ids) {
    if (id === exceptId) continue;
    await redis.del(sessionKey(id));
    await redis.srem(userSessionsKey(userId), id);
    removed += 1;
  }
  return removed;
}

/* ------------------------------ login challenges --------------------------- */

export type LoginChallenge = { user_id: number; attempts: number };

/** Short-lived proof that the password step passed, awaiting the TOTP code. */
export async function createLoginChallenge(userId: number): Promise<string> {
  const id = randomBytes(24).toString("base64url");
  await redis.set(challengeKey(id), JSON.stringify({ user_id: userId, attempts: 0 }), { ex: 300 });
  return id;
}

export async function getLoginChallenge(id: string): Promise<LoginChallenge | undefined> {
  return parseRow<LoginChallenge>(await redis.get(challengeKey(id)));
}

export async function bumpLoginChallenge(id: string): Promise<number> {
  const record = await getLoginChallenge(id);
  if (!record) return 0;
  record.attempts += 1;
  await redis.set(challengeKey(id), JSON.stringify(record), { ex: 300 });
  return record.attempts;
}

export async function deleteLoginChallenge(id: string): Promise<void> {
  await redis.del(challengeKey(id));
}

/* ------------------------------ failed attempts ---------------------------- */

/** Persistent counter used for account lockout (separate from request limits). */
export async function getFailedAttempts(bucket: string): Promise<number> {
  return Number(await redis.get(failKey(bucket))) || 0;
}

export async function bumpFailedAttempts(bucket: string, seconds = 900): Promise<number> {
  const key = failKey(bucket);
  const count = Number(await redis.incr(key));
  if (count === 1) await redis.expire(key, seconds);
  return count;
}

export async function clearFailedAttempts(bucket: string): Promise<void> {
  await redis.del(failKey(bucket));
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
    // Receipt screenshots are verified by the rule-based checks in
    // POST /api/payments (wallet number, exact amount, reference sanity,
    // image shape, no duplicates). A clean receipt activates instantly;
    // anything else still drops into manual review.
    autoApprove: true,
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

/**
 * Deletes a single audit entry. Deleting an audit row never writes a new audit
 * row, otherwise the log would re-populate itself with its own deletion.
 */
export async function deleteAudit(id: string | number): Promise<boolean> {
  const rows = await allRows<Row>("audit_log");
  const target = rows.find((row) => String(row.id) === String(id));
  if (!target) return false;
  await deleteRow("audit_log", target.id);
  return true;
}

/** Clears the whole audit log and reports how many entries were removed. */
export async function clearAudit(): Promise<number> {
  const rows = await allRows<Row>("audit_log");
  for (const row of rows) await deleteRow("audit_log", row.id);
  return rows.length;
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
  role: "customer" | "admin" | "staff";
  name: string;
  email: string;
  phone: string;
  password_salt: string;
  password_hash: string;
  blocked: number;
  session_version?: number;
  totp_secret?: string | null;
  totp_pending?: string | null;
  totp_enabled?: number;
  /** JSON array of SHA-256 hashes; the plaintext codes are shown once. */
  totp_backup?: string | null;
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

export async function listUsers(): Promise<UserRow[]> {
  return allRows<UserRow>("users");
}

export async function createUser(input: {
  role: "customer" | "admin" | "staff";
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
  coupon?: string | null;
  discount?: number;
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

/* ------------------------------ doctor ↔ patient --------------------------- */

export type CoachMessageRow = {
  id: number;
  user_id: number;
  sender_role: "doctor" | "customer";
  body: string;
  media_name: string;
  media_mime: string;
  media_kind: "image" | "video" | "";
  video_url: string;
  read_by_customer: number;
  read_by_doctor: number;
  created_at: string;
};

export async function createCoachMessage(input: {
  user_id: number;
  sender_role: "doctor" | "customer";
  body: string;
  media_name?: string;
  media_mime?: string;
  media_kind?: "image" | "video" | "";
  video_url?: string;
}): Promise<number> {
  const id = await nextId("coach_messages");
  const fromDoctor = input.sender_role === "doctor";
  await putRow("coach_messages", {
    ...input,
    id,
    body: input.body ?? "",
    media_name: input.media_name ?? "",
    media_mime: input.media_mime ?? "",
    media_kind: input.media_kind ?? "",
    video_url: input.video_url ?? "",
    // A doctor's message starts unread for the customer, and vice versa.
    read_by_customer: fromDoctor ? 0 : 1,
    read_by_doctor: fromDoctor ? 1 : 0,
    created_at: nowIso(),
  });
  return id;
}

export async function listCoachMessagesByUser(userId: number): Promise<CoachMessageRow[]> {
  const rows = await allRows<CoachMessageRow>("coach_messages");
  return rows
    .filter((row) => Number(row.user_id) === userId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || Number(a.id) - Number(b.id));
}

export async function allCoachMessages(): Promise<CoachMessageRow[]> {
  const rows = await allRows<CoachMessageRow>("coach_messages");
  return rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export async function getCoachMessage(id: number): Promise<CoachMessageRow | undefined> {
  return getRow<CoachMessageRow>("coach_messages", id);
}

/** Marks the other side's messages as seen when a conversation is opened. */
export async function markCoachRead(userId: number, viewer: "doctor" | "customer"): Promise<void> {
  const rows = await allRows<CoachMessageRow>("coach_messages");
  for (const row of rows) {
    if (Number(row.user_id) !== userId) continue;
    if (viewer === "customer" && row.sender_role === "doctor" && !row.read_by_customer) {
      await patchRow("coach_messages", row.id, { read_by_customer: 1 });
    }
    if (viewer === "doctor" && row.sender_role === "customer" && !row.read_by_doctor) {
      await patchRow("coach_messages", row.id, { read_by_doctor: 1 });
    }
  }
}

export async function countUnreadCoachForDoctor(): Promise<number> {
  const rows = await allRows<CoachMessageRow>("coach_messages");
  return rows.filter((row) => row.sender_role === "customer" && !row.read_by_doctor).length;
}

export async function countUnreadCoachForCustomer(userId: number): Promise<number> {
  const rows = await allRows<CoachMessageRow>("coach_messages");
  return rows.filter(
    (row) => Number(row.user_id) === userId && row.sender_role === "doctor" && !row.read_by_customer
  ).length;
}

/* ---------------------------------- media ----------------------------------- */

export type MediaRow = {
  id: number;
  url: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
  width?: number | null;
  height?: number | null;
  uploaded_by?: number | null;
  uploaded_by_name?: string;
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

/* ------------------------------ content assets ------------------------------ */

/**
 * Files the doctor attaches either to a plan (shown on that plan's page and to
 * its subscribers) or to one client only (private, visible in their account).
 * Bytes live in the shared file store; the row holds only metadata.
 */
export type AssetOwnerType = "program" | "customer";

export type AssetRow = {
  id: number;
  owner_type: AssetOwnerType;
  owner_id: string;
  kind: string;
  url: string;
  storage: string;
  filename: string;
  mime: string;
  size: number;
  title: string;
  note: string;
  sort: number;
  visibility: string;
  seen_at?: string | null;
  created_at: string;
};

export async function createAsset(input: Omit<AssetRow, "id">): Promise<AssetRow> {
  const id = await nextId("assets");
  const row: AssetRow = { ...input, id };
  await putRow("assets", row);
  return row;
}

export async function allAssets(): Promise<AssetRow[]> {
  const rows = await allRows<AssetRow>("assets");
  return rows.sort((a, b) => Number(a.sort) - Number(b.sort) || Number(a.id) - Number(b.id));
}

export async function listAssets(ownerType: AssetOwnerType, ownerId: string): Promise<AssetRow[]> {
  return (await allAssets())
    .filter((row) => row.owner_type === ownerType && String(row.owner_id) === String(ownerId))
    .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || Number(a.id) - Number(b.id));
}

export async function getAsset(id: number): Promise<AssetRow | undefined> {
  return getRow<AssetRow>("assets", id);
}

export async function updateAsset(id: number, patch: Partial<AssetRow>): Promise<AssetRow | undefined> {
  return patchRow<AssetRow>("assets", id, patch);
}

export async function deleteAsset(id: number): Promise<void> {
  await deleteRow("assets", id);
}

/** Marks every file the doctor uploaded for this client as opened. */
export async function markCustomerFilesSeen(userId: number): Promise<void> {
  const rows = await listAssets("customer", String(userId));
  const stamp = nowIso();
  for (const row of rows) {
    if (!row.seen_at) await patchRow<AssetRow>("assets", row.id, { seen_at: stamp });
  }
}

/* ------------------------------- client plan ------------------------------- */

/** Measurements, macro targets and medical notes the doctor keeps per client. */
export type ClientPlanRow = {
  id: number;
  user_id: number;
  height_cm: number | null;
  start_weight: number | null;
  current_weight: number | null;
  target_weight: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  goal: string;
  medical_notes: string;
  notes: string;
  updated_at: string;
};

export async function getClientPlan(userId: number): Promise<ClientPlanRow | undefined> {
  return getRow<ClientPlanRow>("client_plans", userId);
}

export async function saveClientPlan(row: ClientPlanRow): Promise<void> {
  await putRow("client_plans", row);
}

/* --------------------------------- check-ins -------------------------------- */

export type CheckinRow = {
  id: number;
  user_id: number;
  weight: number | null;
  note: string;
  doctor_note: string;
  reviewed: number;
  photo: string;
  created_at: string;
};

export async function createCheckin(input: Omit<CheckinRow, "id">): Promise<CheckinRow> {
  const id = await nextId("checkins");
  const row: CheckinRow = { ...input, id };
  await putRow("checkins", row);
  return row;
}

export async function getCheckin(id: number): Promise<CheckinRow | undefined> {
  return getRow<CheckinRow>("checkins", id);
}

export async function listCheckinsByUser(userId: number): Promise<CheckinRow[]> {
  const rows = await allRows<CheckinRow>("checkins");
  return rows
    .filter((row) => Number(row.user_id) === Number(userId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function allCheckins(): Promise<CheckinRow[]> {
  const rows = await allRows<CheckinRow>("checkins");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function updateCheckin(id: number, patch: Partial<CheckinRow>): Promise<CheckinRow | undefined> {
  return patchRow<CheckinRow>("checkins", id, patch);
}

/* --------------------------------- coupons ---------------------------------- */

export type CouponRow = {
  id: number;
  code: string;
  kind: "percent" | "amount";
  value: number;
  max_uses: number;
  used: number;
  expires_at: string | null;
  active: number;
  created_at: string;
};

export async function listCoupons(): Promise<CouponRow[]> {
  const rows = await allRows<CouponRow>("coupons");
  return rows.sort((a, b) => Number(b.id) - Number(a.id));
}

export async function findCouponByCode(code: string): Promise<CouponRow | undefined> {
  const needle = code.trim().toUpperCase();
  if (!needle) return undefined;
  const rows = await allRows<CouponRow>("coupons");
  return rows.find((row) => String(row.code).toUpperCase() === needle);
}

export async function createCoupon(input: Omit<CouponRow, "id" | "used" | "created_at">): Promise<CouponRow> {
  const id = await nextId("coupons");
  const row: CouponRow = { ...input, id, used: 0, created_at: nowIso() };
  await putRow("coupons", row);
  return row;
}

export async function updateCoupon(id: number, patch: Partial<CouponRow>): Promise<CouponRow | undefined> {
  return patchRow<CouponRow>("coupons", id, patch);
}

export async function deleteCoupon(id: number): Promise<void> {
  await deleteRow("coupons", id);
}

/* ------------------------------- notifications ------------------------------ */

export type NotificationRow = {
  id: number;
  user_id: number;
  kind: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  read_by_admin: number;
  created_at: string;
};

export async function createNotification(
  input: Omit<NotificationRow, "id" | "read_by_admin" | "created_at">
): Promise<NotificationRow> {
  const id = await nextId("notifications");
  const row: NotificationRow = { ...input, id, read_by_admin: 0, created_at: nowIso() };
  await putRow("notifications", row);
  return row;
}

export async function listNotifications(limit = 100): Promise<NotificationRow[]> {
  const rows = await allRows<NotificationRow>("notifications");
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
}

export async function countUnreadNotifications(): Promise<number> {
  const rows = await allRows<NotificationRow>("notifications");
  return rows.filter((row) => !row.read_by_admin).length;
}

export async function markNotificationsRead(userId?: number): Promise<void> {
  const rows = await allRows<NotificationRow>("notifications");
  for (const row of rows) {
    if (row.read_by_admin) continue;
    if (userId !== undefined && Number(row.user_id) !== Number(userId)) continue;
    await patchRow("notifications", row.id, { read_by_admin: 1 });
  }
}

/* --------------------------------- file store -------------------------------- */

/**
 * A stored file is either one base64 `data` value (small uploads: payment
 * screenshots, pilot images, chat files ≤ 4 MB) or a `parts` count that points
 * at `up:<name>:<i>` chunk values (any-size chat attachments, stored by the
 * upload session below and persisted on attach).
 */
type StoredFile = { mime: string; data?: string; parts?: number; bytes?: number };

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

/** Reads the bytes of a legacy single-value file (chunked files use getFilePart). */
export async function getFile(name: string): Promise<{ mime: string; buffer: Buffer } | undefined> {
  const raw = await redis.get(fileKey(name));
  if (!raw) return undefined;
  const parsed = safeJson<StoredFile | null>(String(raw), null);
  if (!parsed?.data) return undefined;
  return { mime: parsed.mime || "application/octet-stream", buffer: Buffer.from(parsed.data, "base64") };
}

/** Small metadata row for either storage shape; media streaming reads parts itself. */
export async function getFileMeta(name: string): Promise<StoredFile | undefined> {
  const raw = await redis.get(fileKey(name));
  if (!raw) return undefined;
  const parsed = safeJson<StoredFile | null>(String(raw), null);
  if (!parsed || typeof parsed !== "object" || (!parsed.data && !parsed.parts)) return undefined;
  return parsed;
}

export async function deleteFile(name: string): Promise<void> {
  const meta = await getFileMeta(name);
  await redis.del(fileKey(name));
  if (meta?.parts) {
    for (let index = 0; index < meta.parts; index += 1) {
      await redis.del(chatUploadPartKey(name, index));
    }
  }
}

/* --------------------------- chunked chat uploads --------------------------- */

/**
 * A chat attachment travels as a session of ≤ 3 MB chunks, so a 64 MB video
 * clears Vercel's 4.5 MB request cap by hitting it many times instead of once:
 *
 *   `um:<id>`        session metadata (owner, mime, declared bytes, chunk map)
 *   `up:<id>:<i>`    one base64 chunk (≤ 4 MB encoded, under Upstash's 10 MB cap)
 *   `ua:<id>`        claim that makes attach one-time (survives concurrent sends)
 *
 * Sessions expire after 24 h; attaching removes the TTL from the chunks and
 * writes a permanent `f:<id>` meta row, so the file then lives as long as the
 * message that references it.
 */
export type ChatUploadMeta = {
  id: string;
  userId: number;
  mime: string;
  kind: "image" | "video" | "file";
  bytes: number;
  chunks: number;
  partBytes: number[];
  createdAt: string;
};

const chatUploadKey = (id: string) => `${PREFIX}um:${id}`;
const chatUploadPartKey = (id: string, index: number) => `${PREFIX}up:${id}:${index}`;
const chatUploadClaimKey = (id: string) => `${PREFIX}ua:${id}`;
const CHAT_UPLOAD_TTL_SECONDS = 24 * 60 * 60;
const CHAT_UPLOAD_CLAIM_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function createChatUpload(input: {
  userId: number;
  mime: string;
  kind: "image" | "video" | "file";
  bytes: number;
  chunks: number;
}): Promise<ChatUploadMeta> {
  const id = randomBytes(18).toString("base64url");
  const meta: ChatUploadMeta = { id, ...input, partBytes: [], createdAt: nowIso() };
  await redis.set(chatUploadKey(id), JSON.stringify(meta), { ex: CHAT_UPLOAD_TTL_SECONDS });
  return meta;
}

export async function getChatUpload(id: string): Promise<ChatUploadMeta | undefined> {
  const raw = await redis.get(chatUploadKey(id));
  const parsed = safeJson<ChatUploadMeta | null>(String(raw ?? ""), null);
  return parsed && parsed.id ? parsed : undefined;
}

/**
 * Stores one chunk. The chunk is written first and only then recorded in the
 * metadata, so a failed write can only leave an unreported gap — never a
 * reported chunk that is missing — which keeps retries safe.
 */
export async function putChatUploadPart(
  id: string,
  index: number,
  buffer: Buffer
): Promise<ChatUploadMeta | undefined> {
  const meta = await getChatUpload(id);
  if (!meta || index < 0 || index >= meta.chunks || buffer.length === 0) return undefined;
  await redis.set(chatUploadPartKey(id, index), buffer.toString("base64"), { ex: CHAT_UPLOAD_TTL_SECONDS });
  const partBytes = [...meta.partBytes];
  while (partBytes.length < meta.chunks) partBytes.push(0);
  partBytes[index] = buffer.length;
  const next: ChatUploadMeta = { ...meta, partBytes };
  await redis.set(chatUploadKey(id), JSON.stringify(next), { ex: CHAT_UPLOAD_TTL_SECONDS });
  return next;
}

export async function getChatUploadPart(id: string, index: number): Promise<Buffer | undefined> {
  const raw = await redis.get(chatUploadPartKey(id, index));
  if (!raw) return undefined;
  return Buffer.from(String(raw), "base64");
}

/** Only one sender may attach a given session (guards two concurrent sends). */
export async function claimChatUpload(id: string): Promise<boolean> {
  const result = await redis.set(chatUploadClaimKey(id), "1", {
    nx: true,
    ex: CHAT_UPLOAD_CLAIM_TTL_SECONDS,
  });
  return result === "OK";
}

export async function releaseChatUploadClaim(id: string): Promise<void> {
  await redis.del(chatUploadClaimKey(id));
}

/**
 * Freezes an upload: drops the TTL from every chunk and writes the permanent
 * meta row that media streaming reads. Returns false when a chunk had already
 * expired, in which case the caller releases the claim and asks for a re-upload.
 */
export async function attachChatUpload(meta: ChatUploadMeta): Promise<boolean> {
  const freeze = redis.pipeline();
  for (let index = 0; index < meta.chunks; index += 1) freeze.persist(chatUploadPartKey(meta.id, index));
  const persisted = (await freeze.exec()) as unknown[];
  if (persisted.length !== meta.chunks || persisted.some((result) => Number(result) !== 1)) return false;

  const commit = redis.pipeline();
  commit.set(fileKey(meta.id), JSON.stringify({ mime: meta.mime, parts: meta.chunks, bytes: meta.bytes }));
  commit.del(chatUploadKey(meta.id));
  await commit.exec();
  return true;
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

  const programImages = [images.gym, images.hero, images.dumbbells, images.programTransform];

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
        days: program.days ?? 30,
        popular: program.popular,
        image: programImages[index] ?? images.gym,
      },
      ar: {
        name: program.name,
        tagline: program.tagline,
        features: program.features,
        note: program.note,
        system: program.system,
      },
      en: {
        name: other?.name ?? program.name,
        tagline: other?.tagline ?? program.tagline,
        features: other?.features ?? program.features,
        note: other?.note ?? program.note,
        system: other?.system ?? program.system,
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

export async function allContentRows(): Promise<Row[]> {
  return allRows("content_items");
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

/* --------------------------- local image migration ------------------------- */

/**
 * Photography used to be hot-linked from Unsplash. Existing rows still carry
 * those URLs, so a cold start rewrites them to the bundled WebP files. The
 * migration is idempotent and covers the hero setting plus content covers.
 */
const LOCAL_IMAGE_BY_PHOTO: Record<string, string> = {
  "1571019613454-1cb2f99b2d8b": "/media/hero.webp",
  "1517836357463-d25dfeac3438": "/media/hero-alt.webp",
  "1534438327276-14e5300c3a48": "/media/gym.webp",
  "1526506118085-60ce8714f8c5": "/media/about.webp",
  "1583454110551-21f2fa2afe61": "/media/dumbbells.webp",
  "1594381898411-846e7d193883": "/media/coach.webp",
  "1541534741688-6078c6bfb5c5": "/media/gym-dark.webp",
  "1571731956672-f2b94d7dd0cb": "/media/gym-man.webp",
  "1581009146145-b5ef050c2e1e": "/media/athlete.webp",
  "1550345332-09e3ac987658": "/media/woman.webp",
  "1518611012118-696072aa579a": "/media/stretching.webp",
  "1546069901-ba9599a7e63c": "/media/food.webp",
  "1490645935967-10de6ba17061": "/media/food-alt.webp",
  "1540497077202-7c8a3999166f": "/media/meal-prep.webp",
  "1512621776951-a57141f2eefd": "/media/salad.webp",
  "1556911220-bff31c812dba": "/media/kitchen.webp",
  "1556742049-0cfed4f6a45d": "/media/payment.webp",
  "1512941937669-90a1b58e7e9c": "/media/phone.webp",
  "1551288049-bebda4e38f71": "/media/dashboard.webp",
  "1498837167922-ddd27525d352": "/media/blog-nutrition.webp",
  "1541781774459-bb2af2f05b55": "/media/blog-sleep.webp",
  "1507003211169-0a1dd7228f2d": "/media/avatar-1.webp",
  "1494790108377-be9c29b29330": "/media/avatar-2.webp",
  "1500648767791-00dcc994a43e": "/media/avatar-3.webp",
  "1534528741775-53994a69daeb": "/media/avatar-4.webp",
  "1506794778202-cad84cf45f1d": "/media/avatar-5.webp",
};

function migratedImage(value: unknown): string | null {
  if (typeof value !== "string" || value.startsWith("/media/")) return null;
  const match = /photo-([0-9]+-[a-z0-9]+)/i.exec(value);
  if (!match) return null;
  return LOCAL_IMAGE_BY_PHOTO[match[1]] ?? "/media/hero.webp";
}

async function migrateLocalImages() {
  const settings = await getSettings();
  const hero = migratedImage(settings.hero.image);
  if (hero) {
    settings.hero.image = hero;
    await saveSettings(settings);
  }

  for (const row of await allRows<Row>("content_items")) {
    const common = safeJson<Record<string, unknown>>(row.common, {});
    let touched = false;
    for (const key of ["image", "cover", "before", "after"]) {
      const next = migratedImage(common[key]);
      if (next) {
        common[key] = next;
        touched = true;
      }
    }
    if (touched) await putRow("content_items", { ...row, common: JSON.stringify(common) });
  }
}

/* --------------------------- program system migration ---------------------- */

/**
 * The plan content gained a structured program (weeks, meals, workouts). Rows
 * seeded before that change have no `system` key, so backfill it from the
 * bundled defaults. Items that already carry a system — including plans an
 * admin created — are never overwritten.
 */
/**
 * The free-trial plan was demo tooling: every real client now buys a package,
 * so any plan flagged as a trial is removed on each cold start.
 */
async function removeTrialProgram() {
  for (const row of await allRows<Row>("content_items")) {
    if (String(row.collection) !== "programs") continue;
    const common = safeJson<Record<string, unknown>>(row.common, {});
    if (String(row.id) === "prog-trial" || common.trial === true) await deleteRow("content_items", row.id);
  }
}

/**
 * The internal "preview plan" (and any plan an older version flagged as a
 * preview) is demo tooling, not a sellable plan: it is removed on every cold
 * start so the site only ever lists real packages.
 */
async function removePreviewProgram() {
  for (const row of await allRows<Row>("content_items")) {
    if (String(row.collection) !== "programs") continue;
    const common = safeJson<Record<string, unknown>>(row.common, {});
    if (String(row.id) === "prog-preview" || common.preview === true) {
      await deleteRow("content_items", row.id);
      continue;
    }
    if ("preview" in common) {
      delete common.preview;
      await putRow("content_items", { ...row, common: JSON.stringify(common) });
    }
  }
}

/**
 * The first release shipped sample testimonials, results and credentials so the
 * layout could be reviewed. They are not real client data: remove exactly those
 * seeded ids on every cold start. Anything the doctor creates from the dashboard
 * gets a generated id, so real content is never touched.
 */
async function removeDemoContent() {
  const demoIds = new Set<string>([
    "tst-1",
    "tst-2",
    "tst-3",
    "tst-4",
    "tst-5",
    "res-1",
    "res-2",
    "res-3",
    "res-4",
    "cred-1",
    "cred-2",
    "cred-3",
    "cred-4",
  ]);
  for (const row of await allRows<Row>("content_items")) {
    if (demoIds.has(String(row.id))) await deleteRow("content_items", row.id);
  }
}

async function migrateProgramSystems() {
  for (const row of await allRows<Row>("content_items")) {
    if (String(row.collection) !== "programs") continue;
    const seedAr = ar.programs.find((program) => `prog-${program.id}` === String(row.id));
    if (!seedAr) continue;
    const seedEn = en.programs.find((program) => program.id === seedAr.id) ?? seedAr;
    const arData = safeJson<Record<string, unknown>>(row.ar, {});
    const enData = safeJson<Record<string, unknown>>(row.en, {});
    let touched = false;
    if (!("system" in arData)) {
      arData.system = seedAr.system;
      touched = true;
    }
    if (!("system" in enData)) {
      enData.system = seedEn.system;
      touched = true;
    }
    if (touched) {
      await putRow("content_items", { ...row, ar: JSON.stringify(arData), en: JSON.stringify(enData) });
    }
  }
}

async function seed() {
  await seedAdmin();
  await seedContent();
  await removeTrialProgram();
  await removePreviewProgram();
  await removeDemoContent();
  await migrateProgramSystems();
  await seedUniqueClaimMarkers();
  if (!(await getSetting<SiteSettings | null>("site", null))) {
    await saveSettings(defaultSettings);
  }
  await migrateLocalImages();
}

/** Runs once per cold start; idempotent, so concurrent instances are safe. */
await seed();
