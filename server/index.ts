import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { SignJWT, jwtVerify } from "jose";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  DIST_DIR,
  MAX_UPLOAD_BYTES,
  allAssets,
  createAsset,
  createCheckin,
  createCoupon,
  createNotification,
  deleteAsset,
  deleteCoupon,
  findCouponByCode,
  getAsset,
  getCheckin,
  getClientPlan,
  listAssets,
  listCheckinsByUser,
  listCoupons,
  listNotifications,
  markCustomerFilesSeen,
  markNotificationsRead,
  updateAsset,
  updateCheckin,
  updateCoupon,
  saveClientPlan,
  type AssetOwnerType,
  type CouponRow,
  type NotificationRow,
  type AssetRow,
  type CheckinRow,
  type ClientPlanRow,
  SHOT_DIR,
  UPLOAD_DIR,
  allCoachMessages,
  allContentRows,
  allPayments,
  allSubscriptions,
  attachChatUpload,
  bumpFailedAttempts,
  bumpLoginChallenge,
  claimChatUpload,
  clearFailedAttempts,
  createChatUpload,
  createLoginChallenge,
  createCoachMessage,
  createMedia,
  createMessage,
  createPayment,
  createSubscription,
  createUser,
  customerSummaries,
  deleteContent,
  deleteFile,
  deleteLoginChallenge,
  deleteMedia,
  deleteMessage,
  expireOldSubscriptions,
  findActiveSubscription,
  findPaymentByReferenceKey,
  findPaymentBySha,
  findSubscriptionByPayment,
  findUserByEmail,
  findUserById,
  getChatUpload,
  getChatUploadPart,
  getCopyOverrides,
  getCoachMessage,
  getContent,
  getFailedAttempts,
  getJwtSecret,
  getLoginChallenge,
  getMedia,
  getSession,
  getFile,
  getFileMeta,
  getPayment,
  getRow,
  getSettings,
  putChatUploadPart,
  rateCount,
  redis,
  releaseChatUploadClaim,
  releaseOnce,
  reserveOnce,
  revokeAllSessions,
  revokeSession,
  saveSession,
  touchSession,
  countActiveSubscriptions,
  countExpiringSoon,
  countUnreadCoachForCustomer,
  countUnreadCoachForDoctor,
  countUnreadMessages,
  listCoachMessagesByUser,
  listAudit,
  clearAudit,
  deleteAudit,
  listContent,
  listCustomerRows,
  listMedia,
  listMessages,
  listPaymentsByUser,
  listSessions,
  listSubscriptionsByUser,
  listUsers,
  logAudit,
  markCoachRead,
  paymentStats,
  putFile,
  saveCopyOverrides,
  saveSettings,
  setMessageRead,
  setSubscriptionStatus,
  updatePayment,
  updateSubscriptionEnds,
  updateUser,
  upsertContent,
  type UserRow,
} from "./db";
import {
  addDays,
  checkPassword,
  hashPassword,
  int,
  nowIso,
  parseCookies,
  randomName,
  safeJson,
  sha256,
  str,
} from "./security";
import {
  generateBackupCodes,
  generateTotpSecret,
  totpUri,
  verifyBackupCode,
  verifyTotp,
} from "./totp";
import type {
  AssetKind,
  AssetVisibility,
  CheckinDTO,
  ClientPlanDTO,
  CoachMessageDTO,
  ContentItem,
  CouponDTO,
  CustomerActivityDTO,
  CustomerProgramInfo,
  CustomerSessionDTO,
  CustomerStats,
  MessageDTO,
  PublicUser,
  SiteAsset,
  SiteSettings,
} from "../shared/types";
import { CHAT_CHUNK_BYTES, CHAT_MAX_FILE_BYTES } from "../shared/types";

// Some runners inject PORT=0; fall back to the documented dev port instead of
// binding a random one the frontend proxy cannot reach.
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_COOKIE = "my_session";

/* ------------------------------ session secret ----------------------------- */

let secretPromise: Promise<Uint8Array> | null = null;
function getSecret() {
  if (!secretPromise) {
    secretPromise = getJwtSecret().then((value) => new TextEncoder().encode(value));
  }
  return secretPromise;
}

type Authed = Request & { user?: UserRow; sessionId?: string };

const app = express();
app.disable("x-powered-by");
// Vercel terminates TLS in front of the function: without this every request
// shares the same proxy IP, which turns per-IP rate limits into one global lock.
app.set("trust proxy", process.env.VERCEL || process.env.TRUST_PROXY === "1" ? 1 : false);
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (String(_req.headers["x-forwarded-proto"] ?? "").split(",")[0] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Reject cross-site state changes. SameSite=Lax already blocks most of them;
// this also covers browsers/proxies that forward the cookie anyway.
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
  try {
    if (new URL(origin).host === host) return next();
  } catch {
    /* malformed origin */
  }
  res.status(403).json({ error: "طلب غير مسموح." });
});

/* --------------------------------- helpers -------------------------------- */

const asyncRoute =
  (handler: (req: Authed, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as Authed, res, next)).catch(next);
  };

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    try {
      const pong = await redis.ping();
      res.json({ ok: pong === "PONG", redis: pong === "PONG", time: nowIso() });
    } catch {
      res.status(503).json({ ok: false, redis: false, time: nowIso() });
    }
  })
);

const toPublicUser = (row: UserRow): PublicUser => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  blocked: Boolean(row.blocked),
  createdAt: row.created_at,
});

async function resolveUser(req: Request): Promise<UserRow | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret());
    const row = await findUserById(Number(payload.sub));
    if (!row || row.blocked) return null;
    // Password changes bump this so every previously issued cookie dies.
    if (Number(payload.ver ?? 0) !== Number(row.session_version ?? 0)) return null;
    // Sessions are also records in Redis, so one device can be revoked without
    // touching the others. Tokens issued before this change have no sid and
    // are rejected, which also covers the old shared admin password.
    const sid = String(payload.sid ?? "");
    if (!sid) return null;
    const session = await getSession(sid);
    if (!session || Number(session.user_id) !== Number(row.id)) return null;
    await touchSession(session);
    (req as Authed).sessionId = sid;
    return row;
  } catch {
    return null;
  }
}

/** Reads the sid from a valid cookie even when the session was just revoked. */
async function sessionIdFromCookie(req: Request): Promise<string | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret());
    return payload.sid ? String(payload.sid) : null;
  } catch {
    return null;
  }
}

const optionalAuth = asyncRoute(async (req, _res, next) => {
  req.user = (await resolveUser(req)) ?? undefined;
  next();
});

const requireAuth = asyncRoute(async (req, res, next) => {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ error: "محتاج تسجل دخول الأول." });
    return;
  }
  req.user = user;
  next();
});

const requireAdmin = asyncRoute(async (req, res, next) => {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ error: "محتاج تسجل دخول الأول." });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "الصفحة دي للدكتور بس." });
    return;
  }
  req.user = user;
  next();
});

/** Doctor + team members: everything except settings, security, money reports. */
const requireStaff = asyncRoute(async (req, res, next) => {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ error: "محتاج تسجل دخول الأول." });
    return;
  }
  if (!["admin", "staff"].includes(user.role)) {
    res.status(403).json({ error: "الصفحة دي لفريق الموقع بس." });
    return;
  }
  req.user = user;
  next();
});

async function issueSession(res: Response, user: UserRow, req?: Request) {
  const sid = randomBytes(18).toString("base64url");
  const token = await new SignJWT({ role: user.role, ver: Number(user.session_version ?? 0), sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await getSecret());

  const created = nowIso();
  await saveSession({
    id: sid,
    user_id: Number(user.id),
    created_at: created,
    last_seen: created,
    ip: str(req?.ip ?? "", 60),
    user_agent: str(req?.headers["user-agent"] ?? "", 300),
  });

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
}

const clearSession = (res: Response) =>
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

/** Media files live in Redis, so serve them from there instead of the disk. */
app.get(
  "/uploads/:name",
  asyncRoute(async (req, res) => {
    const name = path.basename(String(req.params.name ?? ""));
    const file = await getFile(name);
    if (!file) return void res.status(404).json({ error: "الصورة غير موجودة." });
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(file.buffer);
  })
);

/* ------------------------------ rate limiting ----------------------------- */

/**
 * Redis-backed fixed-window limiter: serverless instances come and go, so an
 * in-memory Map would reset on every cold start and let brute force through.
 * On a Redis error we fail open rather than locking real users out.
 */
async function limited(bucket: string, max: number, windowMs: number) {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  const slot = Math.floor(Date.now() / windowMs);
  try {
    const count = await rateCount(`${bucket}:${slot}`, seconds);
    return count > max;
  } catch {
    return false;
  }
}

/** Optional pagination: old clients that send no `page` still get the full list. */
function pageSlice<T>(items: T[], req: Request) {
  const page = Math.max(1, int(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(5, int(req.query.pageSize, 15)));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/* --------------------------------- uploads -------------------------------- */

const imageFilter: multer.Options["fileFilter"] = (_req, file, done) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  done(null, allowed.includes(file.mimetype));
};

const shotUpload = multer({
  storage: multer.diskStorage({
    destination: SHOT_DIR,
    filename: (_req, file, done) => {
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      done(null, randomName(ext));
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: imageFilter,
});

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, done) => {
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      done(null, randomName(ext));
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: imageFilter,
});

const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CHAT_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const chatExt = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" })[mime] ?? "bin";

/** Doctor attachments: images and short video clips, kept under the serverless body limit. */
const coachUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, done) => done(null, randomName(chatExt(file.mimetype))),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, done) =>
    done(null, [...CHAT_IMAGE_TYPES, ...CHAT_VIDEO_TYPES].includes(file.mimetype)),
});

/**
 * One chunk of a large chat attachment (≤ 3 MB) stays in memory: it is base64
 * encoded into Redis right away, so there is nothing to clean up on disk.
 */
const chatChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_CHUNK_BYTES },
  fileFilter: (_req, file, done) =>
    done(null, [...CHAT_IMAGE_TYPES, ...CHAT_VIDEO_TYPES].includes(file.mimetype)),
});

/**
 * Reject obviously oversized bodies from the Content-Length header before
 * multer starts streaming, so the client gets a clean 413 instead of a reset
 * connection halfway through a 5 MB upload.
 */
function bodyLimitGuard(limitBytes: number, message: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const length = Number(req.headers["content-length"] ?? 0);
    if (Number.isFinite(length) && length > limitBytes + 64 * 1024) {
      res.status(413).json({ error: message });
      return;
    }
    next();
  };
}

const contentLengthGuard = bodyLimitGuard(
  MAX_UPLOAD_BYTES,
  `حجم الصورة كبير. الحد ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجا.`
);

const chunkLengthGuard = bodyLimitGuard(
  CHAT_CHUNK_BYTES,
  `حجم الجزء كبير. الحد ${Math.round(CHAT_CHUNK_BYTES / 1024 / 1024)} ميجا.`
);

/** Magic-byte checks work on the first bytes, so chunks and files share them. */
function looksLikeVideo(head: Buffer) {
  const mp4 = head.length >= 8 && head.subarray(4, 8).toString() === "ftyp";
  const webm = head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  return mp4 || webm;
}

function looksLikeImage(head: Buffer) {
  const jpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png =
    head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    head.length >= 12 && head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP";
  return jpeg || png || webp;
}

function isRealVideo(filePath: string) {
  try {
    return looksLikeVideo(readFileSync(filePath).subarray(0, 12));
  } catch {
    return false;
  }
}

function isRealImage(filePath: string) {
  try {
    return looksLikeImage(readFileSync(filePath).subarray(0, 32));
  } catch {
    return false;
  }
}

/**
 * Parses a single `bytes=…` range. Returns null for "send the whole file"
 * (no header, or a multi-range request we answer whole) and "invalid" when the
 * range falls outside the file, so the caller can reply 416.
 */
function parseByteRange(
  header: string | undefined,
  total: number
): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;
  if (total <= 0) return "invalid";
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = Number(match[1]);
  let end = match[2] === "" ? total - 1 : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (end >= total) end = total - 1;
  if (start >= total || start > end) return "invalid";
  return { start, end };
}

/** Reads intrinsic image dimensions from JPEG/PNG/WebP headers without extra dependencies. */
function imageSize(filePath: string): { width: number | null; height: number | null } {
  try {
    const buffer = readFileSync(filePath);
    if (buffer.length < 24) return { width: null, height: null };

    // PNG: width/height are big-endian uint32 at bytes 16..24
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // WEBP (VP8 / VP8L / VP8X)
    if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") {
      const format = buffer.subarray(12, 16).toString();
      if (format === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      if (format === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      if (format === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return { width: null, height: null };
    }

    // JPEG: walk the marker segments until a Start-Of-Frame marker.
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      offset += 2 + Math.max(length, 2);
    }
    return { width: null, height: null };
  } catch {
    return { width: null, height: null };
  }
}

/* ------------------------------- subscriptions ---------------------------- */

async function activateSubscription(
  user: UserRow,
  program: ContentItem,
  paymentId: number | null,
  daysOverride?: number
) {
  const days = Math.max(1, daysOverride ?? int(program.common.days, 30));
  const programName = String(program.ar?.name ?? program.id);
  const active = await findActiveSubscription(user.id, program.id, nowIso());

  const start = active ? new Date(active.ends_at) : new Date();
  const end = addDays(start, days);

  if (active) {
    await updateSubscriptionEnds(active.id, end.toISOString());
    await notifyCustomer(
      user.id,
      "subscription",
      "تم تجديد باقتك",
      `باقة «${programName}» اتفعّلت لحد ${end.toLocaleDateString("ar-EG")}.`
    );
    return active.id;
  }

  const id = await createSubscription({
    user_id: user.id,
    program_id: program.id,
    program_name: programName,
    payment_id: paymentId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  });
  await notifyCustomer(
    user.id,
    "subscription",
    "تم تفعيل باقتك",
    `باقة «${programName}» شغالة دلوقتي لحد ${end.toLocaleDateString("ar-EG")}. كل التفاصيل في حسابك.`
  );
  return id;
}

/* ---------------------------------- auth ---------------------------------- */

app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const ip = req.ip ?? "unknown";
    if (await limited(`register:${ip}`, 6, 60_000)) {
      res.status(429).json({ error: "محاولات كتير، استنى دقيقة وحاول تاني." });
      return;
    }

    const name = str(req.body.name, 80);
    const email = str(req.body.email, 160).toLowerCase();
    const phone = str(req.body.phone, 24);
    const password = String(req.body.password ?? "");

    if (name.length < 2) return void res.status(400).json({ error: "اكتب اسمك صح." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void res.status(400).json({ error: "الإيميل مش صحيح." });
    if (password.length < 8) return void res.status(400).json({ error: "الباسورد لازم 8 حروف على الأقل." });
    if (phone && !/^[0-9+\-\s()]{8,20}$/.test(phone)) return void res.status(400).json({ error: "رقم الموبايل مش صحيح." });

    const exists = await findUserByEmail(email);
    if (exists) return void res.status(409).json({ error: "الإيميل ده مسجل قبل كده. سجل دخول." });

    const { salt, hash } = hashPassword(password);
    const user = await createUser({
      role: "customer",
      name,
      email,
      phone,
      password_salt: salt,
      password_hash: hash,
    });

    await issueSession(res, user, req);
    res.status(201).json({ user: toPublicUser(user) });
  })
);

