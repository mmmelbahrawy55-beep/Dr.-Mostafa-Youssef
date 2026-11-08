import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { SignJWT, jwtVerify } from "jose";
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  DATA_DIR,
  DIST_DIR,
  SHOT_DIR,
  UPLOAD_DIR,
  db,
  getContent,
  getCopyOverrides,
  getSettings,
  listContent,
  logAudit,
  saveCopyOverrides,
  saveSettings,
  upsertContent,
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

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_COOKIE = "my_session";

/* ------------------------------ session secret ----------------------------- */

const secretFile = path.join(DATA_DIR, "jwt-secret");
const secretValue =
  process.env.JWT_SECRET?.trim() ||
  (() => {
    if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString("hex"), { mode: 0o600 });
    return readFileSync(secretFile, "utf8").trim();
  })();
const secret = new TextEncoder().encode(secretValue);

type UserRow = {
  id: number;
  role: "customer" | "admin";
  name: string;
  email: string;
  phone: string;
  password_salt: string;
  password_hash: string;
  blocked: number;
  created_at: string;
};

type Authed = Request & { user?: UserRow };

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: true }));

/* --------------------------------- helpers -------------------------------- */

const asyncRoute =
  (handler: (req: Authed, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as Authed, res, next)).catch(next);
  };

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
    const { payload } = await jwtVerify(token, secret);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(payload.sub)) as UserRow | undefined;
    if (!row || row.blocked) return null;
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
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
}

const clearSession = (res: Response) =>
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

/* ------------------------------ rate limiting ----------------------------- */

const buckets = new Map<string, { count: number; reset: number }>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

// Keep the in-memory rate-limit buckets from growing forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.reset < now) buckets.delete(key);
  }
}, 10 * 60_000).unref();

/* --------------------------------- uploads -------------------------------- */

const imageFilter: multer.Options["fileFilter"] = (_req, file, done) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
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
  limits: { fileSize: 10 * 1024 * 1024 },
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
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: imageFilter,
});

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

