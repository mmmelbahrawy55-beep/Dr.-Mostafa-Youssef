import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { SignJWT, jwtVerify } from "jose";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  DIST_DIR,
  MAX_UPLOAD_BYTES,
  SHOT_DIR,
  UPLOAD_DIR,
  allPayments,
  allSubscriptions,
  countActiveSubscriptions,
  countExpiringSoon,
  countUnreadMessages,
  createMedia,
  createMessage,
  createPayment,
  createSubscription,
  createUser,
  customerSummaries,
  deleteContent,
  deleteFile,
  deleteMedia,
  deleteMessage,
  expireOldSubscriptions,
  findActiveSubscription,
  findPaymentByReferenceKey,
  findPaymentBySha,
  findSubscriptionByPayment,
  findUserByEmail,
  findUserById,
  getCopyOverrides,
  getContent,
  getJwtSecret,
  getMedia,
  getFile,
  getPayment,
  getSettings,
  rateCount,
  redis,
  releaseOnce,
  reserveOnce,
  listAudit,
  listContent,
  listCustomerRows,
  listMedia,
  listMessages,
  listPaymentsByUser,
  listSubscriptionsByUser,
  logAudit,
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
import type { ContentItem, PublicUser, SiteSettings } from "../shared/types";

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

type Authed = Request & { user?: UserRow };

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
    return row;
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

async function issueSession(res: Response, user: UserRow) {
  const token = await new SignJWT({ role: user.role, ver: Number(user.session_version ?? 0) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await getSecret());

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

/**
 * Reject obviously oversized bodies from the Content-Length header before
 * multer starts streaming, so the client gets a clean 413 instead of a reset
 * connection halfway through a 5 MB upload.
 */
function contentLengthGuard(req: Request, res: Response, next: NextFunction) {
  const length = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES + 64 * 1024) {
    res.status(413).json({
      error: `حجم الصورة كبير. الحد ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجا.`,
    });
    return;
  }
  next();
}

function isRealImage(filePath: string) {
  try {
    const head = readFileSync(filePath).subarray(0, 32);
    const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const png = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp = head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP";
    return jpeg || png || webp;
  } catch {
    return false;
  }
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
    return active.id;
  }

  return createSubscription({
    user_id: user.id,
    program_id: program.id,
    program_name: programName,
    payment_id: paymentId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  });
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

    await issueSession(res, user);
    res.status(201).json({ user: toPublicUser(user) });
  })
);

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

    const user = await findUserByEmail(email);
    if (!user || !checkPassword(password, user.password_salt, user.password_hash)) {
      res.status(401).json({ error: "الإيميل أو الباسورد مش صح." });
      return;
    }
    if (user.blocked) {
      res.status(403).json({ error: "الحساب موقوف. كلمنا على واتساب." });
      return;
    }

    await issueSession(res, user);
    res.json({ user: toPublicUser(user) });
  })
);

app.post("/api/auth/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

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

    res.json({ user: toPublicUser(user), subscriptions, payments });
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
    if (password) await issueSession(res, updated);
    res.json({ user: toPublicUser(updated) });
  })
);

/* -------------------------------- public site ------------------------------ */