const LOCK_AFTER = 5;
const LOCK_WINDOW_SECONDS = 15 * 60;

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const ip = req.ip ?? "unknown";
    const email = str(req.body.email, 160).toLowerCase();
    const password = String(req.body.password ?? "");

    if (await limited(`login:${ip}:${email}`, 8, 60_000)) {
      res.status(429).json({ error: "محاولات دخول كتير. استنى دقيقة." });
      return;
    }

    const perDevice = `login:${email}:${ip}`;
    const perAccount = `login-account:${email}`;
    if (
      (await getFailedAttempts(perDevice)) >= LOCK_AFTER ||
      (await getFailedAttempts(perAccount)) >= LOCK_AFTER * 5
    ) {
      res.status(429).json({ error: "الحساب مقفول مؤقتًا بعد محاولات دخول فاشلة. حاول تاني بعد 15 دقيقة." });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user || !checkPassword(password, user.password_salt, user.password_hash)) {
      const failures = await bumpFailedAttempts(perDevice, LOCK_WINDOW_SECONDS);
      await bumpFailedAttempts(perAccount, LOCK_WINDOW_SECONDS);
      res.status(401).json({
        error:
          failures >= LOCK_AFTER
            ? "تم قفل المحاولات لمدة 15 دقيقة لحماية الحساب."
            : "الإيميل أو الباسورد مش صح.",
      });
      return;
    }
    if (user.blocked) {
      res.status(403).json({ error: "الحساب موقوف. كلمنا على واتساب." });
      return;
    }

    await clearFailedAttempts(perDevice);
    await clearFailedAttempts(perAccount);

    if (user.role !== "customer" && user.totp_enabled) {
      const challenge = await createLoginChallenge(user.id);
      res.setHeader("Cache-Control", "no-store");
      res.json({ twoFactorRequired: true, challenge });
      return;
    }

    await issueSession(res, user, req);
    if (user.role === "admin") await logAudit(user, "auth.login", "user", user.id, { ip });
    res.json({ user: toPublicUser(user) });
  })
);

/** Second step for an admin account protected by TOTP. */
app.post(
  "/api/auth/2fa",
  asyncRoute(async (req, res) => {
    const ip = req.ip ?? "unknown";
    if (await limited(`2fa:${ip}`, 12, 60_000)) {
      res.status(429).json({ error: "محاولات تحقق كتير. استنى دقيقة." });
      return;
    }

    const challenge = str(req.body.challenge, 200);
    const code = str(req.body.code, 20);
    const record = await getLoginChallenge(challenge);
    const user = record ? await findUserById(record.user_id) : undefined;

    if (!record || !user || !user.totp_enabled || !user.totp_secret) {
      res.status(401).json({ error: "انتهت صلاحية التحقق. سجل دخول من الأول." });
      return;
    }
    if (record.attempts >= LOCK_AFTER || (await getFailedAttempts(`2fa:${user.id}`)) >= LOCK_AFTER) {
      await deleteLoginChallenge(challenge);
      res.status(429).json({ error: "محاولات تحقق كتير. سجل دخول تاني بعد 15 دقيقة." });
      return;
    }

    if (!(await verifyAdminSecondFactor(user, code))) {
      const attempts = await bumpLoginChallenge(challenge);
      await bumpFailedAttempts(`2fa:${user.id}`, LOCK_WINDOW_SECONDS);
      if (attempts >= LOCK_AFTER) await deleteLoginChallenge(challenge);
      res.status(401).json({
        error:
          attempts >= LOCK_AFTER
            ? "تم قفل المحاولات. سجل دخول تاني بعد 15 دقيقة."
            : "كود التحقق مش صح. جرّب الكود الجديد من التطبيق.",
      });
      return;
    }

    await deleteLoginChallenge(challenge);
    await clearFailedAttempts(`2fa:${user.id}`);
    await issueSession(res, user, req);
    await logAudit(user, "auth.login_2fa", "user", user.id, { ip });
    res.json({ user: toPublicUser(user) });
  })
);

app.post(
  "/api/auth/logout",
  asyncRoute(async (req, res) => {
    const sid = await sessionIdFromCookie(req);
    if (sid) await revokeSession(sid);
    clearSession(res);
    res.json({ ok: true });
  })
);

app.get(
  "/api/auth/me",
  optionalAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: req.user ? toPublicUser(req.user) : null });
  })
);

/* --------------------------------- account -------------------------------- */

app.get(
  "/api/account",
  requireAuth,
  asyncRoute(async (req, res) => {
    await expireOldSubscriptions(nowIso());
    const user = req.user!;
    const subscriptions = (await listSubscriptionsByUser(user.id)).map((entry) => mapSubscription(entry, user));
    const payments = (await listPaymentsByUser(user.id)).map((entry) => mapPayment(entry, user));
    // Files the doctor uploaded for this client only (plans, labs, notes).
    const [rawFiles, planRow, checkinRows] = await Promise.all([
      listAssets("customer", String(user.id)),
      getClientPlan(user.id),
      listCheckinsByUser(user.id),
    ]);
    // The badge clears only when the client opens the “My files” tab.
    const unseenFiles = rawFiles.filter((row) => !row.seen_at).length;
    const files = rawFiles.map((row) => mapAsset(row, true));

    res.setHeader("Cache-Control", "no-store");
    res.json({
      user: toPublicUser(user),
      subscriptions,
      payments,
      files,
      unseenFiles,
      plan: mapClientPlan(planRow),
      checkins: checkinRows.map((entry) => mapCheckin(entry, user)),
    });
  })
);

app.patch(
  "/api/account",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const patch: Partial<UserRow> = {};

    if (req.body.name !== undefined) {
      const name = str(req.body.name, 80);
      if (name.length < 2) return void res.status(400).json({ error: "اكتب اسمك بالكامل." });
      patch.name = name;
    }
    if (req.body.phone !== undefined) {
      const phone = str(req.body.phone, 24);
      if (phone && !/^[0-9+\-\s()]{8,20}$/.test(phone)) {
        return void res.status(400).json({ error: "رقم الموبايل مش صحيح." });
      }
      patch.phone = phone;
    }

    const password = String(req.body.password ?? "");
    if (password) {
      if (password.length < 8) return void res.status(400).json({ error: "الباسورد الجديد لازم 8 حروف على الأقل." });
      const current = String(req.body.currentPassword ?? "");
      if (!checkPassword(current, user.password_salt, user.password_hash)) {
        return void res.status(400).json({ error: "الباسورد الحالي مش صح." });
      }
      const { salt, hash } = hashPassword(password);
      patch.password_salt = salt;
      patch.password_hash = hash;
      patch.session_version = Number(user.session_version ?? 0) + 1;
    }

    const updated = (await updateUser(user.id, patch))!;
    if (password) {
      // A password change signs every device out, including this one, then
      // immediately issues a fresh session for the current browser.
      await revokeAllSessions(user.id);
      await issueSession(res, updated, req);
      await logAudit(updated, "account.password_change", "user", updated.id);
    }
    res.json({ user: toPublicUser(updated) });
  })
);

app.get(
  "/api/account/sessions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const rows = await listSessions(user.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      sessions: rows.map((row) => ({
        id: row.id,
        current: row.id === req.sessionId,
        createdAt: row.created_at,
        lastSeen: row.last_seen,
        ip: row.ip,
        userAgent: row.user_agent,
      })),
    });
  })
);

app.post(
  "/api/account/sessions/revoke-others",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const removed = await revokeAllSessions(user.id, req.sessionId);
    await logAudit(user, "session.revoke_others", "user", user.id, { removed });
    res.json({ ok: true, removed });
  })
);

app.delete(
  "/api/account/sessions/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const id = str(req.params.id, 200);
    const record = await getSession(id);
    if (!record || Number(record.user_id) !== Number(user.id)) {
      res.status(404).json({ error: "الجلسة مش موجودة." });
      return;
    }
    await revokeSession(id);
    await logAudit(user, "session.revoke", "user", user.id, { session: id.slice(0, 8) });
    if (id === req.sessionId) clearSession(res);
    res.json({ ok: true, current: id === req.sessionId });
  })
);

/* ------------------------- doctor ↔ patient messages ------------------------ */

function mapCoachMessage(row: any): CoachMessageDTO {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    sender: row.sender_role,
    body: String(row.body ?? ""),
    mediaUrl: row.media_name ? `/api/coach/media/${Number(row.id)}` : null,
    mediaKind: row.media_kind || null,
    videoUrl: row.video_url || null,
    createdAt: row.created_at,
  };
}

async function hasActivePlan(userId: number) {
  const now = nowIso();
  return (await listSubscriptionsByUser(userId)).some(
    (row) => row.status === "active" && String(row.ends_at) > now
  );
}

function safeVideoUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const allowed = ["youtube.com", "youtu.be", "vimeo.com", "drive.google.com"];
    if (url.protocol !== "https:" || !allowed.some((entry) => host === entry || host.endsWith(`.${entry}`))) return "";
    return url.toString();
  } catch {
    return "";
  }
}

/* --------------------------- chunked chat uploads --------------------------- */

type AttachedUpload = { mediaName: string; mediaMime: string; mediaKind: "image" | "video" };

/**
 * Validates a finished chunk session, claims it, then freezes the chunks into a
 * permanent file. Returns an HTTP error shape instead of throwing so both
 * message routes (customer and doctor) can answer with the same Arabic copy.
 */
async function attachChatUploadFor(
  uploadId: string,
  ownerUserId: number
): Promise<AttachedUpload | { status: number; error: string }> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(uploadId)) {
    return { status: 400, error: "جلسة الرفع مش صحيحة." };
  }
  const meta = await getChatUpload(uploadId);
  if (!meta) return { status: 410, error: "انتهت جلسة الرفع. ارفع الملف تاني." };
  if (Number(meta.userId) !== Number(ownerUserId)) {
    return { status: 403, error: "الملف ده مش متاح لحسابك." };
  }
  const recorded = meta.partBytes.slice(0, meta.chunks);
  const complete = recorded.length === meta.chunks && recorded.every((size) => Number(size) > 0);
  const total = recorded.reduce((sum, size) => sum + Number(size || 0), 0);
  if (!complete || total !== Number(meta.bytes)) {
    return { status: 400, error: "رفع الملف مش مكتمل. اختر الملف تاني وارفعه." };
  }
  const head = await getChatUploadPart(uploadId, 0);
  if (!head) return { status: 400, error: "رفع الملف مش مكتمل. اختر الملف تاني وارفعه." };
  const valid = meta.kind === "image" ? looksLikeImage(head.subarray(0, 32)) : looksLikeVideo(head.subarray(0, 12));
  if (!valid) return { status: 400, error: "الملف مش صورة أو فيديو صحيح." };
  if (!(await claimChatUpload(uploadId))) return { status: 409, error: "الملف ده اترفع قبل كده." };
  let frozen = false;
  try {
    frozen = await attachChatUpload(meta);
  } finally {
    if (!frozen) await releaseChatUploadClaim(uploadId).catch(() => undefined);
  }
  if (!frozen) return { status: 410, error: "انتهت جلسة الرفع. ارفع الملف تاني." };
  return { mediaName: uploadId, mediaMime: meta.mime, mediaKind: meta.kind === "image" ? "image" : "video" };
}

/** Opens a chunk session: the client then posts each ≤ 3 MB slice. */
app.post(
  "/api/coach/uploads",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    if (user.role !== "admin" && !(await hasActivePlan(user.id))) {
      return void res.status(403).json({ error: "المحادثة متاحة مع الباقة النشطة أو التجربة المجانية." });
    }
    if (await limited(`chatup:${user.id}`, 30, 60_000)) {
      return void res.status(429).json({ error: "بترفع ملفات كتير. استنى دقيقة وجرب تاني." });
    }
    const mime = String(req.body?.mime ?? "").trim().toLowerCase();
    const image = CHAT_IMAGE_TYPES.includes(mime);
    const video = CHAT_VIDEO_TYPES.includes(mime);
    if (!image && !video) {
      return void res.status(400).json({ error: "الملف لازم يكون صورة أو فيديو." });
    }
    const bytes = Number(req.body?.bytes);
    if (!Number.isInteger(bytes) || bytes < 1) {
      return void res.status(400).json({ error: "حجم الملف مش واضح. جرّب تاني." });
    }
    if (bytes > CHAT_MAX_FILE_BYTES) {
      return void res.status(413).json({
        error: `حجم الملف كبير. الحد الأقصى ${Math.round(CHAT_MAX_FILE_BYTES / 1024 / 1024)} ميجا.`,
      });
    }
    const chunks = Math.ceil(bytes / CHAT_CHUNK_BYTES);
    const meta = await createChatUpload({ userId: user.id, mime, kind: image ? "image" : "video", bytes, chunks });
    res.status(201).json({ uploadId: meta.id, chunks, chunkBytes: CHAT_CHUNK_BYTES });
  })
);

/** Stores one chunk; chunks may arrive in any order and be retried safely. */
app.post(
  "/api/coach/uploads/:id/:index",
  requireAuth,
  chunkLengthGuard,
  chatChunkUpload.single("file"),
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const id = String(req.params.id ?? "");
    const index = Number(req.params.index);
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(id) || !Number.isInteger(index) || index < 0) {
      return void res.status(400).json({ error: "جلسة الرفع مش صحيحة." });
    }
    const meta = await getChatUpload(id);
    if (!meta) return void res.status(410).json({ error: "انتهت جلسة الرفع. ارفع الملف تاني." });
    if (Number(meta.userId) !== Number(user.id)) {
      return void res.status(403).json({ error: "الملف ده مش متاح لحسابك." });
    }
    if (index >= meta.chunks) {
      return void res.status(400).json({ error: "رقم الجزء غير صحيح." });
    }
    if (await limited(`chatpart:${user.id}`, 200, 60_000)) {
      return void res.status(429).json({ error: "بترفع بسرعة. استنى دقيقة وجرب تاني." });
    }
    const file = req.file;
    const kind = file?.mimetype.startsWith("image/") ? "image" : file?.mimetype.startsWith("video/") ? "video" : "";
    if (!file || kind !== meta.kind) {
      return void res.status(400).json({ error: "الملف مش صورة أو فيديو صحيح." });
    }
    const saved = await putChatUploadPart(id, index, file.buffer);
    if (!saved) return void res.status(400).json({ error: "تعذر حفظ الجزء. جرب تاني." });
    const received = saved.partBytes.filter((size) => Number(size) > 0).length;
    res.json({ uploadId: id, index, received, total: meta.chunks });
  })
);