function activateSubscription(user: UserRow, program: ContentItem, paymentId: number | null, daysOverride?: number) {
  const days = Math.max(1, daysOverride ?? int(program.common.days, 30));
  const programName = String(program.ar?.name ?? program.id);
  const active = db
    .prepare(
      `SELECT * FROM subscriptions WHERE user_id = ? AND program_id = ? AND status = 'active'
       AND ends_at > ? ORDER BY ends_at DESC LIMIT 1`
    )
    .get(user.id, program.id, nowIso()) as { id: number; ends_at: string } | undefined;

  const start = active ? new Date(active.ends_at) : new Date();
  const end = addDays(start, days);

  if (active) {
    db.prepare("UPDATE subscriptions SET ends_at = ? WHERE id = ?").run(end.toISOString(), active.id);
    return active.id;
  }

  const result = db
    .prepare(
      `INSERT INTO subscriptions (user_id, program_id, program_name, payment_id, starts_at, ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(user.id, program.id, programName, paymentId, start.toISOString(), end.toISOString(), nowIso());

  return Number(result.lastInsertRowid);
}

function expireOldSubscriptions() {
  db.prepare("UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND ends_at <= ?").run(nowIso());
}

/* ---------------------------------- auth ---------------------------------- */

app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const ip = req.ip ?? "unknown";
    if (limited(`register:${ip}`, 6, 60_000)) {
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

    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (exists) return void res.status(409).json({ error: "الإيميل ده مسجل قبل كده. سجل دخول." });

    const { salt, hash } = hashPassword(password);
    const result = db
      .prepare(
        `INSERT INTO users (role, name, email, phone, password_salt, password_hash, created_at)
         VALUES ('customer', ?, ?, ?, ?, ?, ?)`
      )
      .run(name, email, phone, salt, hash, nowIso());

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid)) as UserRow;
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

    if (limited(`login:${ip}:${email}`, 8, 60_000)) {
      res.status(429).json({ error: "محاولات دخول كتير. استنى دقيقة." });
      return;
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
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
    expireOldSubscriptions();
    const user = req.user!;
    const subscriptions = db
      .prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC")
      .all(user.id)
      .map(mapSubscription);
    const payments = db
      .prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC")
      .all(user.id)
      .map(mapPayment);

    res.json({ user: toPublicUser(user), subscriptions, payments });
  })
);

app.patch(
  "/api/account",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const name = str(req.body.name, 80) || user.name;
    const phone = str(req.body.phone, 24);
    const password = String(req.body.password ?? "");

    if (password && password.length < 8) {
      res.status(400).json({ error: "الباسورد الجديد لازم 8 حروف على الأقل." });
      return;
    }

    if (password) {
      const { salt, hash } = hashPassword(password);
      db.prepare("UPDATE users SET name = ?, phone = ?, password_salt = ?, password_hash = ? WHERE id = ?").run(
        name,
        phone,
        salt,
        hash,
        user.id
      );
    } else {
      db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id);
    }

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as UserRow;
    res.json({ user: toPublicUser(updated) });
  })
);

/* -------------------------------- public site ------------------------------ */

app.get("/api/site", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    settings: getSettings(),
    programs: listContent("programs", true),
    services: listContent("services", true),
    testimonials: listContent("testimonials", true),
    results: listContent("results", true),
    posts: listContent("posts", true),
    faqs: listContent("faqs", true),
    credentials: listContent("credentials", true),
    copy: getCopyOverrides(),
  });
});

app.post(
  "/api/messages",
  asyncRoute(async (req, res) => {
    const ip = req.ip ?? "unknown";
    if (limited(`msg:${ip}`, 8, 60_000)) {
      res.status(429).json({ error: "بعتنالنا رسايل كتير. استنى شوية." });
      return;
    }
    const name = str(req.body.name, 80);
    const phone = str(req.body.phone, 24);
    if (name.length < 2) return void res.status(400).json({ error: "اكتب اسمك صح." });
    if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) return void res.status(400).json({ error: "رقم الموبايل مش صحيح." });

    db.prepare("INSERT INTO messages (name, phone, email, goal, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      name,
      phone,
      str(req.body.email, 160),
      str(req.body.goal, 120),
      str(req.body.message, 3000),
      nowIso()
    );

    res.status(201).json({ ok: true });
  })
);

/* --------------------------------- payments -------------------------------- */

app.post(
  "/api/payments",
  requireAuth,
  shotUpload.single("screenshot"),
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const file = req.file;
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

      const program = getContent(str(req.body.programId, 80));
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
      const settings = getSettings();
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

      const duplicateShot = db.prepare("SELECT id FROM payments WHERE screenshot_sha = ?").get(hash);
      const duplicateRef = db
        .prepare("SELECT id FROM payments WHERE reference_key = ?")
        .get(sha256(`${method}:${reference.toLowerCase().replace(/\s+/g, "")}`));

      if (duplicateShot) {
        cleanup();
        res.status(409).json({ error: "الصورة دي اتقدّمت قبل كده. مينفعش نستخدم نفس الإيصال مرتين." });
        return;
      }
      if (duplicateRef) {
        cleanup();
        res.status(409).json({ error: "رقم العملية ده مستخدم قبل كده. تأكد من رقم العملية." });
        return;
      }

      const status = reasons.length === 0 && settings.payments.autoApprove !== false ? "auto_approved" : "pending";
      const result = db
        .prepare(
          `INSERT INTO payments (user_id, program_id, program_name, amount, days, method, sender, reference,
             screenshot, screenshot_sha, reference_key, status, risk, created_at, reviewed_at,
             screenshot_width, screenshot_height)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          user.id,
          program.id,
          String(program.ar?.name ?? program.id),
          amount,
          int(program.common.days, 30),
          method,
          sender,
          reference,
          path.basename(file.path),
          hash,
          sha256(`${method}:${reference.toLowerCase().replace(/\s+/g, "")}`),
          status,
          JSON.stringify(reasons),
          nowIso(),
          status === "auto_approved" ? nowIso() : null,
          dims.width,
          dims.height
        );

      const paymentId = Number(result.lastInsertRowid);
      let subscriptionId: number | null = null;

      if (status === "auto_approved") {
        subscriptionId = activateSubscription(user, program, paymentId);
      }

      logAudit(
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
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(int(req.params.id)) as
      | { user_id: number; screenshot: string }
      | undefined;

    if (!payment) return void res.status(404).json({ error: "الدفعة غير موجودة." });
    if (user.role !== "admin" && payment.user_id !== user.id) {
      return void res.status(403).json({ error: "مش مسموح." });
    }

    const filePath = path.join(SHOT_DIR, path.basename(payment.screenshot));
    if (!existsSync(filePath)) return void res.status(404).json({ error: "الصورة مش موجودة." });
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(filePath);
  })
);