app.get(
  "/api/site",
  asyncRoute(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
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
      programs,
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

      const program = await getContent(str(req.body.programId, 80));
      if (!program || program.collection !== "programs" || !program.active) {
        cleanup();
        res.status(404).json({ error: "الباقة غير متاحة." });
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
      const amount = int(program.common.amount, 0);
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
      if (size < 8 * 1024) reasons.push("حجم الصورة صغير جدًا — تأكد إنها سكرين شوت واضح للتحويل.");
      if (claimed !== amount) reasons.push(`المبلغ المكتوب (${claimed}) لا يطابق سعر الباقة (${amount} ج.م).`);
      if (reference.length < 4) reasons.push("رقم عملية التحويل قصير أو غير مكتمل.");
      if (method === "vodafone" && !/^01[0125]\d{8}$/.test(sender)) {
        reasons.push("رقم المحفظة المُحوّل منها غير مطابق لأرقام فودافون كاش.");
      }
      if (method === "instapay" && sender.length < 5) reasons.push("بيانات حساب إنستاباي المُحوّل منه غير مكتملة.");
      if (dims.width && dims.height && (dims.width < 280 || dims.height < 280)) {
        reasons.push("أبعاد صورة التحويل صغيرة جدًا — ارفع سكرين شوت أوضح.");
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
      }

      await logAudit(
        user,
        status === "auto_approved" ? "payment.auto_approved" : "payment.submitted",
        "payment",
        paymentId,
        { amount, method, program: program.id, risk: reasons }
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

app.get(
  "/api/admin/overview",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    await expireOldSubscriptions(nowIso());
    const now = nowIso();
    const month = now.slice(0, 7);

    const [stats, customerRows, activeSubs, expiringSoon, unread, allPaymentRows] = await Promise.all([
      paymentStats(),
      listCustomerRows(),
      countActiveSubscriptions(now),
      countExpiringSoon(now, addDays(new Date(), 7).toISOString()),
      countUnreadMessages(),
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
  requireAdmin,
  asyncRoute(async (req, res) => {
    const status = str(req.query.status, 20);
    const rows = (await allPayments()).filter((row) => !status || row.status === status).slice(0, 300);
    res.json({ payments: await Promise.all(rows.map(mapPaymentWithUser)) });
  })
);

app.post(
  "/api/admin/payments/:id/decision",
  requireAdmin,
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
    }

    await logAudit(req.user, `payment.${action}`, "payment", id, { note, subscriptionId });
    res.json({ ok: true, status, subscriptionId });
  })
);

app.get(
  "/api/admin/customers",
  requireAdmin,
  asyncRoute(async (req, res) => {
    res.json({ customers: await listCustomers(str(req.query.q, 80)) });
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
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = await findUserById(id);
    if (!row || row.role !== "customer") return void res.status(404).json({ error: "العميل غير موجود." });

    const customer =
      (await listCustomers("")).find((entry) => entry.id === id) ?? {
        ...toPublicUser(row),
        activeSubscriptions: 0,
        spent: 0,
        endsAt: null,
      };

    const subscriptions = (await listSubscriptionsByUser(id)).map((entry) => mapSubscription(entry, row));
    const payments = (await listPaymentsByUser(id)).map((payment) => mapPayment(payment, row));

    res.json({ customer, subscriptions, payments });
  })
);

app.post(
  "/api/admin/customers",
  requireAdmin,
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
  requireAdmin,
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
  requireAdmin,
  asyncRoute(async (_req, res) => {
    await expireOldSubscriptions(nowIso());
    const rows = (await allSubscriptions()).slice(0, 500);

    res.json({ subscriptions: await Promise.all(rows.map(mapSubscriptionWithUser)) });
  })
);

app.post(
  "/api/admin/subscriptions",
  requireAdmin,
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
  requireAdmin,
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
  requireAdmin,
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
  requireAdmin,
  asyncRoute(async (req, res) => {
    await setMessageRead(int(req.params.id), Boolean(req.body.read));
    res.json({ ok: true });
  })
);

app.delete(
  "/api/admin/messages/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const deletedId = int(req.params.id);
    await deleteMessage(deletedId);
    await logAudit(req.user, "message.delete", "message", deletedId);
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
    res.json({ items: await listContent(collection) });
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

app.get(
  "/api/admin/media",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const rows = await listMedia(200);
    res.json({
      media: rows.map((row) => ({
        id: Number(row.id),
        url: row.url,
        filename: row.filename,
        mime: row.mime,
        size: Number(row.size),
        createdAt: row.created_at,
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

    let mediaId: number;
    try {
      await putFile(filename, bytes, file.mimetype || "application/octet-stream");
      mediaId = await createMedia({
        url,
        filename,
        mime: file.mimetype,
        size: file.size,
        created_at: nowIso(),
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
      media: { id: mediaId, url, filename, mime: file.mimetype, size: file.size, createdAt: nowIso() },
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
    await logAudit(req.user, "media.delete", "media", id);
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

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api]", error);
  if (error?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      error: `حجم الصورة كبير. الحد ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجا.`,
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
}

export default app;