/** Media is served through the API so only the owner (or an admin) can read it. */
app.get(
  "/api/coach/media/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    if (!req.user) return void res.status(401).json({ error: "سجل دخول الأول." });
    const id = Number(req.params.id);
    const row = Number.isFinite(id) ? await getCoachMessage(id) : undefined;
    if (!row || !row.media_name) return void res.status(404).json({ error: "الملف مش موجود." });
    if (req.user.role !== "admin" && Number(row.user_id) !== Number(req.user.id)) {
      return void res.status(403).json({ error: "الملف ده مش متاح لحسابك." });
    }
    const meta = await getFileMeta(row.media_name);
    const chunked = Boolean(meta?.parts && meta.parts > 0);
    if (!meta || (!chunked && !meta.data)) return void res.status(404).json({ error: "الملف مش موجود." });
    res.setHeader("Content-Type", meta.mime || "application/octet-stream");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Accept-Ranges", "bytes");
    if (chunked) {
      // Stream part by part so a 64 MB video never sits in memory at once, and
      // honour Range requests so the browser can start playing and seek.
      const total = Number(meta.bytes ?? 0);
      const parts = Number(meta.parts ?? 0);
      const range = parseByteRange(req.headers.range, total);
      if (range === "invalid") {
        res.status(416).setHeader("Content-Range", `bytes */${total}`);
        res.end();
        return;
      }
      const from = range ? range.start : 0;
      const to = range ? range.end : Math.max(0, total - 1);
      if (range) {
        res.status(206);
        res.setHeader("Content-Range", `bytes ${from}-${to}/${total}`);
      }
      res.setHeader("Content-Length", String(total === 0 ? 0 : to - from + 1));
      const first = Math.floor(from / CHAT_CHUNK_BYTES);
      const last = Math.min(parts - 1, Math.floor(to / CHAT_CHUNK_BYTES));
      for (let index = first; index <= last; index += 1) {
        if (res.destroyed) return;
        const part = await getChatUploadPart(row.media_name, index);
        if (!part) break;
        const offset = index * CHAT_CHUNK_BYTES;
        const slice = part.subarray(Math.max(0, from - offset), Math.min(part.length, to - offset + 1));
        if (!slice.length) continue;
        try {
          if (!res.write(slice)) {
            const flushed = await new Promise<boolean>((resolve) => {
              const onDrain = () => {
                res.off("close", onClose);
                resolve(true);
              };
              const onClose = () => {
                res.off("drain", onDrain);
                resolve(false);
              };
              res.once("drain", onDrain);
              res.once("close", onClose);
            });
            if (!flushed) return;
          }
        } catch {
          // The client closed the video mid-stream; the rest is not needed.
          return;
        }
      }
      res.end();
      return;
    }
    const buffer = Buffer.from(meta.data ?? "", "base64");
    const range = parseByteRange(req.headers.range, buffer.length);
    if (range === "invalid") {
      res.status(416).setHeader("Content-Range", `bytes */${buffer.length}`);
      res.end();
      return;
    }
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${buffer.length}`);
      res.setHeader("Content-Length", String(range.end - range.start + 1));
      res.end(buffer.subarray(range.start, range.end + 1));
      return;
    }
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  })
);

app.get(
  "/api/coach/messages",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const active = await hasActivePlan(user.id);
    if (!active && user.role !== "admin") {
      res.status(403).json({ error: "المحادثة متاحة مع الباقة النشطة أو التجربة المجانية." });
      return;
    }
    const rows = await listCoachMessagesByUser(user.id);
    const unread = await countUnreadCoachForCustomer(user.id);
    await markCoachRead(user.id, "customer");
    res.setHeader("Cache-Control", "no-store");
    res.json({
      active,
      messages: rows.map(mapCoachMessage),
      unread,
      doctor: {
        name: "د. مصطفى يوسف",
        role: "استشاري تغذية علاجية ومدرب لياقة",
        replyNote: "بيرد خلال ساعات العمل — تقدر تبعت ملاحظاتك وصورك في أي وقت.",
      },
    });
  })
);

app.post(
  "/api/coach/messages",
  requireAuth,
  contentLengthGuard,
  coachUpload.single("file"),
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const file = req.file;
    const discard = () => {
      if (!file) return;
      try {
        unlinkSync(file.path);
      } catch {
        /* already gone */
      }
    };
    if (!(await hasActivePlan(user.id))) {
      discard();
      res.status(403).json({ error: "المحادثة متاحة مع الباقة النشطة أو التجربة المجانية." });
      return;
    }
    if (await limited(`coach:${user.id}`, 20, 60_000)) {
      discard();
      res.status(429).json({ error: "بتبعت رسايل بسرعة. استنى دقيقة وجرب تاني." });
      return;
    }
    const body = String(req.body.body ?? "").trim().slice(0, 2000);
    const videoUrl = safeVideoUrl(req.body.videoUrl);
    const uploadId = String(req.body.mediaUploadId ?? "").trim();
    if (req.body.videoUrl && !videoUrl) {
      discard();
      return void res.status(400).json({ error: "رابط الفيديو لازم يكون من YouTube أو Vimeo أو Google Drive." });
    }
    if (uploadId && file) {
      discard();
      return void res.status(400).json({ error: "ابعت الملف مرة واحدة بس." });
    }
    if (!body && !file && !videoUrl && !uploadId) {
      return void res.status(400).json({ error: "اكتب رسالتك أو ارفع صورة/فيديو." });
    }

    let mediaName = "";
    let mediaMime = "";
    let mediaKind: "image" | "video" | "" = "";
    if (uploadId) {
      const attached = await attachChatUploadFor(uploadId, user.id);
      if ("status" in attached) {
        discard();
        return void res.status(attached.status).json({ error: attached.error });
      }
      mediaName = attached.mediaName;
      mediaMime = attached.mediaMime;
      mediaKind = attached.mediaKind;
    } else if (file) {
      const image = CHAT_IMAGE_TYPES.includes(file.mimetype);
      const video = CHAT_VIDEO_TYPES.includes(file.mimetype);
      const valid = image ? isRealImage(file.path) : video ? isRealVideo(file.path) : false;
      if (!valid) {
        discard();
        return void res.status(400).json({ error: "الملف مش صورة أو فيديو صحيح." });
      }
      mediaName = path.basename(file.path);
      mediaMime = file.mimetype;
      mediaKind = image ? "image" : "video";
      try {
        await putFile(mediaName, readFileSync(file.path), mediaMime);
      } catch (error) {
        await deleteFile(mediaName).catch(() => undefined);
        if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
          return void res.status(413).json({ error: "الملف كبير. حد الفيديو ٤ ميجا، أو استخدم رابط فيديو." });
        }
        throw error;
      } finally {
        discard();
      }
    }

    const id = await createCoachMessage({
      user_id: user.id,
      sender_role: "customer",
      body,
      media_name: mediaName,
      media_mime: mediaMime,
      media_kind: mediaKind,
      video_url: videoUrl,
    });
    await logAudit(user, "coach.customer_message", "user", user.id, {
      media: mediaKind || (videoUrl ? "link" : ""),
    });
    const row = await getCoachMessage(id);
    res.status(201).json({ message: row ? mapCoachMessage(row) : null });
  })
);

app.post(
  "/api/trial",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const programId = str(req.body.programId, 80);
    const program = await getContent(programId);
    if (!program || program.collection !== "programs" || program.common.trial !== true) {
      res.status(400).json({ error: "الباقة التجريبية مش موجودة." });
      return;
    }
    await expireOldSubscriptions(nowIso());
    if (user.role !== "admin") {
      const used = (await listSubscriptionsByUser(user.id)).some((row) => row.program_id === programId);
      if (used) {
        res.status(409).json({ error: "جربت الباقة المجانية قبل كده. اختار باقة شهرية عشان تكمل." });
        return;
      }
    }
    const days = Math.min(14, Math.max(1, Number(program.common.days) || 3));
    const startsAt = nowIso();
    const subscriptionId = await createSubscription({
      user_id: user.id,
      program_id: programId,
      program_name: String(program.ar?.name ?? program.en?.name ?? "التجربة المجانية"),
      payment_id: null,
      starts_at: startsAt,
      ends_at: addDays(new Date(), days).toISOString(),
    });
    await logAudit(user, "trial.activate", "subscription", subscriptionId, { days });
    res.status(201).json({ subscriptionId, days, startsAt });
  })
);

/* --------------------------- admin conversations --------------------------- */

app.get(
  "/api/admin/conversations",
  requireStaff,
  asyncRoute(async (_req, res) => {
    await expireOldSubscriptions(nowIso());
    const [customers, summaries, messages, subscriptions] = await Promise.all([
      listCustomerRows(),
      customerSummaries(nowIso()),
      allCoachMessages(),
      allSubscriptions(),
    ]);
    const activeTrial = new Set(
      subscriptions
        .filter((row) => row.program_id === "prog-trial" && row.status === "active")
        .map((row) => Number(row.user_id))
    );
    const grouped = new Map<number, typeof messages>();
    for (const row of messages) {
      const list = grouped.get(Number(row.user_id)) ?? [];
      list.push(row);
      grouped.set(Number(row.user_id), list);
    }
    const conversations = customers
      .map((customer) => {
        const rows = grouped.get(customer.id) ?? [];
        const last = rows[rows.length - 1];
        return {
          userId: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          activeSubscriptions: summaries.get(customer.id)?.activeSubscriptions ?? 0,
          endsAt: summaries.get(customer.id)?.endsAt ?? null,
          isTrial: activeTrial.has(customer.id),
          unread: rows.filter((row) => row.sender_role === "customer" && !row.read_by_doctor).length,
          lastMessage: last
            ? String(last.body || "").trim() || (last.media_kind === "image" ? "📷 صورة" : last.media_kind === "video" ? "🎬 فيديو" : "🔗 رابط فيديو")
            : "",
          lastMessageAt: last?.created_at ?? null,
        };
      })
      .filter((item) => item.activeSubscriptions > 0 || item.lastMessageAt)
      .sort((a, b) => String(b.lastMessageAt ?? "").localeCompare(String(a.lastMessageAt ?? "")) || a.name.localeCompare(b.name));

    res.setHeader("Cache-Control", "no-store");
    res.json({ conversations });
  })
);

app.get(
  "/api/admin/conversations/:userId/messages",
  requireStaff,
  asyncRoute(async (req, res) => {
    const userId = Number(req.params.userId);
    const customer = Number.isFinite(userId) ? await findUserById(userId) : undefined;
    if (!customer) return void res.status(404).json({ error: "العميل مش موجود." });
    const rows = await listCoachMessagesByUser(userId);
    await markCoachRead(userId, "doctor");
    res.setHeader("Cache-Control", "no-store");
    res.json({
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
      messages: rows.map(mapCoachMessage),
      active: await hasActivePlan(userId),
    });
  })
);

app.post(
  "/api/admin/conversations/:userId/messages",
  requireStaff,
  contentLengthGuard,
  coachUpload.single("file"),
  asyncRoute(async (req, res) => {
    const userId = Number(req.params.userId);
    const customer = Number.isFinite(userId) ? await findUserById(userId) : undefined;
    if (!customer) {
      if (req.file) {
        try {
          unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      return void res.status(404).json({ error: "العميل مش موجود." });
    }

    const body = String(req.body.body ?? "").trim().slice(0, 2000);
    const videoUrl = safeVideoUrl(req.body.videoUrl);
    const uploadId = String(req.body.mediaUploadId ?? "").trim();
    const file = req.file;
    if (uploadId && file) {
      try {
        unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      return void res.status(400).json({ error: "ابعت الملف مرة واحدة بس." });
    }
    if (!body && !file && !videoUrl && !uploadId) {
      return void res.status(400).json({ error: "اكتب رسالة أو ارفع صورة/فيديو." });
    }

    let mediaName = "";
    let mediaMime = "";
    let mediaKind: "image" | "video" | "" = "";
    if (uploadId) {
      const attached = await attachChatUploadFor(uploadId, req.user!.id);
      if ("status" in attached) {
        return void res.status(attached.status).json({ error: attached.error });
      }
      mediaName = attached.mediaName;
      mediaMime = attached.mediaMime;
      mediaKind = attached.mediaKind;
    } else if (file) {
      const image = CHAT_IMAGE_TYPES.includes(file.mimetype);
      const video = CHAT_VIDEO_TYPES.includes(file.mimetype);
      const valid = image ? isRealImage(file.path) : video ? isRealVideo(file.path) : false;
      if (!valid) {
        try {
          unlinkSync(file.path);
        } catch {
          /* ignore */
        }
        return void res.status(400).json({ error: "الملف مش صورة أو فيديو صحيح." });
      }
      mediaName = path.basename(file.path);
      mediaMime = file.mimetype;
      mediaKind = image ? "image" : "video";
      try {
        await putFile(mediaName, readFileSync(file.path), mediaMime);
      } catch (error) {
        await deleteFile(mediaName).catch(() => undefined);
        if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
          return void res.status(413).json({ error: "الملف كبير. حد الفيديو ٤ ميجا قصير، أو استخدم رابط فيديو." });
        }
        throw error;
      } finally {
        try {
          unlinkSync(file.path);
        } catch {
          /* already gone */
        }
      }
    }
    if (req.body.videoUrl && !videoUrl) {
      return void res.status(400).json({ error: "رابط الفيديو لازم يكون من YouTube أو Vimeo أو Google Drive." });
    }

    const id = await createCoachMessage({
      user_id: userId,
      sender_role: "doctor",
      body,
      media_name: mediaName,
      media_mime: mediaMime,
      media_kind: mediaKind,
      video_url: videoUrl,
    });
    await logAudit(req.user, "coach.doctor_message", "user", userId, { media: mediaKind || (videoUrl ? "link" : "") });
    await notifyCustomer(
      userId,
      "chat",
      "رسالة جديدة من الدكتور",
      body || (mediaKind === "image" ? "بعتنالك صورة جديدة في المحادثة." : mediaKind === "video" ? "بعتنالك فيديو جديد في المحادثة." : "بعتنالك رابط فيديو في المحادثة.")
    );
    const row = await getCoachMessage(id);
    res.status(201).json({ message: row ? mapCoachMessage(row) : null });
  })
);

/* -------------------------------- public site ------------------------------ */

app.get(
  "/api/site",
  optionalAuth,
  asyncRoute(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    // Subscribers-only plan files stay hidden from visitors and free accounts.
    const viewer = req.user ?? null;
    const unlocked = viewer
      ? viewer.role === "admin" || viewer.role === "staff"
        ? true
        : await hasActivePlan(viewer.id)
      : false;
    const [settings, copy, programs, services, testimonials, results, posts, faqs, credentials] =
      await Promise.all([
        getSettings(),
        getCopyOverrides(),
        listContent("programs", true),
        listContent("services", true),
        listContent("testimonials", true),
        listContent("results", true),
        listContent("posts", true),
        listContent("faqs", true),
        listContent("credentials", true),
      ]);
    res.json({
      settings,
      programs: await programsWithAssets(programs, unlocked),
      services,
      testimonials,
      results,
      posts,
      faqs,
      credentials,
      copy,
    });
  })
);

app.post(
  "/api/messages",
  asyncRoute(async (req, res) => {
    const ip = req.ip ?? "unknown";
    if (await limited(`msg:${ip}`, 8, 60_000)) {
      res.status(429).json({ error: "بعتنالنا رسايل كتير. استنى شوية." });
      return;
    }
    const name = str(req.body.name, 80);
    const phone = str(req.body.phone, 24);
    if (name.length < 2) return void res.status(400).json({ error: "اكتب اسمك صح." });
    if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) return void res.status(400).json({ error: "رقم الموبايل مش صحيح." });

    await createMessage({
      name,
      phone,
      email: str(req.body.email, 160),
      goal: str(req.body.goal, 120),
      body: str(req.body.message, 3000),
    });

    res.status(201).json({ ok: true });
  })
);

/* --------------------------------- payments -------------------------------- */

app.post(
  "/api/payments",
  requireAuth,
  contentLengthGuard,
  shotUpload.single("screenshot"),
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const file = req.file;
    let shotClaim: string | null = null;
    let refClaim: string | null = null;
    const cleanup = () => {
      if (file) {
        try {
          unlinkSync(file.path);
        } catch {
          /* ignore */
        }
      }
    };

    try {
      if (!file) {
        res.status(400).json({ error: "لازم ترفع صورة التحويل." });
        return;
      }

      // Receipts are capped per account so a scripted client cannot flood the
      // store (and the admin queue) with junk uploads.
      if (await limited(`pay:${user.id}`, 8, 60 * 60 * 1000)) {
        cleanup();
        res.status(429).json({ error: "عدد محاولات رفع الإيصالات كتير دلوقتي. استنى ساعة وجرّب تاني." });
        return;
      }

      const program = await getContent(str(req.body.programId, 80));
      if (!program || program.collection !== "programs" || !program.active) {
        cleanup();
        res.status(404).json({ error: "الباقة غير متاحة." });
        return;
      }
      if (int(program.common.amount, 0) <= 0) {
        cleanup();
        res.status(400).json({ error: "الباقة دي مش متاحة للدفع. اختار باقة تانية." });
        return;
      }

      const method = str(req.body.method, 20);
      if (!["vodafone", "instapay"].includes(method)) {
        cleanup();
        res.status(400).json({ error: "اختار طريقة الدفع." });
        return;
      }

      const sender = str(req.body.sender, 60);
      const reference = str(req.body.reference, 60);
      const claimed = int(req.body.amount, 0);
      const listPrice = int(program.common.amount, 0);
      // A valid coupon lowers the exact amount the receipt has to match.
      const appliedCoupon = await resolveCoupon(str(req.body.coupon, 40), listPrice);
      const amount = appliedCoupon ? Math.max(0, listPrice - appliedCoupon.discount) : listPrice;
      const size = statSync(file.path).size;
      const imageOk = isRealImage(file.path);
      const dims = imageSize(file.path);
      const hash = sha256(readFileSync(file.path));

      if (!imageOk) {
        cleanup();
        res.status(400).json({ error: "الملف مش صورة صحيحة. ارفع صورة إيصال التحويل." });
        return;
      }

      const reasons: string[] = [];
      const settings = await getSettings();

      /*
       * Smart receipt review, done with rules instead of an external model:
       * every number the customer typed is checked against the wallet we
       * actually collect on, the exact plan price and the image itself. A
       * receipt that passes every rule activates the subscription on the spot;
       * anything questionable is parked as `pending` with Arabic reasons the
       * admin can read — it is never silently rejected.
       */
      const expectedTarget = method === "vodafone" ? settings.payments.vodafone : settings.payments.instapay;
      const normalizeAccount = (value: string) => value.toLowerCase().replace(/[\s()+\-_.]/g, "");
      const recipient = str(req.body.recipient, 80).trim();
      const senderKey = normalizeAccount(sender);
      const recipientKey = normalizeAccount(recipient);
      const targetKey = normalizeAccount(expectedTarget);
      const refText = reference.toLowerCase().replace(/[\s\-_]/g, "");

      if (size < 8 * 1024) reasons.push("حجم الصورة صغير جدًا — تأكد إنها سكرين شوت واضح للتحويل.");
      if (claimed !== amount || claimed <= 0) {
        reasons.push(`المبلغ المكتوب (${claimed}) لا يطابق سعر الباقة (${amount} ج.م).`);
      }

      // Did the money actually reach the clinic's wallet? Only a number read
      // off the receipt proves it, so an empty or foreign recipient never
      // auto-activates — it goes straight to manual review.
      if (!recipient) {
        reasons.push("لم تُكتب بيانات المستلم كما هي في الإيصال — التفعيل التلقائي متوقف للمراجعة.");
      } else if (recipientKey !== targetKey) {
        reasons.push(
          `بيانات المستلم المكتوبة (${recipient}) لا تطابق ${
            method === "vodafone" ? "رقم محفظة العيادة" : "عنوان إنستاباي المعتمد"
          } (${expectedTarget}).`
        );
      }
      if (recipient && senderKey === recipientKey) reasons.push("رقم المرسل مطابق لرقم المستلم — التحويل يبدو داخليًا.");
      if (senderKey === targetKey) reasons.push("التحويل مسجَّل من رقم العيادة نفسه.");

      if (reference.length < 6) reasons.push("رقم عملية التحويل قصير أو غير مكتمل.");
      if (!/[a-z0-9]/i.test(reference)) reasons.push("رقم عملية التحويل لازم يحتوي على أحرف أو أرقام.");
      else if (!/\d/.test(reference)) reasons.push("رقم عملية التحويل بدون أي أرقام — انسخه كما هو في الإيصال.");
      if (/^(.)\1+$/i.test(refText)) reasons.push("رقم عملية التحويل متكرر بالكامل وغير حقيقي.");
      if (refText === senderKey || (recipientKey && refText === recipientKey)) {
        reasons.push("رقم عملية التحويل مطابق لرقم المحفظة.");
      }
      if (method === "vodafone" && !/^01[0125]\d{8}$/.test(sender)) {
        reasons.push("رقم المحفظة المُحوّل منها غير مطابق لأرقام فودافون كاش.");
      }
      if (method === "instapay" && sender.length < 5) reasons.push("بيانات حساب إنستاباي المُحوّل منه غير مكتملة.");
      if (dims.width && dims.height) {
        if (dims.width < 280 || dims.height < 280) {
          reasons.push("أبعاد صورة التحويل صغيرة جدًا — ارفع سكرين شوت أوضح.");
        }
        const ratio = Math.max(dims.width, dims.height) / Math.min(dims.width, dims.height);
        if (ratio > 3.2) reasons.push("الصورة أطول من اللازم — ارفع سكرين شوت كامل للإيصال.");
      }

      const referenceKey = sha256(`${method}:${reference.toLowerCase().replace(/\s+/g, "")}`);

      if (await findPaymentBySha(hash)) {
        cleanup();
        res.status(409).json({ error: "الصورة دي اتقدّمت قبل كده. مينفعش نستخدم نفس الإيصال مرتين." });
        return;
      }
      if (await findPaymentByReferenceKey(referenceKey)) {
        cleanup();
        res.status(409).json({ error: "رقم العملية ده مستخدم قبل كده. تأكد من رقم العملية." });
        return;
      }

      // Atomic claims: two uploads racing with the same receipt can no longer
      // both pass the checks above and create two payments.
      shotClaim = `shot:${hash}`;
      refClaim = `ref:${referenceKey}`;
      if (!(await reserveOnce(shotClaim))) {
        shotClaim = null;
        cleanup();
        res.status(409).json({ error: "الصورة دي اتقدّمت قبل كده. مينفعش نستخدم نفس الإيصال مرتين." });
        return;
      }
      if (!(await reserveOnce(refClaim))) {
        refClaim = null;
        await releaseOnce(shotClaim).catch(() => undefined);
        shotClaim = null;
        cleanup();
        res.status(409).json({ error: "رقم العملية ده مستخدم قبل كده. تأكد من رقم العملية." });
        return;
      }

      // Every rule passed → activate on the spot. One doubt → manual review.
      const status = reasons.length === 0 && settings.payments.autoApprove !== false ? "auto_approved" : "pending";
      const filename = path.basename(file.path);

      // Persist the receipt first: a payment row must never point at an image
      // that is not in the store. Roll the file back if the row fails.
      await putFile(filename, readFileSync(file.path), file.mimetype || "image/jpeg");

      let paymentId: number;
      try {
        paymentId = await createPayment({
          user_id: user.id,
          program_id: program.id,
          program_name: String(program.ar?.name ?? program.id),
          amount,
          days: int(program.common.days, 30),
          method,
          sender,
          reference,
          screenshot: filename,
          screenshot_sha: hash,
          reference_key: referenceKey,
          status,
          risk: JSON.stringify(reasons),
          note: "",
          coupon: appliedCoupon?.code ?? null,
          discount: appliedCoupon?.discount ?? 0,
          created_at: nowIso(),
          reviewed_at: status === "auto_approved" ? nowIso() : null,
          screenshot_width: dims.width,
          screenshot_height: dims.height,
        });
      } catch (createError) {
        await deleteFile(filename).catch(() => undefined);
        throw createError;
      }

      let subscriptionId: number | null = null;

      if (status === "auto_approved") {
        subscriptionId = await activateSubscription(user, program, paymentId);
        if (appliedCoupon) await redeemCoupon(appliedCoupon.code);
      }

      await logAudit(
        user,
        status === "auto_approved" ? "payment.auto_approved" : "payment.submitted",
        "payment",
        paymentId,
        { amount, method, program: program.id, recipient, risk: reasons }
      );

      res.status(201).json({
        payment: {
          id: paymentId,
          status,
          risk: reasons,
          amount,
        },
        subscriptionId,
        auto: status === "auto_approved",
      });
    } catch (error: any) {
      cleanup();
      if (shotClaim) await releaseOnce(shotClaim).catch(() => undefined);
      if (refClaim) await releaseOnce(refClaim).catch(() => undefined);
      if (String(error?.message ?? "").includes("UNIQUE")) {
        res.status(409).json({ error: "الإيصال أو رقم العملية مستخدم قبل كده." });
        return;
      }
      throw error;
    }
  })
);

app.get(
  "/api/payments/:id/screenshot",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const payment = await getPayment(int(req.params.id));
    if (!payment) return void res.status(404).json({ error: "الدفعة غير موجودة." });
    if (user.role !== "admin" && payment.user_id !== user.id) {
      return void res.status(403).json({ error: "مش مسموح." });
    }

    const file = await getFile(path.basename(payment.screenshot));
    if (!file) return void res.status(404).json({ error: "الصورة مش موجودة." });
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", file.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(file.buffer);
  })
);

/* ---------------------------------- admin --------------------------------- */

/**
 * Accepts a current TOTP code or a one-time backup code. A used backup code is
 * removed from storage immediately, so a leaked list cannot be replayed.
 */
async function verifyAdminSecondFactor(user: UserRow, code: string): Promise<boolean> {
  if (user.totp_secret && verifyTotp(user.totp_secret, code)) return true;
  const hashes = safeJson<string[]>(user.totp_backup, []);
  const index = verifyBackupCode(code, hashes);
  if (index < 0) return false;
  hashes.splice(index, 1);
  await updateUser(user.id, { totp_backup: JSON.stringify(hashes) });
  return true;
}

app.get(
  "/api/admin/2fa",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = (await findUserById(req.user!.id))!;
    const hashes = safeJson<string[]>(admin.totp_backup, []);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      enabled: Boolean(admin.totp_enabled),
      pending: Boolean(admin.totp_pending),
      backupCodesLeft: hashes.length,
      account: admin.email,
    });
  })
);

app.post(
  "/api/admin/2fa/setup",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = (await findUserById(req.user!.id))!;
    if (admin.totp_enabled) {
      res.status(409).json({ error: "التحقق بخطوتين مفعّل بالفعل. أوقفه الأول لو محتاج تعيد الإعداد." });
      return;
    }

    const secret = generateTotpSecret();
    await updateUser(admin.id, { totp_pending: secret });
    res.setHeader("Cache-Control", "no-store");
    res.json({
      secret,
      uri: totpUri(secret, admin.email),
      account: admin.email,
      issuer: "Dr. Mostafa Youssef",
    });
  })
);

app.post(
  "/api/admin/2fa/enable",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = (await findUserById(req.user!.id))!;
    const code = str(req.body.code, 20);
    if (!admin.totp_pending) {
      res.status(400).json({ error: "ابدأ إعداد التحقق الأول عشان يظهر الكود." });
      return;
    }
    if (!verifyTotp(admin.totp_pending, code)) {
      res.status(400).json({ error: "الكود مش صح. تأكد إن ساعة الموبايل مظبوطة وجرب الكود الجديد." });
      return;
    }

    const { codes, hashes } = generateBackupCodes();
    await updateUser(admin.id, {
      totp_secret: admin.totp_pending,
      totp_enabled: 1,
      totp_pending: null,
      totp_backup: JSON.stringify(hashes),
    });
    await logAudit(admin, "admin.2fa_enabled", "user", admin.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, backupCodes: codes });
  })
);

app.post(
  "/api/admin/2fa/disable",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = (await findUserById(req.user!.id))!;
    const password = String(req.body.password ?? "");
    const code = str(req.body.code, 20);
    if (!checkPassword(password, admin.password_salt, admin.password_hash)) {
      res.status(400).json({ error: "الباسورد مش صح." });
      return;
    }
    if (!admin.totp_enabled || !(await verifyAdminSecondFactor(admin, code))) {
      res.status(400).json({ error: "كود التحقق مش صح." });
      return;
    }

    await updateUser(admin.id, {
      totp_secret: null,
      totp_enabled: 0,
      totp_pending: null,
      totp_backup: null,
    });
    await logAudit(admin, "admin.2fa_disabled", "user", admin.id);
    res.json({ ok: true });
  })
);

app.post(
  "/api/admin/2fa/backup-codes",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = (await findUserById(req.user!.id))!;
    const password = String(req.body.password ?? "");
    const code = str(req.body.code, 20);
    if (!checkPassword(password, admin.password_salt, admin.password_hash)) {
      res.status(400).json({ error: "الباسورد مش صح." });
      return;
    }
    if (!admin.totp_enabled || !(await verifyAdminSecondFactor(admin, code))) {
      res.status(400).json({ error: "كود التحقق مش صح." });
      return;
    }

    const { codes, hashes } = generateBackupCodes();
    await updateUser(admin.id, { totp_backup: JSON.stringify(hashes) });
    await logAudit(admin, "admin.2fa_backup_codes", "user", admin.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, backupCodes: codes });
  })
);

/** Full JSON export (no binary screenshots) for off-site safekeeping. */
app.get(
  "/api/admin/backup",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const [settings, copy, users, content, payments, subscriptions, messages, coachMessages, media, audit] =
      await Promise.all([
        getSettings(),
        getCopyOverrides(),
        listUsers(),
        allContentRows(),
        allPayments(),
        allSubscriptions(),
        listMessages(100_000),
        allCoachMessages(),
        listMedia(100_000),
        listAudit(100_000),
      ]);

    const payload = {
      version: 1,
      exportedAt: nowIso(),
      namespace: process.env.REDIS_PREFIX || "dm",
      settings,
      copy,
      users,
      content,
      payments,
      subscriptions,
      messages,
      coachMessages,
      media,
      audit,
    };

    await logAudit(req.user, "backup.download", "backup", "", {
      users: users.length,
      payments: payments.length,
      coachMessages: coachMessages.length,
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="backup-${nowIso().slice(0, 10)}.json"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.json(payload);
  })
);

app.get(
  "/api/admin/overview",
  requireStaff,
  asyncRoute(async (_req, res) => {
    await expireOldSubscriptions(nowIso());
    const now = nowIso();
    const month = now.slice(0, 7);

    const [stats, customerRows, activeSubs, expiringSoon, unread, coachUnread, allPaymentRows] = await Promise.all([
      paymentStats(),
      listCustomerRows(),
      countActiveSubscriptions(now),
      countExpiringSoon(now, addDays(new Date(), 7).toISOString()),
      countUnreadMessages(),
      countUnreadCoachForDoctor(),
      allPayments(),
    ]);

    const customers = customerRows.length;
    const newCustomers = customerRows.filter((row) => String(row.created_at).slice(0, 7) === month).length;
    const recentPayments = await Promise.all(allPaymentRows.slice(0, 6).map(mapPaymentWithUser));

    res.json({
      revenue: stats.revenue,
      todayRevenue: stats.todayRevenue,
      monthRevenue: stats.monthRevenue,
      pendingCount: stats.pendingCount,
      pendingAmount: stats.pendingAmount,
      customers,
      newCustomers,
      activeSubscriptions: activeSubs,
      expiringSoon,
      unreadMessages: unread,
      coachUnread,
      monthly: stats.monthly,
      recentPayments,
      totals: { approved: stats.approved, auto: stats.auto, rejected: stats.rejected },
    });
  })
);

function mapPayment(row: any, user?: Partial<UserRow> | null) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: row.user_name ?? user?.name,
    userEmail: row.user_email ?? user?.email,
    userPhone: row.user_phone ?? user?.phone,
    programId: row.program_id,
    programName: row.program_name,
    amount: Number(row.amount),
    days: Number(row.days),
    method: row.method,
    sender: row.sender,
    reference: row.reference,
    status: row.status,
    risk: safeJson(row.risk, []),
    note: row.note,
    coupon: row.coupon ?? null,
    discount: Number(row.discount ?? 0),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    hasScreenshot: true,
    screenshotWidth: row.screenshot_width ?? null,
    screenshotHeight: row.screenshot_height ?? null,
  };
}

async function mapPaymentWithUser(row: any) {
  return mapPayment(row, await findUserById(Number(row.user_id)));
}

app.get(
  "/api/admin/payments",
  requireStaff,
  asyncRoute(async (req, res) => {
    const status = str(req.query.status, 20);
    const q = str(req.query.q, 80).toLowerCase();
    const rows = (await allPayments())
      .filter((row) => !status || row.status === status)
      .filter((row) => {
        if (!q) return true;
        return [row.program_name, row.reference, row.sender, String(row.user_id)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, 300);
    const payments = await Promise.all(rows.map(mapPaymentWithUser));

    if (req.query.page === undefined) {
      res.json({ payments });
      return;
    }
    res.json({ payments: pageSlice(payments, req) });
  })
);

app.post(
  "/api/admin/payments/:id/decision",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const action = str(req.body.action, 20);
    const note = str(req.body.note, 500);
    const payment = await getPayment(id);
    if (!payment) return void res.status(404).json({ error: "الدفعة غير موجودة." });
    if (!["approve", "reject"].includes(action)) return void res.status(400).json({ error: "إجراء غير معروف." });

    const status = action === "approve" ? "approved" : "rejected";
    await updatePayment(id, { status, note, reviewed_at: nowIso() });

    let subscriptionId: number | null = null;
    if (action === "approve") {
      const user = await findUserById(payment.user_id);
      const program = await getContent(payment.program_id);
      if (user && program) {
        const existing = await findSubscriptionByPayment(id);
        if (!existing) subscriptionId = await activateSubscription(user, program, id);
      }
      if (payment.coupon) await redeemCoupon(payment.coupon);
    }

    await logAudit(req.user, `payment.${action}`, "payment", id, { note, subscriptionId });
    res.json({ ok: true, status, subscriptionId });
  })
);

app.get(
  "/api/admin/customers",
  requireStaff,
  asyncRoute(async (req, res) => {
    const customers = await listCustomers(str(req.query.q, 80));
    if (req.query.page === undefined) {
      res.json({ customers });
      return;
    }
    res.json({ customers: pageSlice(customers, req) });
  })
);

async function listCustomers(search: string) {
  const now = nowIso();
  const [rows, summaries] = await Promise.all([listCustomerRows(), customerSummaries(now)]);
  const needle = search.trim().toLowerCase();

  return rows
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .filter((row) => {
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        String(row.phone ?? "").includes(needle)
      );
    })
    .slice(0, 500)
    .map((row) => {
      const summary = summaries.get(row.id);
      return {
        ...toPublicUser(row),
        activeSubscriptions: summary?.activeSubscriptions ?? 0,
        spent: summary?.spent ?? 0,
        endsAt: summary?.endsAt ?? null,
      };
    });
}

app.get(
  "/api/admin/customers/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await findUserById(id);
    if (!row || row.role !== "customer") return void res.status(404).json({ error: "العميل غير موجود." });

    const now = nowIso();
    const [subscriptionRows, paymentRows, coachRows, sessionRows, allContactRows, auditRows] = await Promise.all([
      listSubscriptionsByUser(id),
      listPaymentsByUser(id),
      listCoachMessagesByUser(id),
      listSessions(id),
      listMessages(1000),
      listAudit(500),
    ]);

    const subscriptions = subscriptionRows.map((entry) => mapSubscription(entry, row));
    const payments = paymentRows.map((payment) => mapPayment(payment, row));
    const coachMessages = coachRows.map(mapCoachMessage);
    const active = subscriptions
      .filter((entry) => entry.status === "active" && String(entry.endsAt) > now)
      .sort((a, b) => String(b.endsAt).localeCompare(String(a.endsAt)));
    const current = active[0] ?? null;
    const currentContent = current ? await getContent(current.programId) : undefined;
    const system = (currentContent?.ar as Record<string, unknown> | undefined)?.system as
      | Record<string, unknown>
      | undefined;
    const totalDays = current
      ? Math.max(1, Math.ceil((new Date(current.endsAt).getTime() - new Date(current.startsAt).getTime()) / 86_400_000))
      : 0;
    const daysLeft = current
      ? Math.max(0, Math.ceil((new Date(current.endsAt).getTime() - Date.now()) / 86_400_000))
      : 0;
    const progress = current ? Math.min(100, Math.max(2, Math.round(((totalDays - daysLeft) / totalDays) * 100))) : 0;
    const currentProgram: CustomerProgramInfo | null = current
      ? {
          name: current.programName,
          summary: String(system?.summary ?? ""),
          weeks: Array.isArray(system?.weeks) ? system.weeks.length : 0,
          workouts: Array.isArray(system?.workouts) ? system.workouts.length : 0,
          meals: Array.isArray(system?.meals) ? system.meals.length : 0,
          checkInEveryDays: Number(system?.checkInEveryDays ?? 0),
          image: String(currentContent?.common?.image ?? ""),
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          daysLeft,
          totalDays,
          progress,
        }
      : null;

    const email = String(row.email ?? "").toLowerCase();
    const phoneKey = String(row.phone ?? "").replace(/\D/g, "").slice(-10);
    const contactMessages: MessageDTO[] = allContactRows
      .filter(
        (message) =>
          String(message.email ?? "").toLowerCase() === email ||
          (phoneKey.length >= 8 && String(message.phone ?? "").replace(/\D/g, "").slice(-10) === phoneKey)
      )
      .map((message) => ({
        id: message.id,
        name: message.name,
        phone: message.phone,
        email: message.email,
        goal: message.goal,
        body: message.body,
        read: Boolean(message.read),
        createdAt: message.created_at,
      }));

    const sessions: CustomerSessionDTO[] = sessionRows.map((session) => ({
      createdAt: session.created_at,
      lastSeen: session.last_seen,
      ip: session.ip,
      userAgent: session.user_agent,
    }));

    const activity: CustomerActivityDTO[] = [
      {
        id: `join-${row.id}`,
        kind: "account" as const,
        title: "انضم للموقع",
        detail: row.email,
        at: row.created_at,
      },
      ...subscriptions.map((subscription) => ({
        id: `sub-${subscription.id}`,
        kind: "subscription" as const,
        title: `اشتراك في «${subscription.programName}»`,
        detail:
          subscription.status === "active" && String(subscription.endsAt) > now
            ? "باقة نشطة حاليًا"
            : subscription.status === "expired"
              ? "انتهت الباقة"
              : subscription.status === "cancelled"
                ? "تم إلغاء الباقة"
                : subscription.status,
        at: subscription.createdAt,
      })),
      ...payments.map((payment) => ({
        id: `pay-${payment.id}`,
        kind: "payment" as const,
        title: `دفعة ${new Intl.NumberFormat("en-US").format(payment.amount)} ج.م — ${payment.programName}`,
        detail:
          payment.status === "auto_approved" || payment.status === "approved"
            ? "تم قبول الدفعة"
            : payment.status === "pending"
              ? "بانتظار المراجعة"
              : "دفعة مرفوضة",
        at: payment.createdAt,
      })),
      ...coachMessages.map((message) => ({
        id: `chat-${message.id}`,
        kind: "chat" as const,
        title: message.sender === "doctor" ? "رد من الدكتور" : "رسالة للدكتور",
        detail: String(message.body || (message.mediaKind === "image" ? "📷 صورة" : message.mediaKind === "video" ? "🎬 فيديو" : "مرفق")).slice(0, 120),
        at: message.createdAt,
      })),
      ...contactMessages.map((message) => ({
        id: `contact-${message.id}`,
        kind: "message" as const,
        title: "رسالة من صفحة التواصل",
        detail: message.body.slice(0, 120),
        at: message.createdAt,
      })),
      ...sessions.slice(0, 8).map((session, index) => ({
        id: `session-${index}-${session.lastSeen}`,
        kind: "session" as const,
        title: "دخول للحساب",
        detail: [session.ip, session.userAgent].filter(Boolean).join(" · ").slice(0, 120),
        at: session.lastSeen,
      })),
      ...auditRows
        .filter((entry) => Number(entry.entity_id) === id && ["customer.update", "account.password_change"].includes(String(entry.action)))
        .map((entry) => ({
          id: `audit-${entry.id}`,
          kind: "account" as const,
          title: entry.action === "account.password_change" ? "تغيير كلمة المرور" : "تحديث بيانات الحساب",
          detail: String(entry.actor_name ?? "الإدارة"),
          at: String(entry.created_at),
        })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

    const stats: CustomerStats = {
      activeSubscriptions: active.length,
      totalSubscriptions: subscriptions.length,
      totalSpent: payments
        .filter((payment) => payment.status === "approved" || payment.status === "auto_approved")
        .reduce((sum, payment) => sum + payment.amount, 0),
      pendingPayments: payments.filter((payment) => payment.status === "pending").length,
      unreadCoach: coachRows.filter((message) => message.sender_role === "customer" && !message.read_by_doctor).length,
      contactMessages: contactMessages.length,
      sessions: sessions.length,
      lastSeen: sessions[0]?.lastSeen ?? null,
    };

    const customer = {
      ...toPublicUser(row),
      activeSubscriptions: active.length,
      spent: stats.totalSpent,
      endsAt: active[0]?.endsAt ?? null,
    };

    res.json({
      customer,
      subscriptions,
      payments,
      currentProgram,
      coachMessages,
      contactMessages,
      sessions,
      activity: activity.slice(0, 60),
      stats,
      files: (await listAssets("customer", String(id))).map((row) => mapAsset(row, true)),
      plan: mapClientPlan(await getClientPlan(id)),
      checkins: (await listCheckinsByUser(id)).map((entry) => mapCheckin(entry, row)),
    });
  })
);

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string
  );

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  expired: "منتهي",
  cancelled: "ملغي",
  pending: "قيد المراجعة",
  approved: "مقبول",
  auto_approved: "تم التحقق تلقائيًا",
  rejected: "مرفوض",
};

/**
 * Full customer statement as a printable page — the browser's print dialog
 * saves it as a real PDF file, so no PDF generator or Arabic font has to be
 * bundled into the serverless function.
 */
app.get(
  "/api/admin/customers/:id/report",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await findUserById(id);
    if (!row || row.role !== "customer") return void res.status(404).json({ error: "العميل غير موجود." });

    const now = nowIso();
    const [subscriptionRows, paymentRows, sessionRows, files] = await Promise.all([
      listSubscriptionsByUser(id),
      listPaymentsByUser(id),
      listSessions(id),
      listAssets("customer", String(id)),
    ]);
    const subscriptions = subscriptionRows.map((entry) => mapSubscription(entry, row));
    const payments = paymentRows.map((payment) => mapPayment(payment, row));
    const activeSubs = subscriptions.filter((entry) => entry.status === "active" && String(entry.endsAt) > now);
    const spent = payments
      .filter((payment) => ["approved", "auto_approved"].includes(payment.status))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const money = (value: number) => new Intl.NumberFormat("en-US").format(value);
    const day = (value: string | null | undefined) =>
      value ? new Date(value).toLocaleDateString("ar-EG") : "—";
    const stamp = (value: string | null | undefined) =>
      value
        ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })
        : "—";
    const cells = (list: string[]) => `<tr>${list.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    const info = (label: string, value: string) =>
      `<div class="row"><span>${escapeHtml(label)}</span><span>${value}</span></div>`;

    const subscriptionRowsHtml = subscriptions.length
      ? subscriptions
          .map((entry) =>
            cells([
              escapeHtml(entry.programName),
              day(entry.startsAt),
              day(entry.endsAt),
              escapeHtml(STATUS_LABEL[entry.status] ?? entry.status),
            ])
          )
          .join("")
      : `<tr><td colspan="4" class="empty">مفيش اشتراكات مسجلة.</td></tr>`;

    const paymentRowsHtml = payments.length
      ? payments
          .map((payment) =>
            cells([
              `#${payment.id}`,
              escapeHtml(payment.programName),
              money(payment.amount) + " ج.م",
              escapeHtml(payment.method === "vodafone" ? "فودافون كاش" : "إنستاباي"),
              escapeHtml(payment.reference || "—"),
              escapeHtml(STATUS_LABEL[payment.status] ?? payment.status),
              stamp(payment.createdAt),
            ])
          )
          .join("")
      : `<tr><td colspan="7" class="empty">مفيش مدفوعات مسجلة.</td></tr>`;

    const filesHtml = files.length
      ? files.map((asset) => `<li>${escapeHtml(asset.title || asset.filename)} (${escapeHtml(asset.kind)}) · ${day(asset.created_at)}</li>`).join("")
      : "<li class=\"empty\">مفيش ملفات مرفوعة للعميل.</li>";

    const devicesHtml = sessionRows.length
      ? sessionRows
          .slice(0, 6)
          .map((entry) => `<li>${escapeHtml(entry.ip || "IP غير معروف")} · ${stamp(entry.last_seen)}</li>`)
          .join("")
      : "<li class=\"empty\">مفيش أجهزة مسجلة.</li>";

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>بيان العميل — ${escapeHtml(row.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #111; margin: 0; padding: 24px; background: #fff; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 13px; margin: 0 0 8px; border-inline-start: 4px solid #8aa11f; padding-inline-start: 8px; }
  section { margin-top: 18px; }
  .muted { color: #666; font-size: 11px; margin: 4px 0 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .brand { text-align: left; font-weight: 700; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f3f4ef; font-weight: 700; }
  .empty { color: #888; text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dotted #ccc; padding: 5px 0; font-size: 11.5px; }
  .row span:last-child { font-weight: 700; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 8px; text-align: center; }
  .card b { display: block; font-size: 15px; }
  .card span { font-size: 10px; color: #666; }
  ul { margin: 0; padding-inline-start: 18px; font-size: 11px; }
  li { margin-bottom: 4px; }
  .foot { margin-top: 22px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 10px; color: #777; }
  .print { position: fixed; inset-inline-start: 16px; top: 16px; padding: 10px 18px; border: 0; border-radius: 999px; background: #111; color: #fff; font-size: 12px; cursor: pointer; }
  @media print { .print { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<button class="print" onclick="window.print()">حفظ PDF / طباعة</button>
<div class="head">
  <div>
    <h1>بيان العميل</h1>
    <p class="muted">د. مصطفى يوسف — استشاري تغذية علاجية ومدرب لياقة</p>
  </div>
  <div class="brand">
    <div>${escapeHtml(row.name)}</div>
    <div class="muted">#${row.id} · ${escapeHtml(row.email)}</div>
  </div>
</div>

<section>
  <div class="cards">
    <div class="card"><b>${activeSubs.length}</b><span>باقة نشطة</span></div>
    <div class="card"><b>${subscriptions.length}</b><span>إجمالي الاشتراكات</span></div>
    <div class="card"><b>${money(spent)}</b><span>إجمالي المدفوع (ج.م)</span></div>
    <div class="card"><b>${files.length}</b><span>ملفات خاصة</span></div>
  </div>
</section>

<section>
  <h2>بيانات الحساب</h2>
  <div class="row"><span>الاسم</span><span>${escapeHtml(row.name)}</span></div>
  ${info("الإيميل", escapeHtml(row.email))}
  ${info("الموبايل", escapeHtml(row.phone || "—"))}
  ${info("تاريخ الانضمام", day(row.created_at))}
  ${info("حالة الحساب", row.blocked ? "موقوف" : "نشط")}
  ${info("آخر باقة تنتهي", activeSubs[0] ? day(activeSubs[0].endsAt) : "—")}
  ${info("عدد الأجهزة المسجلة", String(sessionRows.length))}
</section>

<section>
  <h2>الاشتراكات</h2>
  <table>
    <thead><tr><th>الباقة</th><th>تبدأ</th><th>تنتهي</th><th>الحالة</th></tr></thead>
    <tbody>${subscriptionRowsHtml}</tbody>
  </table>
</section>

<section>
  <h2>المدفوعات</h2>
  <table>
    <thead><tr><th>رقم</th><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية</th><th>الحالة</th><th>التاريخ</th></tr></thead>
    <tbody>${paymentRowsHtml}</tbody>
  </table>
</section>

<section>
  <h2>ملفات الدكتور الخاصة بالعميل</h2>
  <ul>${filesHtml}</ul>
</section>

<section>
  <h2>الأجهزة والجلسات</h2>
  <ul>${devicesHtml}</ul>
</section>

<div class="foot">
  تم إنشاء البيان في ${stamp(now)} — د. مصطفى يوسف. البيانات دي سرية ومخصصة للعميل وإدارة الموقع فقط.
</div>
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  })
);

app.post(
  "/api/admin/customers",
  requireStaff,
  asyncRoute(async (req, res) => {
    const name = str(req.body.name, 80);
    const email = str(req.body.email, 160).toLowerCase();
    const phone = str(req.body.phone, 24);
    const password = String(req.body.password ?? "");
    if (name.length < 2) return void res.status(400).json({ error: "اكتب اسم العميل." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void res.status(400).json({ error: "الإيميل مش صحيح." });
    if (password.length < 8) return void res.status(400).json({ error: "الباسورد لازم 8 حروف على الأقل." });
    const exists = await findUserByEmail(email);
    if (exists) {
      return void res.status(409).json({ error: "الإيميل مسجل بالفعل." });
    }
    const { salt, hash } = hashPassword(password);
    const created = await createUser({
      role: "customer",
      name,
      email,
      phone,
      password_salt: salt,
      password_hash: hash,
    });
    await logAudit(req.user, "customer.create", "user", created.id, { email });
    res.status(201).json({ ok: true, id: created.id });
  })
);

app.patch(
  "/api/admin/customers/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const target = await findUserById(id);
    if (!target) return void res.status(404).json({ error: "العميل غير موجود." });
    if (target.role === "admin") return void res.status(400).json({ error: "مش ممكن تعديل حساب الدكتور من هنا." });

    const patch: Partial<UserRow> = {};
    const fields: string[] = [];

    if (req.body.blocked !== undefined) {
      patch.blocked = req.body.blocked ? 1 : 0;
      fields.push("blocked");
    }
    if (req.body.name !== undefined) {
      const name = str(req.body.name, 80);
      if (name.length < 2) return void res.status(400).json({ error: "الاسم قصير." });
      patch.name = name;
      fields.push("name");
    }
    if (req.body.phone !== undefined) {
      patch.phone = str(req.body.phone, 24);
      fields.push("phone");
    }
    if (req.body.email !== undefined) {
      const email = str(req.body.email, 160).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void res.status(400).json({ error: "الإيميل مش صحيح." });
      const conflict = await findUserByEmail(email);
      if (conflict && conflict.id !== id) {
        return void res.status(409).json({ error: "الإيميل مستخدم لحساب تاني." });
      }
      patch.email = email;
      fields.push("email");
    }
    if (req.body.password) {
      const password = String(req.body.password);
      if (password.length < 8) return void res.status(400).json({ error: "الباسورد لازم 8 حروف على الأقل." });
      const { salt, hash } = hashPassword(password);
      patch.password_salt = salt;
      patch.password_hash = hash;
      patch.session_version = Number(target.session_version ?? 0) + 1;
      fields.push("password");
    }

    if (fields.length > 0) {
      await updateUser(id, patch);
    }
    await logAudit(req.user, "customer.update", "user", id, { fields });
    const updated = (await findUserById(id))!;
    res.json({ ok: true, user: toPublicUser(updated) });
  })
);

function mapSubscription(row: any, user?: Partial<UserRow> | null) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: row.user_name ?? user?.name,
    userEmail: row.user_email ?? user?.email,
    programId: row.program_id,
    programName: row.program_name,
    paymentId: row.payment_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function mapSubscriptionWithUser(row: any) {
  return mapSubscription(row, await findUserById(Number(row.user_id)));
}

app.get(
  "/api/admin/subscriptions",
  requireStaff,
  asyncRoute(async (req, res) => {
    await expireOldSubscriptions(nowIso());
    const status = str(req.query.status, 20);
    const rows = (await allSubscriptions())
      .filter((row) => !status || row.status === status)
      .slice(0, 500);

    const subscriptions = await Promise.all(rows.map(mapSubscriptionWithUser));
    if (req.query.page === undefined) {
      res.json({ subscriptions });
      return;
    }
    res.json({ subscriptions: pageSlice(subscriptions, req) });
  })
);

app.post(
  "/api/admin/subscriptions",
  requireStaff,
  asyncRoute(async (req, res) => {
    const userId = int(req.body.userId);
    const programId = str(req.body.programId, 80);
    const days = int(req.body.days, 0);
    const user = await findUserById(userId);
    if (!user || user.role !== "customer") return void res.status(404).json({ error: "العميل غير موجود." });
    const program = await getContent(programId);
    if (!program || program.collection !== "programs") {
      return void res.status(404).json({ error: "الباقة غير موجودة." });
    }
    const subscriptionId = await activateSubscription(user, program, null, days > 0 ? days : undefined);
    await logAudit(req.user, "subscription.grant", "subscription", subscriptionId, { userId, programId, days });
    res.status(201).json({ ok: true, subscriptionId });
  })
);

app.post(
  "/api/admin/subscriptions/:id/status",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const status = str(req.body.status, 20);
    if (!["active", "cancelled", "expired"].includes(status)) {
      return void res.status(400).json({ error: "حالة غير معروفة." });
    }
    await setSubscriptionStatus(id, status);
    await logAudit(req.user, "subscription.status", "subscription", id, { status });
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/messages",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const rows = await listMessages(500);
    res.json({
      messages: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        phone: row.phone,
        email: row.email,
        goal: row.goal,
        body: row.body,
        read: Boolean(row.read),
        createdAt: row.created_at,
      })),
    });
  })
);

app.patch(
  "/api/admin/messages/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    await setMessageRead(int(req.params.id), Boolean(req.body.read));
    res.json({ ok: true });
  })
);

app.delete(
  "/api/admin/messages/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const deletedId = int(req.params.id);
    const message = await getRow("messages", deletedId);
    await deleteMessage(deletedId);
    await logAudit(req.user, "message.delete", "message", deletedId, {
      name: message?.name ?? "",
      email: message?.email ?? "",
    });
    res.json({ ok: true });
  })
);