/* ---------------------------------- admin --------------------------------- */

app.get(
  "/api/admin/overview",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    expireOldSubscriptions();
    const revenue =
      (db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('approved','auto_approved')").get() as any)
        .total ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const todayRevenue =
      (db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('approved','auto_approved') AND substr(created_at,1,10) = ?"
        )
        .get(today) as any).total ?? 0;
    const monthRevenue =
      (db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('approved','auto_approved') AND substr(created_at,1,7) = ?"
        )
        .get(month) as any).total ?? 0;
    const pending = db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS s FROM payments WHERE status = 'pending'").get() as any;
    const customers = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'customer'").get() as any).c;
    const newCustomers = (
      db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'customer' AND substr(created_at,1,7) = ?").get(month) as any
    ).c;
    const activeSubs = (db.prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'active' AND ends_at > ?").get(nowIso()) as any).c;
    const expiringSoon = (
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'active' AND ends_at > ? AND ends_at <= ?"
        )
        .get(nowIso(), addDays(new Date(), 7).toISOString()) as any
    ).c;
    const unread = (db.prepare("SELECT COUNT(*) AS c FROM messages WHERE read = 0").get() as any).c;
    const approved = (db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status = 'approved'").get() as any).c;
    const auto = (db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status = 'auto_approved'").get() as any).c;
    const rejected = (db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status = 'rejected'").get() as any).c;

    const monthly: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);
      const key = date.toISOString().slice(0, 7);
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(amount),0) AS total FROM payments
           WHERE status IN ('approved','auto_approved') AND substr(created_at,1,7) = ?`
        )
        .get(key) as any;
      monthly.push({ month: key, total: Number(row?.total ?? 0) });
    }

    const recentPayments = db
      .prepare(
        `SELECT p.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone FROM payments p
         JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 6`
      )
      .all()
      .map(mapPayment);

    res.json({
      revenue: Number(revenue),
      todayRevenue: Number(todayRevenue),
      monthRevenue: Number(monthRevenue),
      pendingCount: Number(pending.c),
      pendingAmount: Number(pending.s),
      customers: Number(customers),
      newCustomers: Number(newCustomers),
      activeSubscriptions: Number(activeSubs),
      expiringSoon: Number(expiringSoon),
      unreadMessages: Number(unread),
      monthly,
      recentPayments,
      totals: { approved: Number(approved), auto: Number(auto), rejected: Number(rejected) },
    });
  })
);

function mapPayment(row: any) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: row.user_name,
    userEmail: row.user_email,
    userPhone: row.user_phone,
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

app.get(
  "/api/admin/payments",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const status = str(req.query.status, 20);
    const query = `SELECT p.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone FROM payments p
      JOIN users u ON u.id = p.user_id ${status ? "WHERE p.status = ?" : ""}
      ORDER BY p.created_at DESC LIMIT 300`;
    const rows = (status ? db.prepare(query).all(status) : db.prepare(query).all()) as any[];
    res.json({ payments: rows.map(mapPayment) });
  })
);

app.post(
  "/api/admin/payments/:id/decision",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const action = str(req.body.action, 20);
    const note = str(req.body.note, 500);
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as any;
    if (!payment) return void res.status(404).json({ error: "الدفعة غير موجودة." });
    if (!["approve", "reject"].includes(action)) return void res.status(400).json({ error: "إجراء غير معروف." });

    const status = action === "approve" ? "approved" : "rejected";
    db.prepare("UPDATE payments SET status = ?, note = ?, reviewed_at = ? WHERE id = ?").run(status, note, nowIso(), id);

    let subscriptionId: number | null = null;
    if (action === "approve") {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payment.user_id) as UserRow;
      const program = getContent(payment.program_id);
      if (user && program) {
        const existing = db.prepare("SELECT id FROM subscriptions WHERE payment_id = ?").get(id);
        if (!existing) subscriptionId = activateSubscription(user, program, id);
      }
    }

    logAudit(req.user, `payment.${action}`, "payment", id, { note, subscriptionId });
    res.json({ ok: true, status, subscriptionId });
  })
);

app.get(
  "/api/admin/customers",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const search = `%${str(req.query.q, 80).toLowerCase()}%`;
    res.json({ customers: listCustomers(search) });
  })
);

function listCustomers(search: string) {
  const rows = db
    .prepare(
      `SELECT u.*,
         (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active' AND s.ends_at > ?) AS active_subs,
         (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.user_id = u.id AND p.status IN ('approved','auto_approved')) AS spent,
         (SELECT MAX(ends_at) FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active' AND s.ends_at > ?) AS ends_at
       FROM users u WHERE u.role = 'customer'
       AND (lower(u.name) LIKE ? OR lower(u.email) LIKE ? OR u.phone LIKE ?)
       ORDER BY u.created_at DESC LIMIT 500`
    )
    .all(nowIso(), nowIso(), search, search, search) as any[];

  return rows.map((row) => ({
    ...toPublicUser(row),
    activeSubscriptions: Number(row.active_subs ?? 0),
    spent: Number(row.spent ?? 0),
    endsAt: row.ends_at ?? null,
  }));
}

app.get(
  "/api/admin/customers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").get(id) as UserRow | undefined;
    if (!row) return void res.status(404).json({ error: "العميل غير موجود." });

    const customer = listCustomers("%").find((entry) => entry.id === id) ?? {
      ...toPublicUser(row),
      activeSubscriptions: 0,
      spent: 0,
      endsAt: null,
    };

    const subscriptions = db
      .prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC")
      .all(id)
      .map(mapSubscription);
    const payments = db
      .prepare(
        `SELECT p.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone FROM payments p
         JOIN users u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.created_at DESC`
      )
      .all(id)
      .map(mapPayment);

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
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      return void res.status(409).json({ error: "الإيميل مسجل بالفعل." });
    }
    const { salt, hash } = hashPassword(password);
    const result = db
      .prepare(
        `INSERT INTO users (role, name, email, phone, password_salt, password_hash, created_at)
         VALUES ('customer', ?, ?, ?, ?, ?, ?)`
      )
      .run(name, email, phone, salt, hash, nowIso());
    logAudit(req.user, "customer.create", "user", Number(result.lastInsertRowid), { email });
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  })
);

app.patch(
  "/api/admin/customers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    if (!target) return void res.status(404).json({ error: "العميل غير موجود." });
    if (target.role === "admin") return void res.status(400).json({ error: "مش ممكن تعديل حساب الدكتور من هنا." });

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (req.body.blocked !== undefined) {
      updates.push("blocked = ?");
      values.push(req.body.blocked ? 1 : 0);
    }
    if (req.body.name !== undefined) {
      const name = str(req.body.name, 80);
      if (name.length < 2) return void res.status(400).json({ error: "الاسم قصير." });
      updates.push("name = ?");
      values.push(name);
    }
    if (req.body.phone !== undefined) {
      updates.push("phone = ?");
      values.push(str(req.body.phone, 24));
    }
    if (req.body.email !== undefined) {
      const email = str(req.body.email, 160).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void res.status(400).json({ error: "الإيميل مش صحيح." });
      const conflict = db.prepare("SELECT id FROM users WHERE email = ? AND id <> ?").get(email, id);
      if (conflict) return void res.status(409).json({ error: "الإيميل مستخدم لحساب تاني." });
      updates.push("email = ?");
      values.push(email);
    }
    if (req.body.password) {
      const password = String(req.body.password);
      if (password.length < 8) return void res.status(400).json({ error: "الباسورد لازم 8 حروف على الأقل." });
      const { salt, hash } = hashPassword(password);
      updates.push("password_salt = ?", "password_hash = ?");
      values.push(salt, hash);
    }

    if (updates.length > 0) {
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
    }
    logAudit(req.user, "customer.update", "user", id, { fields: updates.map((entry) => entry.split(" ")[0]) });
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
    res.json({ ok: true, user: toPublicUser(updated) });
  })
);

function mapSubscription(row: any) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: row.user_name,
    userEmail: row.user_email,
    programId: row.program_id,
    programName: row.program_name,
    paymentId: row.payment_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

app.get(
  "/api/admin/subscriptions",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    expireOldSubscriptions();
    const rows = db
      .prepare(
        `SELECT s.*, u.name AS user_name, u.email AS user_email FROM subscriptions s
         JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 500`
      )
      .all() as any[];

    res.json({ subscriptions: rows.map(mapSubscription) });
  })
);

app.post(
  "/api/admin/subscriptions",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const userId = int(req.body.userId);
    const programId = str(req.body.programId, 80);
    const days = int(req.body.days, 0);
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").get(userId) as UserRow | undefined;
    if (!user) return void res.status(404).json({ error: "العميل غير موجود." });
    const program = getContent(programId);
    if (!program || program.collection !== "programs") {
      return void res.status(404).json({ error: "الباقة غير موجودة." });
    }
    const subscriptionId = activateSubscription(user, program, null, days > 0 ? days : undefined);
    logAudit(req.user, "subscription.grant", "subscription", subscriptionId, { userId, programId, days });
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
    db.prepare("UPDATE subscriptions SET status = ? WHERE id = ?").run(status, id);
    logAudit(req.user, "subscription.status", "subscription", id, { status });
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/messages",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const rows = db.prepare("SELECT * FROM messages ORDER BY created_at DESC LIMIT 500").all() as any[];
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
    db.prepare("UPDATE messages SET read = ? WHERE id = ?").run(req.body.read ? 1 : 0, int(req.params.id));
    res.json({ ok: true });
  })
);

app.delete(
  "/api/admin/messages/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    db.prepare("DELETE FROM messages WHERE id = ?").run(int(req.params.id));
    logAudit(req.user, "message.delete", "message", int(req.params.id));
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
    res.json({ items: listContent(collection) });
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
    upsertContent(item);
    logAudit(req.user, "content.create", collection, item.id);
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
    const existing = getContent(id);
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

    upsertContent(item);
    logAudit(req.user, "content.update", collection, id);
    res.json({ item });
  })
);

app.delete(
  "/api/admin/content/:collection/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    db.prepare("DELETE FROM content_items WHERE id = ? AND collection = ?").run(str(req.params.id, 80), str(req.params.collection, 30));
    logAudit(req.user, "content.delete", str(req.params.collection, 30), str(req.params.id, 80));
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/settings",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.json({ settings: getSettings() });
  })
);

app.put(
  "/api/admin/settings",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const incoming = (req.body ?? {}) as SiteSettings;
    const current = getSettings();
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

    saveSettings(next);
    logAudit(req.user, "settings.update", "settings", "site");
    res.json({ settings: next });
  })
);

app.get(
  "/api/admin/copy",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.json({ copy: getCopyOverrides() });
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
    saveCopyOverrides(next);
    logAudit(req.user, "copy.update", "settings", "copy");
    res.json({ copy: next });
  })
);

app.get(
  "/api/admin/audit",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const rows = db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200").all() as any[];
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
    const rows = db.prepare("SELECT * FROM media ORDER BY created_at DESC LIMIT 200").all() as any[];
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
    const url = `/uploads/${path.basename(file.path)}`;
    const result = db
      .prepare("INSERT INTO media (url, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(url, path.basename(file.path), file.mimetype, file.size, nowIso());
    logAudit(req.user, "media.upload", "media", Number(result.lastInsertRowid), { url });
    res.status(201).json({
      media: { id: Number(result.lastInsertRowid), url, filename: path.basename(file.path), mime: file.mimetype, size: file.size, createdAt: nowIso() },
    });
  })
);

app.delete(
  "/api/admin/media/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = int(req.params.id);
    const row = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as { filename: string } | undefined;
    if (!row) return void res.status(404).json({ error: "الصورة غير موجودة." });
    db.prepare("DELETE FROM media WHERE id = ?").run(id);
    try {
      unlinkSync(path.join(UPLOAD_DIR, path.basename(row.filename)));
    } catch {
      /* file already gone */
    }
    logAudit(req.user, "media.delete", "media", id);
    res.json({ ok: true });
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
    res.status(413).json({ error: "حجم الصورة كبير. الحد 10 ميجا." });
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