const COLLECTIONS = ["programs", "services", "testimonials", "results", "posts", "faqs", "credentials"];

app.get(
  "/api/admin/content/:collection",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const collection = str(req.params.collection, 30);
    if (!COLLECTIONS.includes(collection)) return void res.status(400).json({ error: "قسم غير معروف." });
    const items = await listContent(collection);
    res.json({ items: collection === "programs" ? await programsWithAssets(items) : items });
  })
);

function readItem(req: Request, collection: string): ContentItem {
  const body = req.body ?? {};
  return {
    id: str(body.id, 80) || `${collection.slice(0, 4)}-${randomBytes(4).toString("hex")}`,
    collection: collection as ContentItem["collection"],
    sort: int(body.sort, 0),
    active: body.active !== false,
    common: safeJson(body.common, {}),
    ar: safeJson(body.ar, {}),
    en: safeJson(body.en, {}),
  };
}

app.post(
  "/api/admin/content/:collection",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const collection = str(req.params.collection, 30);
    if (!COLLECTIONS.includes(collection)) return void res.status(400).json({ error: "قسم غير معروف." });
    const item = readItem(req, collection);
    if (!item.id) return void res.status(400).json({ error: "محتاج معرّف للعنصر." });
    // Plan files live in their own table; never trust the editor payload for them.
    if (collection === "programs") delete item.common.assets;
    await upsertContent(item);
    await logAudit(req.user, "content.create", collection, item.id);
    res.status(201).json({ item });
  })
);

app.patch(
  "/api/admin/content/:collection/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const collection = str(req.params.collection, 30);
    if (!COLLECTIONS.includes(collection)) return void res.status(400).json({ error: "قسم غير معروف." });
    const id = str(req.params.id, 80);
    const existing = await getContent(id);
    if (!existing) return void res.status(404).json({ error: "العنصر غير موجود." });

    const item: ContentItem = {
      id,
      collection: collection as ContentItem["collection"],
      sort: req.body.sort !== undefined ? int(req.body.sort, existing.sort) : existing.sort,
      active: req.body.active !== undefined ? Boolean(req.body.active) : existing.active,
      common: req.body.common !== undefined ? safeJson(req.body.common, existing.common) : existing.common,
      ar: req.body.ar !== undefined ? safeJson(req.body.ar, existing.ar) : existing.ar,
      en: req.body.en !== undefined ? safeJson(req.body.en, existing.en) : existing.en,
    };
    if (collection === "programs") delete item.common.assets;

    await upsertContent(item);
    await logAudit(req.user, "content.update", collection, id);
    res.json({ item });
  })
);

app.delete(
  "/api/admin/content/:collection/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const targetId = str(req.params.id, 80);
    const targetCollection = str(req.params.collection, 30);
    await deleteContent(targetId, targetCollection);
    await logAudit(req.user, "content.delete", targetCollection, targetId);
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/settings",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.json({ settings: await getSettings() });
  })
);

app.put(
  "/api/admin/settings",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const incoming = (req.body ?? {}) as SiteSettings;
    const current = await getSettings();
    const next: SiteSettings = {
      contact: { ...current.contact, ...(incoming.contact ?? {}) },
      payments: {
        ...current.payments,
        ...(incoming.payments ?? {}),
        autoApprove:
          incoming.payments?.autoApprove === undefined
            ? current.payments.autoApprove
            : Boolean(incoming.payments.autoApprove),
      },
      hero: { ...current.hero, ...(incoming.hero ?? {}) },
      announcement: { ...current.announcement, ...(incoming.announcement ?? {}) },
    };

    for (const [groupKey, group] of Object.entries(next) as [string, Record<string, unknown>][]) {
      if (!group || typeof group !== "object") continue;
      for (const [key, value] of Object.entries(group)) {
        if (typeof value === "string" && value.length > 4000) {
          return void res.status(400).json({ error: `القيمة ${groupKey}.${key} طويلة جدًا.` });
        }
      }
    }

    await saveSettings(next);
    await logAudit(req.user, "settings.update", "settings", "site");
    res.json({ settings: next });
  })
);

app.get(
  "/api/admin/copy",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.json({ copy: await getCopyOverrides() });
  })
);

app.put(
  "/api/admin/copy",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const body = req.body ?? {};
    const normalize = (value: unknown): Record<string, string> => {
      const output: Record<string, string> = {};
      if (!value || typeof value !== "object") return output;
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (typeof entry !== "string") continue;
        if (key.length > 160 || entry.length > 6000) continue;
        output[key] = entry;
      }
      return output;
    };
    const next = { ar: normalize(body.ar), en: normalize(body.en) };
    if (JSON.stringify(next).length > 400_000) {
      return void res.status(400).json({ error: "حجم النصوص كبير جدًا." });
    }
    await saveCopyOverrides(next);
    await logAudit(req.user, "copy.update", "settings", "copy");
    res.json({ copy: next });
  })
);

app.get(
  "/api/admin/audit",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const rows = await listAudit(200);
    res.json({
      entries: rows.map((row) => ({
        id: Number(row.id),
        actorName: row.actor_name,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        meta: safeJson(row.meta, {}),
        createdAt: row.created_at,
      })),
    });
  })
);

// Deleting an audit entry does not create a new audit entry on purpose: the
// log is the thing being cleaned, so recording the cleanup inside it would
// defeat the purpose. The admin session is still the only way in.
app.delete(
  "/api/admin/audit/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    if (!id) return void res.status(400).json({ error: "رقم العملية غير صحيح." });
    const removed = await deleteAudit(id);
    if (!removed) return void res.status(404).json({ error: "العملية مش موجودة." });
    res.json({ ok: true });
  })
);

app.delete(
  "/api/admin/audit",
  requireAdmin,
  asyncRoute(async (req, res) => {
    if (req.query.confirm !== "1") {
      return void res.status(400).json({ error: "تأكيد الحذف غير مُرسل." });
    }
    const removed = await clearAudit();
    res.json({ ok: true, removed });
  })
);

app.get(
  "/api/admin/media",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const rows = await listMedia(200);
    // Rows uploaded before the uploader was stored fall back to whoever the
    // audit log says uploaded them, so old images are never shown as anonymous.
    const uploaders = new Map<string, string>();
    for (const entry of await listAudit(500)) {
      if (entry.action === "media.upload" && !uploaders.has(String(entry.entity_id))) {
        uploaders.set(String(entry.entity_id), String(entry.actor_name ?? ""));
      }
    }
    res.json({
      media: rows.map((row) => ({
        id: Number(row.id),
        url: row.url,
        filename: row.filename,
        mime: row.mime,
        size: Number(row.size),
        createdAt: row.created_at,
        width: row.width ?? null,
        height: row.height ?? null,
        uploadedBy: row.uploaded_by ?? null,
        uploadedByName: row.uploaded_by_name || uploaders.get(String(row.id)) || "",
      })),
    });
  })
);

app.post(
  "/api/admin/media",
  requireAdmin,
  contentLengthGuard,
  mediaUpload.single("file"),
  asyncRoute(async (req, res) => {
    const file = req.file;
    if (!file || !isRealImage(file.path)) {
      if (file) {
        try {
          unlinkSync(file.path);
        } catch {
          /* ignore */
        }
      }
      return void res.status(400).json({ error: "ارفع صورة صحيحة (JPG/PNG/WebP)." });
    }
    const filename = path.basename(file.path);
    const url = `/uploads/${filename}`;
    const bytes = readFileSync(file.path);
    const dims = imageSize(file.path);
    const createdAt = nowIso();

    let mediaId: number;
    try {
      await putFile(filename, bytes, file.mimetype || "application/octet-stream");
      mediaId = await createMedia({
        url,
        filename,
        mime: file.mimetype,
        size: file.size,
        created_at: createdAt,
        width: dims.width,
        height: dims.height,
        uploaded_by: req.user?.id ?? null,
        uploaded_by_name: req.user?.name ?? "",
      });
    } catch (error) {
      await deleteFile(filename).catch(() => undefined);
      throw error;
    } finally {
      try {
        unlinkSync(file.path);
      } catch {
        /* already gone */
      }
    }

    await logAudit(req.user, "media.upload", "media", mediaId, { url });
    res.status(201).json({
      media: {
        id: mediaId,
        url,
        filename,
        mime: file.mimetype,
        size: file.size,
        createdAt,
        width: dims.width,
        height: dims.height,
        uploadedBy: req.user?.id ?? null,
        uploadedByName: req.user?.name ?? "",
      },
    });
  })
);

app.delete(
  "/api/admin/media/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await getMedia(id);
    if (!row) return void res.status(404).json({ error: "الصورة غير موجودة." });
    await deleteMedia(id);
    await deleteFile(path.basename(row.filename)).catch(() => undefined);
    await logAudit(req.user, "media.delete", "media", id, { url: row.url, filename: row.filename });
    res.json({ ok: true });
  })
);

/* ---------------------------- plan & client files -------------------------- */

/**
 * Everything the doctor can attach to a plan (public on that plan's page) or to
 * one client (private, shown in their account): images, videos, PDFs and
external video links. Files upload as ≤ 3 MB chunks through the same session
 * machinery as chat attachments, so a 60 MB video still clears the serverless
 * body limit.
 */
const ASSET_MIMES: Record<string, AssetKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "application/pdf": "pdf",
};

const assetChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_CHUNK_BYTES },
  fileFilter: (_req, file, done) => done(null, Boolean(ASSET_MIMES[file.mimetype])),
});

const assetKind = (mime: string): AssetKind => ASSET_MIMES[mime] ?? "file";

function mapAsset(row: AssetRow, unlocked = true): SiteAsset {
  const visibility: AssetVisibility = row.visibility === "subscribers" ? "subscribers" : "public";
  const locked = visibility === "subscribers" && !unlocked;
  return {
    id: Number(row.id),
    kind: (row.kind as AssetKind) || assetKind(String(row.mime)),
    url: locked ? "" : String(row.url ?? ""),
    filename: String(row.filename ?? ""),
    mime: String(row.mime ?? ""),
    size: Number(row.size ?? 0),
    title: String(row.title ?? ""),
    note: String(row.note ?? ""),
    visibility,
    sort: Number(row.sort ?? 0),
    locked,
    createdAt: String(row.created_at ?? ""),
  };
}

/** Plan files ride along with the content rows so the public site sees them. */
async function programsWithAssets(items: ContentItem[], unlocked = true): Promise<ContentItem[]> {
  const rows = (await allAssets()).filter((row) => row.owner_type === "program");
  const grouped = new Map<string, SiteAsset[]>();
  for (const row of rows) {
    const list = grouped.get(String(row.owner_id)) ?? [];
    list.push(mapAsset(row, unlocked));
    grouped.set(String(row.owner_id), list);
  }
  return items.map((item) => ({ ...item, common: { ...item.common, assets: grouped.get(item.id) ?? [] } }));
}

async function resolveAssetOwner(ownerType: string, ownerId: string): Promise<AssetOwnerType | null> {
  if (ownerType === "program") {
    const item = await getContent(ownerId);
    return item && item.collection === "programs" ? "program" : null;
  }
  if (ownerType === "customer") {
    const user = await findUserById(Number(ownerId));
    return user && user.role === "customer" ? "customer" : null;
  }
  return null;
}

app.post(
  "/api/admin/assets/uploads",
  requireStaff,
  asyncRoute(async (req, res) => {
    const mime = String(req.body?.mime ?? "").trim().toLowerCase();
    if (!ASSET_MIMES[mime]) {
      return void res.status(400).json({ error: "الملف لازم يكون صورة أو فيديو أو PDF." });
    }
    const bytes = Number(req.body?.bytes);
    if (!Number.isInteger(bytes) || bytes < 1) {
      return void res.status(400).json({ error: "حجم الملف مش واضح. جرّب تاني." });
    }
    if (bytes > CHAT_MAX_FILE_BYTES) {
      return void res.status(413).json({
        error: `حجم الملف كبير. الحد الأقصى ${Math.round(CHAT_MAX_FILE_BYTES / 1024 / 1024)} ميجا.`,
      });
    }
    const chunks = Math.ceil(bytes / CHAT_CHUNK_BYTES);
    const kind = assetKind(mime);
    const meta = await createChatUpload({
      userId: req.user!.id,
      mime,
      kind: kind === "image" ? "image" : kind === "video" ? "video" : "file",
      bytes,
      chunks,
    });
    res.status(201).json({ uploadId: meta.id, chunks, chunkBytes: CHAT_CHUNK_BYTES });
  })
);

app.post(
  "/api/admin/assets/uploads/:id/:index",
  requireStaff,
  chunkLengthGuard,
  assetChunkUpload.single("file"),
  asyncRoute(async (req, res) => {
    const id = String(req.params.id ?? "");
    const index = Number(req.params.index);
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(id) || !Number.isInteger(index) || index < 0) {
      return void res.status(400).json({ error: "جلسة الرفع مش صحيحة." });
    }
    const meta = await getChatUpload(id);
    if (!meta) return void res.status(410).json({ error: "انتهت جلسة الرفع. ارفع الملف تاني." });
    if (Number(meta.userId) !== Number(req.user!.id)) {
      return void res.status(403).json({ error: "الملف ده مش متاح لحسابك." });
    }
    if (index >= meta.chunks) return void res.status(400).json({ error: "رقم الجزء غير صحيح." });
    if (!req.file) return void res.status(400).json({ error: "الملف مش صحيح." });
    const saved = await putChatUploadPart(id, index, req.file.buffer);
    if (!saved) return void res.status(400).json({ error: "تعذر حفظ الجزء. جرب تاني." });
    res.json({
      uploadId: id,
      index,
      received: saved.partBytes.filter((size) => Number(size) > 0).length,
      total: meta.chunks,
    });
  })
);

app.post(
  "/api/admin/assets",
  requireStaff,
  asyncRoute(async (req, res) => {
    const ownerId = str(req.body.ownerId, 120);
    const ownerType = str(req.body.ownerType, 20);
    const owner = await resolveAssetOwner(ownerType, ownerId);
    if (!owner) return void res.status(404).json({ error: "الباقة أو العميل مش موجود." });

    const title = str(req.body.title, 160);
    const note = str(req.body.note, 600);
    const sort = Date.now();
    // Only plan files can be locked to subscribers; a client's own files stay private.
    const visibility = owner === "program" && str(req.body.visibility, 20) === "subscribers" ? "subscribers" : "public";

    // A YouTube / Vimeo / Drive link instead of an uploaded file.
    const linkRaw = String(req.body.link ?? "").trim();
    if (linkRaw) {
      const link = safeVideoUrl(linkRaw);
      if (!link) {
        return void res.status(400).json({ error: "رابط الفيديو لازم يكون من YouTube أو Vimeo أو Google Drive." });
      }
      const row = await createAsset({
        owner_type: owner,
        owner_id: ownerId,
        kind: "video",
        url: link,
        storage: "",
        filename: link,
        mime: "video/link",
        size: 0,
        title: title || "فيديو",
        note,
        sort,
        visibility,
        created_at: nowIso(),
      });
      await logAudit(req.user, "asset.create", owner, ownerId, { kind: "video", link: true });
      if (owner === "customer") {
        await notifyCustomer(Number(ownerId), "file", "فيديو جديد من الدكتور", `رفع لك الدكتور: ${title || "فيديو جديد"}`);
      }
      res.status(201).json({ asset: mapAsset(row) });
      return;
    }

    const uploadId = str(req.body.uploadId, 80);
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(uploadId)) {
      return void res.status(400).json({ error: "ارفع ملف أو حط رابط فيديو." });
    }
    const meta = await getChatUpload(uploadId);
    if (!meta) return void res.status(410).json({ error: "انتهت جلسة الرفع. ارفع الملف تاني." });
    if (Number(meta.userId) !== Number(req.user!.id)) {
      return void res.status(403).json({ error: "الملف ده مش متاح لحسابك." });
    }
    if (!ASSET_MIMES[meta.mime]) {
      return void res.status(400).json({ error: "الملف لازم يكون صورة أو فيديو أو PDF." });
    }
    const recorded = meta.partBytes.slice(0, meta.chunks);
    const complete = recorded.length === meta.chunks && recorded.every((size) => Number(size) > 0);
    const total = recorded.reduce((sum, size) => sum + Number(size || 0), 0);
    if (!complete || total !== Number(meta.bytes)) {
      return void res.status(400).json({ error: "رفع الملف مش مكتمل. اختر الملف تاني وارفعه." });
    }
    const head = await getChatUploadPart(uploadId, 0);
    if (!head) return void res.status(400).json({ error: "رفع الملف مش مكتمل. اختر الملف تاني وارفعه." });
    const kind = assetKind(meta.mime);
    const valid =
      kind === "image"
        ? looksLikeImage(head.subarray(0, 32))
        : kind === "video"
          ? looksLikeVideo(head.subarray(0, 12))
          : head.subarray(0, 4).toString() === "%PDF";
    if (!valid) return void res.status(400).json({ error: "الملف ده مش صورة أو فيديو أو PDF صحيح." });
    if (!(await claimChatUpload(uploadId))) {
      return void res.status(409).json({ error: "الملف ده اترفع قبل كده." });
    }
    let frozen = false;
    try {
      frozen = await attachChatUpload(meta);
    } finally {
      if (!frozen) await releaseChatUploadClaim(uploadId).catch(() => undefined);
    }
    if (!frozen) return void res.status(410).json({ error: "انتهت جلسة الرفع. ارفع الملف تاني." });

    const created = await createAsset({
      owner_type: owner,
      owner_id: ownerId,
      kind,
      url: "",
      storage: uploadId,
      filename: str(req.body.filename, 160) || `file-${Date.now()}`,
      mime: meta.mime,
      size: Number(meta.bytes),
      title: title || str(req.body.filename, 160) || "ملف",
      note,
      sort,
      visibility,
      created_at: nowIso(),
    });
    const row = (await updateAsset(created.id, { url: `/api/assets/${created.id}` })) ?? created;
    await logAudit(req.user, "asset.create", owner, ownerId, { kind, bytes: Number(meta.bytes) });
    if (owner === "customer") {
      await notifyCustomer(Number(ownerId), "file", "ملف جديد من الدكتور", `رفع لك الدكتور: ${title || str(req.body.filename, 160) || "ملف"}`);
    }
    res.status(201).json({ asset: mapAsset(row) });
  })
);

app.get(
  "/api/admin/assets",
  requireStaff,
  asyncRoute(async (req, res) => {
    const ownerType = str(req.query.ownerType, 20);
    const ownerId = str(req.query.ownerId, 120);
    if (!["program", "customer"].includes(ownerType) || !ownerId) {
      return void res.status(400).json({ error: "محتاج تحديد الباقة أو العميل." });
    }
    const rows = await listAssets(ownerType as AssetOwnerType, ownerId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ assets: rows.map((row) => mapAsset(row, true)) });
  })
);

app.patch(
  "/api/admin/assets/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await getAsset(id);
    if (!row) return void res.status(404).json({ error: "الملف مش موجود." });
    const updated = await updateAsset(id, {
      title: req.body.title !== undefined ? str(req.body.title, 160) : row.title,
      note: req.body.note !== undefined ? str(req.body.note, 600) : row.note,
      sort: req.body.sort !== undefined ? int(req.body.sort, row.sort) : row.sort,
      visibility:
        req.body.visibility !== undefined && row.owner_type === "program"
          ? str(req.body.visibility, 20) === "subscribers"
            ? "subscribers"
            : "public"
          : row.visibility,
    });
    await logAudit(req.user, "asset.update", row.owner_type, row.owner_id, { assetId: id });
    res.json({ asset: updated ? mapAsset(updated) : mapAsset(row) });
  })
);

app.delete(
  "/api/admin/assets/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await getAsset(id);
    if (!row) return void res.status(404).json({ error: "الملف مش موجود." });
    await deleteAsset(id);
    if (row.storage) await deleteFile(row.storage).catch(() => undefined);
    await logAudit(req.user, "asset.delete", row.owner_type, row.owner_id, { assetId: id });
    res.json({ ok: true });
  })
);

/** Plan files are public; client files are readable by the client or the doctor. */
app.get(
  "/api/assets/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = Number.isFinite(id) ? await getAsset(id) : undefined;
    if (!row) return void res.status(404).json({ error: "الملف مش موجود." });
    if (row.owner_type === "customer") {
      if (!req.user) return void res.status(401).json({ error: "سجل دخول الأول." });
      const isTeam = ["admin", "staff"].includes(req.user.role);
      if (!isTeam && Number(row.owner_id) !== Number(req.user.id)) {
        return void res.status(403).json({ error: "الملف ده مش متاح لحسابك." });
      }
    }
    if (row.visibility === "subscribers" && row.owner_type === "program") {
      if (!req.user) return void res.status(401).json({ error: "الملف ده للمشتركين. سجل دخول وفعّل باقتك." });
      if (!["admin", "staff"].includes(req.user.role) && !(await hasActivePlan(req.user.id))) {
        return void res.status(403).json({ error: "الملف ده للمشتركين في الباقة. فعّل باقتك الأول." });
      }
    }
    if (!row.storage) {
      res.redirect(String(row.url));
      return;
    }
    const meta = await getFileMeta(row.storage);
    if (!meta || !meta.parts) return void res.status(404).json({ error: "الملف مش موجود." });

    const name = row.filename || "file";
    const download = req.query.download === "1";
    const total = Number(meta.bytes ?? 0);
    const parts = Number(meta.parts ?? 0);
    res.setHeader("Content-Type", meta.mime || "application/octet-stream");
    res.setHeader("Cache-Control", row.owner_type === "customer" ? "private, no-store" : "public, max-age=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`
    );
    res.setHeader("Accept-Ranges", "bytes");

    const range = parseByteRange(req.headers.range, total);
    if (range === "invalid") {
      res.status(416).setHeader("Content-Range", `bytes */${total}`);
      res.end();
      return;
    }
    const from = range ? range.start : 0;
    const to = range ? range.end : Math.max(0, total - 1);
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${from}-${to}/${total}`);
    }
    res.setHeader("Content-Length", String(total === 0 ? 0 : to - from + 1));
    const first = Math.floor(from / CHAT_CHUNK_BYTES);
    const last = Math.min(parts - 1, Math.floor(to / CHAT_CHUNK_BYTES));
    for (let index = first; index <= last; index += 1) {
      if (res.destroyed) return;
      const part = await getChatUploadPart(row.storage, index);
      if (!part) break;
      const offset = index * CHAT_CHUNK_BYTES;
      const slice = part.subarray(Math.max(0, from - offset), Math.min(part.length, to - offset + 1));
      if (!slice.length) continue;
      try {
        if (!res.write(slice)) {
          const flushed = await new Promise<boolean>((resolve) => {
            const onDrain = () => {
              res.off("close", onClose);
              resolve(true);
            };
            const onClose = () => {
              res.off("drain", onDrain);
              resolve(false);
            };
            res.once("drain", onDrain);
            res.once("close", onClose);
          });
          if (!flushed) return;
        }
      } catch {
        return;
      }
    }
    res.end();
  })
);

/* --------------------------- coupons & discounts --------------------------- */

function mapCoupon(row: CouponRow): CouponDTO {
  return {
    id: Number(row.id),
    code: String(row.code ?? ""),
    kind: row.kind === "amount" ? "amount" : "percent",
    value: Number(row.value ?? 0),
    maxUses: Number(row.max_uses ?? 0),
    used: Number(row.used ?? 0),
    expiresAt: row.expires_at ?? null,
    active: Boolean(row.active),
    createdAt: String(row.created_at ?? ""),
  };
}

/** Returns the discount for a usable coupon, or null when it cannot be used. */
async function resolveCoupon(code: string, price: number): Promise<{ code: string; discount: number } | null> {
  if (!code.trim()) return null;
  const row = await findCouponByCode(code);
  if (!row || !row.active) return null;
  if (row.expires_at && String(row.expires_at) < nowIso()) return null;
  if (Number(row.max_uses) > 0 && Number(row.used ?? 0) >= Number(row.max_uses)) return null;
  const raw = row.kind === "amount" ? Number(row.value) : Math.round((price * Number(row.value)) / 100);
  const discount = Math.min(price, Math.max(0, Math.round(raw)));
  if (discount <= 0) return null;
  return { code: String(row.code), discount };
}

async function redeemCoupon(code: string): Promise<void> {
  const row = await findCouponByCode(code);
  if (!row) return;
  await updateCoupon(row.id, { used: Number(row.used ?? 0) + 1 });
}

app.post(
  "/api/coupons/validate",
  asyncRoute(async (req, res) => {
    if (await limited(`coupon:${req.ip ?? "x"}`, 40, 60_000)) {
      return void res.status(429).json({ error: "محاولات كتير. استنى دقيقة." });
    }
    const program = await getContent(str(req.body.programId, 80));
    if (!program || program.collection !== "programs") {
      return void res.status(404).json({ error: "الباقة غير موجودة." });
    }
    const price = int(program.common.amount, 0);
    const applied = await resolveCoupon(str(req.body.code, 40), price);
    if (!applied) return void res.status(400).json({ error: "الكود غير صحيح أو انتهت صلاحيته." });
    res.json({ code: applied.code, discount: applied.discount, total: Math.max(0, price - applied.discount) });
  })
);

app.get(
  "/api/admin/coupons",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ coupons: (await listCoupons()).map(mapCoupon) });
  })
);

app.post(
  "/api/admin/coupons",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const code = str(req.body.code, 40).trim().toUpperCase().replace(/\s+/g, "");
    if (code.length < 3) return void res.status(400).json({ error: "كود الخصم لازم ٣ حروف على الأقل." });
    if (await findCouponByCode(code)) return void res.status(409).json({ error: "الكود ده موجود قبل كده." });
    const kind = str(req.body.kind, 10) === "amount" ? "amount" : "percent";
    const value = Math.max(1, int(req.body.value, 0));
    if (kind === "percent" && value > 100) return void res.status(400).json({ error: "النسبة لازم تكون ١٠٠ أو أقل." });
    const row = await createCoupon({
      code,
      kind,
      value,
      max_uses: Math.max(0, int(req.body.maxUses, 0)),
      expires_at: str(req.body.expiresAt, 30) || null,
      active: req.body.active === false ? 0 : 1,
    });
    await logAudit(req.user, "coupon.create", "coupon", row.id, { code, kind, value });
    res.status(201).json({ coupon: mapCoupon(row) });
  })
);

app.patch(
  "/api/admin/coupons/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const rows = await listCoupons();
    const existing = rows.find((row) => Number(row.id) === id);
    if (!existing) return void res.status(404).json({ error: "الكود مش موجود." });
    const updated = await updateCoupon(id, {
      active: req.body.active === undefined ? existing.active : req.body.active ? 1 : 0,
      max_uses: req.body.maxUses === undefined ? existing.max_uses : Math.max(0, int(req.body.maxUses, 0)),
      expires_at: req.body.expiresAt === undefined ? existing.expires_at : str(req.body.expiresAt, 30) || null,
    });
    await logAudit(req.user, "coupon.update", "coupon", id, {});
    res.json({ coupon: mapCoupon((updated ?? existing) as CouponRow) });
  })
);

app.delete(
  "/api/admin/coupons/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    await deleteCoupon(id);
    await logAudit(req.user, "coupon.delete", "coupon", id, {});
    res.json({ ok: true });
  })
);

/* ------------------------------ client plans ------------------------------- */

const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function mapClientPlan(row: ClientPlanRow | undefined): ClientPlanDTO | null {
  if (!row) return null;
  return {
    heightCm: numOrNull(row.height_cm),
    startWeight: numOrNull(row.start_weight),
    currentWeight: numOrNull(row.current_weight),
    targetWeight: numOrNull(row.target_weight),
    calories: numOrNull(row.calories),
    protein: numOrNull(row.protein),
    carbs: numOrNull(row.carbs),
    fat: numOrNull(row.fat),
    goal: String(row.goal ?? ""),
    medicalNotes: String(row.medical_notes ?? ""),
    notes: String(row.notes ?? ""),
    updatedAt: row.updated_at ?? null,
  };
}

app.get(
  "/api/admin/customers/:id/plan",
  requireStaff,
  asyncRoute(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ plan: mapClientPlan(await getClientPlan(int(req.params.id))) });
  })
);

app.put(
  "/api/admin/customers/:id/plan",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const target = await findUserById(id);
    if (!target || target.role !== "customer") {
      return void res.status(404).json({ error: "العميل غير موجود." });
    }
    const row: ClientPlanRow = {
      id,
      user_id: id,
      height_cm: numOrNull(req.body.heightCm),
      start_weight: numOrNull(req.body.startWeight),
      current_weight: numOrNull(req.body.currentWeight),
      target_weight: numOrNull(req.body.targetWeight),
      calories: numOrNull(req.body.calories),
      protein: numOrNull(req.body.protein),
      carbs: numOrNull(req.body.carbs),
      fat: numOrNull(req.body.fat),
      goal: str(req.body.goal, 160),
      medical_notes: str(req.body.medicalNotes, 2000),
      notes: str(req.body.notes, 2000),
      updated_at: nowIso(),
    };
    await saveClientPlan(row);
    await logAudit(req.user, "customer.plan", "user", id, {});
    res.json({ plan: mapClientPlan(row) });
  })
);

/* -------------------------------- check-ins -------------------------------- */

const checkinUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: imageFilter,
});

function mapCheckin(row: CheckinRow, user?: UserRow | null): CheckinDTO {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: user?.name,
    weight: numOrNull(row.weight),
    note: String(row.note ?? ""),
    doctorNote: String(row.doctor_note ?? ""),
    reviewed: Boolean(row.reviewed),
    hasPhoto: Boolean(row.photo),
    createdAt: String(row.created_at ?? ""),
  };
}

app.post(
  "/api/account/checkins",
  requireAuth,
  contentLengthGuard,
  checkinUpload.single("photo"),
  asyncRoute(async (req, res) => {
    const user = req.user!;
    if (await limited(`checkin:${user.id}`, 8, 60 * 60 * 1000)) {
      return void res.status(429).json({ error: "بتبعت متابعات كتير. استنى شوية وجرب تاني." });
    }
    const weight = numOrNull(req.body.weight);
    if (weight !== null && (weight < 20 || weight > 400)) {
      return void res.status(400).json({ error: "اكتب وزن منطقي بالكيلو (٢٠ – ٤٠٠)." });
    }
    const note = str(req.body.note, 1000);
    const file = req.file;
    if (weight === null && !note && !file) {
      return void res.status(400).json({ error: "اكتب وزنك أو ملاحظتك، أو ارفع صورة." });
    }
    let photo = "";
    if (file) {
      if (!looksLikeImage(file.buffer.subarray(0, 32))) {
        return void res.status(400).json({ error: "ارفع صورة صحيحة (JPG/PNG/WebP)." });
      }
      photo = randomName("jpg");
      await putFile(photo, file.buffer, file.mimetype || "image/jpeg");
    }
    const row = await createCheckin({
      user_id: user.id,
      weight,
      note,
      doctor_note: "",
      reviewed: 0,
      photo,
      created_at: nowIso(),
    });
    await logAudit(user, "checkin.create", "checkin", row.id, { weight });
    await notifyTeam(
      "checkin",
      `متابعة جديدة من ${user.name}`,
      [weight !== null ? `الوزن: ${weight} كجم` : "", note, photo ? "مرفق صورة" : ""]
        .filter(Boolean)
        .join(" — ")
    );
    res.status(201).json({ checkin: mapCheckin(row, user) });
  })
);

app.get(
  "/api/checkins/:id/photo",
  requireAuth,
  asyncRoute(async (req, res) => {
    const row = await getCheckin(int(req.params.id));
    if (!row || !row.photo) return void res.status(404).json({ error: "الصورة مش موجودة." });
    if (req.user!.role === "customer" && Number(row.user_id) !== Number(req.user!.id)) {
      return void res.status(403).json({ error: "مش مسموح." });
    }
    const file = await getFile(path.basename(row.photo));
    if (!file) return void res.status(404).json({ error: "الصورة مش موجودة." });
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(file.buffer);
  })
);

app.post(
  "/api/account/files/seen",
  requireAuth,
  asyncRoute(async (req, res) => {
    await markCustomerFilesSeen(req.user!.id);
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/customers/:id/checkins",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const customer = await findUserById(id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ checkins: (await listCheckinsByUser(id)).map((row) => mapCheckin(row, customer)) });
  })
);

app.patch(
  "/api/admin/checkins/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await getCheckin(id);
    if (!row) return void res.status(404).json({ error: "المتابعة مش موجودة." });
    const updated = await updateCheckin(id, {
      doctor_note: req.body.doctorNote !== undefined ? str(req.body.doctorNote, 1000) : row.doctor_note,
      reviewed: req.body.reviewed === undefined ? row.reviewed : req.body.reviewed ? 1 : 0,
    });
    await logAudit(req.user, "checkin.review", "checkin", id, {});
    if (req.body.doctorNote && String(req.body.doctorNote) !== String(row.doctor_note)) {
      await notifyCustomer(
        Number(row.user_id),
        "checkin_reply",
        "رد الدكتور على متابعتك",
        str(req.body.doctorNote, 1000)
      );
    }
    res.json({ checkin: mapCheckin((updated ?? row) as CheckinRow) });
  })
);

/* ------------------------------- notifications ----------------------------- */

const emailHtml = (title: string, body: string, name?: string) => `<!doctype html>
<html dir="rtl" lang="ar"><body style="margin:0;background:#f5f5f2;padding:24px;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#15170f">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #e6e6df">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#8aa11f">د. مصطفى يوسف</p>
    <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
    ${name ? `<p style="margin:0 0 8px;color:#555">أهلاً ${name}،</p>` : ""}
    <p style="margin:0;font-size:14px;line-height:1.9;color:#333">${body}</p>
    <p style="margin:20px 0 0;font-size:12px;color:#999">تقدر تتابع حسابك من الموقع في أي وقت.</p>
  </div>
</body></html>`;

/** Sends through Resend when EMAIL_FROM + RESEND_API_KEY exist; otherwise records “skipped”. */
async function sendEmailIfConfigured(to: string, subject: string, html: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from || !to) return "skipped";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function notifyCustomer(userId: number, kind: string, title: string, body: string): Promise<void> {
  try {
    const user = await findUserById(userId);
    if (!user) return;
    const status = await sendEmailIfConfigured(user.email, title, emailHtml(title, body, user.name));
    await createNotification({ user_id: userId, kind, title, body, channel: "email", status });
  } catch {
    /* notifications must never break the main action */
  }
}

async function notifyTeam(kind: string, title: string, body: string): Promise<void> {
  try {
    await createNotification({ user_id: 0, kind, title, body, channel: "in-app", status: "sent" });
  } catch {
    /* ignore */
  }
}

app.get(
  "/api/admin/notifications",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const rows = await listNotifications(120);
    const names = new Map<number, string>();
    const customers = await listCustomerRows();
    for (const customer of customers) names.set(customer.id, customer.name);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      notifications: rows.map((row: NotificationRow) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        userName: row.user_id ? names.get(Number(row.user_id)) ?? "" : "",
        kind: row.kind,
        title: row.title,
        body: row.body,
        channel: row.channel,
        status: row.status,
        read: Boolean(row.read_by_admin),
        createdAt: row.created_at,
      })),
      unread: rows.filter((row) => !row.read_by_admin).length,
      emailConfigured: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()),
    });
  })
);

app.post(
  "/api/admin/notifications/read",
  requireStaff,
  asyncRoute(async (_req, res) => {
    await markNotificationsRead();
    res.json({ ok: true });
  })
);

app.post(
  "/api/admin/notify/expiring",
  requireStaff,
  asyncRoute(async (req, res) => {
    await expireOldSubscriptions(nowIso());
    const now = nowIso();
    const horizon = addDays(new Date(), 7).toISOString();
    const subscriptions = (await allSubscriptions()).filter(
      (row) => row.status === "active" && String(row.ends_at) > now && String(row.ends_at) <= horizon
    );
    let sent = 0;
    for (const subscription of subscriptions) {
      const user = await findUserById(Number(subscription.user_id));
      if (!user) continue;
      const daysLeft = Math.max(1, Math.ceil((new Date(subscription.ends_at).getTime() - Date.now()) / 86_400_000));
      await notifyCustomer(
        user.id,
        "expiring",
        "باقتك قربت تخلص",
        `باقي ${daysLeft} يوم في باقة «${subscription.program_name}». جدّد من الموقع عشان متقطعش برنامجك.`
      );
      sent += 1;
    }
    await logAudit(req.user, "notify.expiring", "subscription", "", { sent });
    res.json({ ok: true, sent });
  })
);

/* --------------------------------- reports --------------------------------- */

app.get(
  "/api/admin/reports",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    await expireOldSubscriptions(nowIso());
    const [payments, subscriptions, programs, customers, coupons] = await Promise.all([
      allPayments(),
      allSubscriptions(),
      listContent("programs", true),
      listCustomerRows(),
      listCoupons(),
    ]);
    const paid = payments.filter((row) => ["approved", "auto_approved"].includes(String(row.status)));
    const month = nowIso().slice(0, 7);
    const previousMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const amountOf = new Map(programs.map((item) => [item.id, int(item.common.amount, 0)]));

    const byPlan = new Map<string, { total: number; count: number }>();
    const byMethod = new Map<string, { total: number; count: number }>();
    const byCustomer = new Map<number, number>();
    const monthly = new Map<string, number>();
    let revenue = 0;

    for (const payment of paid) {
      const total = Number(payment.amount ?? 0);
      revenue += total;
      const planName = String(payment.program_name ?? "باقة");
      const planEntry = byPlan.get(planName) ?? { total: 0, count: 0 };
      planEntry.total += total;
      planEntry.count += 1;
      byPlan.set(planName, planEntry);
      const method = String(payment.method ?? "");
      const methodEntry = byMethod.get(method) ?? { total: 0, count: 0 };
      methodEntry.total += total;
      methodEntry.count += 1;
      byMethod.set(method, methodEntry);
      byCustomer.set(Number(payment.user_id), (byCustomer.get(Number(payment.user_id)) ?? 0) + total);
      const key = String(payment.created_at ?? "").slice(0, 7);
      monthly.set(key, (monthly.get(key) ?? 0) + total);
    }

    const now = nowIso();
    const active = subscriptions.filter((row) => row.status === "active" && String(row.ends_at) > now);
    const expected = active.reduce((sum, row) => sum + (amountOf.get(String(row.program_id)) ?? 0), 0);
    const expiringSoon = active.filter(
      (row) => String(row.ends_at) <= addDays(new Date(), 7).toISOString()
    ).length;
    const names = new Map(customers.map((customer) => [customer.id, customer]));

    const summary = {
      revenue,
      expected,
      month: monthly.get(month) ?? 0,
      lastMonth: monthly.get(previousMonth) ?? 0,
      byPlan: [...byPlan.entries()]
        .map(([name, entry]) => ({ name, ...entry }))
        .sort((a, b) => b.total - a.total),
      byMethod: [...byMethod.entries()]
        .map(([method, entry]) => ({ method, ...entry }))
        .sort((a, b) => b.total - a.total),
      monthly: [...monthly.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([key, total]) => ({ month: key, total })),
      activeSubscriptions: active.length,
      expiringSoon,
      couponsUsed: coupons.reduce((sum, coupon) => sum + Number(coupon.used ?? 0), 0),
      topCustomers: [...byCustomer.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([userId, total]) => ({
          name: names.get(userId)?.name ?? `#${userId}`,
          email: names.get(userId)?.email ?? "",
          total,
        })),
    };
    res.setHeader("Cache-Control", "no-store");
    res.json(summary);
  })
);

app.get(
  "/api/admin/export/revenue.csv",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const payments = (await allPayments()).filter((row) =>
      ["approved", "auto_approved"].includes(String(row.status))
    );
    const customers = await listCustomerRows();
    const names = new Map(customers.map((customer) => [customer.id, customer]));
    sendCsv(res, "revenue.csv", [
      ["id", "date", "customer", "email", "plan", "amount_egp", "discount", "coupon", "method", "status"],
      ...payments.map((payment) => {
        const user = names.get(Number(payment.user_id));
        return [
          payment.id,
          payment.created_at,
          user?.name ?? "",
          user?.email ?? "",
          payment.program_name,
          payment.amount,
          payment.discount ?? 0,
          payment.coupon ?? "",
          payment.method,
          payment.status,
        ];
      }),
    ]);
    await logAudit(req.user, "export.revenue", "payments", payments.length);
  })
);

/* ----------------------------------- team ---------------------------------- */

app.get(
  "/api/admin/team",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const users = await listUsers();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      team: users
        .filter((user) => user.role !== "customer")
        .map((user) => ({
          ...toPublicUser(user),
          twoFactor: Boolean(user.totp_enabled),
        })),
    });
  })
);

app.post(
  "/api/admin/team",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const name = str(req.body.name, 80);
    const email = str(req.body.email, 160).toLowerCase();
    const password = String(req.body.password ?? "");
    if (name.length < 2) return void res.status(400).json({ error: "اكتب اسم عضو الفريق." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void res.status(400).json({ error: "الإيميل مش صحيح." });
    if (password.length < 8) return void res.status(400).json({ error: "الباسورد لازم 8 حروف على الأقل." });
    if (await findUserByEmail(email)) return void res.status(409).json({ error: "الإيميل مسجل بالفعل." });
    const { salt, hash } = hashPassword(password);
    const created = await createUser({
      role: "staff",
      name,
      email,
      phone: str(req.body.phone, 24),
      password_salt: salt,
      password_hash: hash,
    });
    await logAudit(req.user, "team.create", "user", created.id, { email });
    res.status(201).json({ ok: true, id: created.id });
  })
);

app.patch(
  "/api/admin/team/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const target = await findUserById(id);
    if (!target || target.role === "customer") {
      return void res.status(404).json({ error: "عضو الفريق مش موجود." });
    }
    if (id === req.user!.id) return void res.status(400).json({ error: "مش ممكن توقف حسابك." });
    await updateUser(id, { blocked: req.body.blocked ? 1 : 0 });
    await logAudit(req.user, "team.update", "user", id, { blocked: Boolean(req.body.blocked) });
    res.json({ ok: true });
  })
);

/* --------------------------------- exports -------------------------------- */

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function sendCsv(res: Response, filename: string, rows: (string | number | null | undefined)[][]) {
  const body = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(body);
}

app.get(
  "/api/admin/export/payments.csv",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const [payments, users] = await Promise.all([allPayments(), listCustomerRows()]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    sendCsv(res, "payments.csv", [
      ["id", "created_at", "customer", "email", "phone", "plan", "amount_egp", "method", "reference", "sender", "status", "notes"],
      ...payments.map((payment) => {
        const user = usersById.get(Number(payment.user_id));
        return [
          payment.id,
          payment.created_at,
          user?.name ?? "",
          user?.email ?? "",
          user?.phone ?? "",
          payment.program_name,
          payment.amount,
          payment.method,
          payment.reference,
          payment.sender,
          payment.status,
          payment.note,
        ];
      }),
    ]);
    await logAudit(_req.user, "export.payments", "payments", payments.length);
  })
);

app.get(
  "/api/admin/export/customers.csv",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const [users, summaries] = await Promise.all([listCustomerRows(), customerSummaries(nowIso())]);
    sendCsv(res, "customers.csv", [
      ["id", "name", "email", "phone", "joined", "active_plans", "total_paid_egp", "plan_ends"],
      ...users.map((user) => {
        const summary = summaries.get(user.id);
        return [
          user.id,
          user.name,
          user.email,
          user.phone,
          user.created_at,
          summary?.activeSubscriptions ?? 0,
          summary?.spent ?? 0,
          summary?.endsAt ?? "",
        ];
      }),
    ]);
    await logAudit(_req.user, "export.customers", "users", users.length);
  })
);

app.get(
  "/api/admin/export/subscriptions.csv",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const [subscriptions, users] = await Promise.all([allSubscriptions(), listCustomerRows()]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    sendCsv(res, "subscriptions.csv", [
      ["id", "customer", "email", "plan", "starts_at", "ends_at", "status"],
      ...subscriptions.map((subscription) => {
        const user = usersById.get(Number(subscription.user_id));
        return [
          subscription.id,
          user?.name ?? "",
          user?.email ?? "",
          subscription.program_name,
          subscription.starts_at,
          subscription.ends_at,
          subscription.status,
        ];
      }),
    ]);
    await logAudit(_req.user, "export.subscriptions", "subscriptions", subscriptions.length);
  })
);

app.use("/api", (_req, res) => res.status(404).json({ error: "المسار غير موجود." }));

/* ---------------------------------- static -------------------------------- */

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("text/plain").send("API is running. Start the Vite dev server with: npm run dev");
  });
}

app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("[api]", error);
  // A failure after the body started streaming cannot be turned into JSON.
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "الطلب مش مكتمل. جرب تاني." });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "حجم الطلب كبير. جرب تاني." });
    return;
  }
  if (error?.code === "LIMIT_FILE_SIZE") {
    const isChunk = req.path.startsWith("/api/coach/uploads");
    const limit = isChunk ? CHAT_CHUNK_BYTES : MAX_UPLOAD_BYTES;
    res.status(413).json({
      error: `حجم الصورة كبير. الحد ${Math.round(limit / 1024 / 1024)} ميجا.`,
    });
    return;
  }
  res.status(500).json({ error: "حصل خطأ في السيرفر. جرب تاني." });
});

// Vercel (and other serverless hosts) import this module and call the exported
// app themselves, so only bind a port when running as a plain Node server.
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`API + app ready on http://${HOST}:${PORT}`);
  });
  // Last line of defence: a stray rejection (a log write, a client abort race)
  // must never take the whole API down for every customer.
  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("[uncaughtException]", error);
  });
}

export default app;
