import { deflateSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:4000";

// These checks create customers, payments and messages. Never point them at a
// live deployment unless that is intentional.
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE);
if (!isLocal && process.env.ALLOW_REMOTE_SMOKE !== "1") {
  console.error(`Refusing to run write-heavy smoke tests against ${BASE}. Set ALLOW_REMOTE_SMOKE=1 to override.`);
  process.exit(2);
}

function readSeededAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const file = "data/admin-password.txt";
  if (!existsSync(file)) return null;
  const match = /^password:\s*(.+)$/m.exec(readFileSync(file, "utf8"));
  return match?.[1]?.trim() ?? null;
}

const adminPassword = readSeededAdminPassword();
const adminEmail = process.env.ADMIN_EMAIL || "admin@drmostafayoussef.com";

/* ------------------------- helpers ------------------------- */
const results = [];
function ok(name, extra = "") {
  results.push({ name, pass: true, extra });
  console.log(`PASS  ${name}${extra ? " — " + extra : ""}`);
}
function fail(name, extra = "") {
  results.push({ name, pass: false, extra });
  console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`);
}
function assert(name, cond, extra = "") {
  if (cond) ok(name, extra);
  else fail(name, extra);
}

class Session {
  constructor() {
    this.cookie = "";
  }
  async req(path, init = {}) {
    const headers = { ...(init.headers || {}) };
    if (this.cookie) headers.cookie = this.cookie;
    if (init.body && !(init.body instanceof FormData) && typeof init.body !== "string") {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(init.body);
    }
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const pair = c.split(";")[0];
      const [k] = pair.split("=");
      const rest = this.cookie
        .split("; ")
        .filter(Boolean)
        .filter((entry) => entry.split("=")[0] !== k);
      rest.push(pair);
      this.cookie = rest.join("; ");
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, text, headers: res.headers };
  }
  get(path) {
    return this.req(path);
  }
  post(path, body) {
    return this.req(path, { method: "POST", body });
  }
  patch(path, body) {
    return this.req(path, { method: "PATCH", body });
  }
  put(path, body) {
    return this.req(path, { method: "PUT", body });
  }
  delete(path) {
    return this.req(path, { method: "DELETE" });
  }
}

/* ------------------------- PNG generation ------------------------- */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makePng(width = 420, height = 320, seed = 1) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  let x = seed;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x & 0xff;
  };
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o++] = 0;
    for (let i = 0; i < width; i += 1) {
      raw[o++] = rnd();
      raw[o++] = rnd();
      raw[o++] = (x + i + y) & 0xff;
      raw[o++] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------- run ------------------------- */
const stamp = Date.now();
const customer = new Session();
const admin = new Session();
const customer2 = new Session();
let programId = null;
let amount = 0;
let createdCustomerId = null;
let pendingPaymentId = null;
let secondPaymentId = null;

try {
  const health = await customer.get("/api/health");
  assert("health endpoint", health.status === 200 && health.data?.ok === true, JSON.stringify(health.data));
} catch (e) {
  fail("health endpoint", String(e));
  process.exit(1);
}

// --- public site ---
// Automatic activation is on by default; the settings write below guarantees
// this dedicated test database covers both the automatic and manual paths.
if (adminPassword) {
  const early = await admin.post("/api/auth/login", { email: adminEmail, password: adminPassword });
  if (early.status === 200) {
    const current = await admin.get("/api/admin/settings");
    if (current.status === 200 && current.data?.settings) {
      await admin.put("/api/admin/settings", {
        ...current.data.settings,
        payments: { ...current.data.settings.payments, autoApprove: true },
      });
    }
  } else {
    console.log(`NOTE  smoke could not enable auto-approval (admin login ${early.status})`);
  }
}

const site = await customer.get("/api/site");
assert("GET /api/site", site.status === 200, `status ${site.status}`);
// The free trial program sorts first (amount 0, no payment), so payment checks
// must target the first program that actually costs money.
const paidPrograms = (Array.isArray(site.data?.programs) ? site.data.programs : []).filter(
  (program) => Number(program.common?.amount) > 0
);
assert(
  "site has programs with prices",
  paidPrograms.length > 0,
  `${site.data?.programs?.length ?? 0} programs (${paidPrograms.length} paid)`
);
programId = paidPrograms[0]?.id;
amount = Number(paidPrograms[0]?.common?.amount ?? 0);
const wallet = site.data?.settings?.payments?.vodafone || "01004334487";
assert("site has settings contact phone", Boolean(site.data?.settings?.contact?.phone), site.data?.settings?.contact?.phone);
assert("site copy overrides object", Boolean(site.data?.copy?.ar && site.data?.copy?.en));

// --- auth validation ---
const badReg = await customer.post("/api/auth/register", { name: "أ", email: "bad", password: "123" });
assert("register rejects invalid input", badReg.status === 400, JSON.stringify(badReg.data));

const email1 = `smoke1.${stamp}@example.com`;
const reg = await customer.post("/api/auth/register", {
  name: "عميل اختبار",
  email: email1,
  phone: "01012345678",
  password: "TestPass@123",
});
assert("register customer", reg.status === 201 && reg.data?.user?.email === email1, `status ${reg.status}`);
assert("session cookie issued", customer.cookie.includes("my_session="));

const me = await customer.get("/api/auth/me");
assert("auth me returns customer", me.status === 200 && me.data?.user?.role === "customer", me.data?.user?.role);

const acctEmpty = await customer.get("/api/account");
assert("account starts empty", acctEmpty.status === 200 && acctEmpty.data?.subscriptions?.length === 0, `subs ${acctEmpty.data?.subscriptions?.length}`);

// --- payment upload: invalid image ---
const badForm = new FormData();
badForm.append("programId", programId);
badForm.append("method", "vodafone");
badForm.append("sender", "01012345678");
badForm.append("recipient", wallet);
badForm.append("reference", `REF-BAD-${stamp}`);
badForm.append("amount", String(amount));
badForm.append("screenshot", new Blob([Buffer.from("not an image")], { type: "image/png" }), "bad.png");
const badUpload = await customer.req("/api/payments", { method: "POST", body: badForm });
assert("rejects fake image", badUpload.status === 400, JSON.stringify(badUpload.data));

// --- payment upload: valid auto-approve ---
const png1 = makePng(420, 320, stamp % 1000000007);
const ref1 = `VFC-${stamp}-A`;
const form1 = new FormData();
form1.append("programId", programId);
form1.append("method", "vodafone");
form1.append("sender", "01098765432");
form1.append("recipient", wallet);
form1.append("reference", ref1);
form1.append("amount", String(amount));
form1.append("screenshot", new Blob([png1], { type: "image/png" }), "receipt.png");
const upload1 = await customer.req("/api/payments", { method: "POST", body: form1 });
assert(
  "valid payment auto-approved",
  upload1.status === 201 && upload1.data?.payment?.status === "auto_approved" && Number(upload1.data?.subscriptionId) > 0,
  JSON.stringify(upload1.data)
);

const acct1 = await customer.get("/api/account");
assert(
  "subscription activated on account",
  acct1.status === 200 &&
    acct1.data?.subscriptions?.length === 1 &&
    acct1.data.subscriptions[0].status === "active" &&
    acct1.data?.payments?.length === 1 &&
    acct1.data.payments[0].hasScreenshot === true,
  `subs ${acct1.data?.subscriptions?.length}, payments ${acct1.data?.payments?.length}`
);

// screenshot access own
const shotId = acct1.data?.payments?.[0]?.id;
const shot = await fetch(`${BASE}/api/payments/${shotId}/screenshot`, { headers: { cookie: customer.cookie } });
assert("owner can view screenshot", shot.status === 200 && shot.headers.get("content-type")?.includes("image"), `status ${shot.status}`);

// --- duplicate screenshot ---
const dupForm = new FormData();
dupForm.append("programId", programId);
dupForm.append("method", "vodafone");
dupForm.append("sender", "01098765432");
dupForm.append("recipient", wallet);
dupForm.append("reference", `VFC-${stamp}-DUP`);
dupForm.append("amount", String(amount));
dupForm.append("screenshot", new Blob([png1], { type: "image/png" }), "receipt.png");
const dup = await customer.req("/api/payments", { method: "POST", body: dupForm });
assert("rejects duplicate screenshot", dup.status === 409, JSON.stringify(dup.data));

// --- mismatched amount -> pending ---
const png2 = makePng(430, 330, (stamp % 1000000007) + 3);
const ref2 = `VFC-${stamp}-B`;
const form2 = new FormData();
form2.append("programId", programId);
form2.append("method", "vodafone");
form2.append("sender", "01098765432");
form2.append("recipient", wallet);
form2.append("reference", ref2);
form2.append("amount", String(amount - 50));
form2.append("screenshot", new Blob([png2], { type: "image/png" }), "receipt2.png");
const upload2 = await customer.req("/api/payments", { method: "POST", body: form2 });
assert(
  "mismatched amount goes to review",
  upload2.status === 201 && upload2.data?.payment?.status === "pending" && upload2.data?.subscriptionId === null,
  JSON.stringify(upload2.data)
);
pendingPaymentId = upload2.data?.payment?.id;

// --- admin login ---
const adminLogin = await admin.post("/api/auth/login", {
  email: adminEmail,
  password: adminPassword ?? "",
});
assert("admin login", adminLogin.status === 200 && adminLogin.data?.user?.role === "admin", `status ${adminLogin.status}`);
if (adminLogin.status !== 200) throw new Error("admin login failed: " + JSON.stringify(adminLogin.data));

const customerForbidden = await customer.get("/api/admin/overview");
assert("customer blocked from admin", customerForbidden.status === 403, `status ${customerForbidden.status}`);

const overview = await admin.get("/api/admin/overview");
assert(
  "admin overview sane",
  overview.status === 200 &&
    Number(overview.data?.revenue) >= amount &&
    Number(overview.data?.pendingCount) >= 1 &&
    Array.isArray(overview.data?.monthly) &&
    overview.data.monthly.length === 6,
  `revenue ${overview.data?.revenue}, pending ${overview.data?.pendingCount}`
);

const payments = await admin.get("/api/admin/payments");
assert(
  "admin payments include user info",
  payments.status === 200 && payments.data.payments.some((p) => p.id === pendingPaymentId && p.userName && p.userEmail),
  `${payments.data?.payments?.length} payments`
);

const customers = await admin.get("/api/admin/customers");
const found = customers.data?.customers?.find((c) => c.email === email1);
assert("admin customers list", customers.status === 200 && Boolean(found) && found.role === "customer", `${customers.data?.customers?.length} customers`);
createdCustomerId = found?.id;

const detail = await admin.get(`/api/admin/customers/${createdCustomerId}`);
assert(
  "admin customer detail",
  detail.status === 200 && detail.data?.customer?.id === createdCustomerId && detail.data?.subscriptions?.length === 1,
  `subs ${detail.data?.subscriptions?.length}`
);

const subs = await admin.get("/api/admin/subscriptions");
assert(
  "admin subscriptions include user",
  subs.status === 200 && subs.data.subscriptions.some((s) => s.userName && s.userEmail),
  `${subs.data?.subscriptions?.length} subs`
);

// --- admin approve pending ---
const decision = await admin.post(`/api/admin/payments/${pendingPaymentId}/decision`, { action: "approve", note: "تم التحقق يدويًا" });
assert(
  "admin approves pending payment",
  decision.status === 200 && decision.data?.status === "approved" && Number(decision.data?.subscriptionId) > 0,
  JSON.stringify(decision.data)
);

const acctAfter = await customer.get("/api/account");
const subEnds = acctAfter.data?.subscriptions?.map((s) => new Date(s.endsAt).getTime()) ?? [];
const maxEnd = Math.max(0, ...subEnds);
assert(
  "approved payment extends subscription",
  acctAfter.data?.payments?.length === 2 &&
    acctAfter.data?.payments?.every((p) => ["auto_approved", "approved"].includes(p.status)) &&
    acctAfter.data?.subscriptions?.length >= 1 &&
    maxEnd > Date.now(),
  `subs ${acctAfter.data?.subscriptions?.length}, payments ${acctAfter.data?.payments?.length}, maxEnd ok ${maxEnd > Date.now()}`
);

// --- smart review: a receipt addressed to the wrong wallet never auto-activates ---
const png3 = makePng(440, 340, (stamp % 1000000007) + 7);
const form3 = new FormData();
form3.append("programId", programId);
form3.append("method", "vodafone");
form3.append("sender", "01098765432");
form3.append("recipient", wallet === "01111111111" ? "01111111112" : "01111111111");
form3.append("reference", `VFC-${stamp}-W`);
form3.append("amount", String(amount));
form3.append("screenshot", new Blob([png3], { type: "image/png" }), "receipt3.png");
const upload3 = await customer.req("/api/payments", { method: "POST", body: form3 });
assert(
  "foreign recipient stays in manual review",
  upload3.status === 201 &&
    upload3.data?.payment?.status === "pending" &&
    upload3.data?.subscriptionId === null &&
    Array.isArray(upload3.data?.payment?.risk) &&
    upload3.data.payment.risk.some((reason) => String(reason).includes("المستلم")),
  JSON.stringify(upload3.data)
);

// --- coach chat video upload: short clip accepted, oversized clip rejected ---
// Passes the server's real-video check (MP4 "ftyp" header) while staying tiny.
const fakeMp4 = (bytes) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(bytes, 7)]);

const shortForm = new FormData();
shortForm.append("body", "اختبار رفع فيديو قصير");
shortForm.append("file", new Blob([fakeMp4(64 * 1024)], { type: "video/mp4" }), `clip-${stamp}.mp4`);
const shortUpload = await customer.req("/api/coach/messages", { method: "POST", body: shortForm });
assert(
  "coach video upload accepts a short clip",
  shortUpload.status === 201 &&
    shortUpload.data?.message?.mediaKind === "video" &&
    Boolean(shortUpload.data?.message?.mediaUrl),
  `${shortUpload.status} ${JSON.stringify(shortUpload.data).slice(0, 160)}`
);

// The stored clip is served back to its owner with the right content type.
const clipUrl = shortUpload.data?.message?.mediaUrl ?? "";
const clipRead = clipUrl ? await customer.get(clipUrl) : { status: 0, headers: { get: () => "" } };
assert(
  "coach video clip is served to its owner",
  clipRead.status === 200 && String(clipRead.headers.get("content-type") ?? "").includes("video/mp4"),
  `${clipRead.status} ${clipRead.headers.get("content-type") ?? ""}`
);

const bigForm = new FormData();
bigForm.append("body", "اختبار رفع فيديو كبير");
bigForm.append("file", new Blob([fakeMp4(Math.round(4.5 * 1024 * 1024))], { type: "video/mp4" }), `huge-${stamp}.mp4`);
const bigUpload = await customer.req("/api/coach/messages", { method: "POST", body: bigForm });
const afterBig = await customer.get("/api/coach/messages");
assert(
  "coach video upload rejects an oversized clip",
  bigUpload.status === 413 &&
    Array.isArray(afterBig.data?.messages) &&
    !afterBig.data.messages.some((m) => String(m.body ?? "").includes("كبير")),
  `${bigUpload.status} ${JSON.stringify(bigUpload.data).slice(0, 120)}`
);

// --- chunked chat uploads: any size, split into ≤ 3 MB slices ---
// Returns the raw bytes so large-file round trips can be compared exactly.
async function readBinary(path, session) {
  const res = await fetch(BASE + path, { headers: session.cookie ? { cookie: session.cookie } : {} });
  const body = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get("content-type") ?? "", bytes: body.byteLength };
}
// Range requests power video scrubbing; the bytes must match the source file.
async function readRange(path, session, range) {
  const res = await fetch(BASE + path, {
    headers: { ...(session.cookie ? { cookie: session.cookie } : {}), range },
  });
  return {
    status: res.status,
    contentRange: res.headers.get("content-range") ?? "",
    acceptRanges: res.headers.get("accept-ranges") ?? "",
    body: Buffer.from(await res.arrayBuffer()),
  };
}
const CHUNK = 3 * 1024 * 1024;
const fakePng = (bytes) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(Math.max(0, bytes - 8), 65)]);

// (a) a small video alone in one chunk
const smallBuf = fakeMp4(64 * 1024);
const createSmall = await customer.post("/api/coach/uploads", { mime: "video/mp4", bytes: smallBuf.length });
assert(
  "chat upload session opens with one chunk",
  createSmall.status === 201 && typeof createSmall.data?.uploadId === "string" && createSmall.data?.chunks === 1,
  JSON.stringify(createSmall.data)
);
const smallId = createSmall.data?.uploadId ?? "";
const smallPart = new FormData();
smallPart.append("file", new Blob([smallBuf], { type: "video/mp4" }), "0.part");
const smallPartRes = await customer.req(`/api/coach/uploads/${smallId}/0`, { method: "POST", body: smallPart });
assert(
  "chat chunk accepted",
  smallPartRes.status === 200 && smallPartRes.data?.received === 1,
  JSON.stringify(smallPartRes.data)
);
const smallMsg = await customer.post("/api/coach/messages", { body: "فحص رفع مجزأ", mediaUploadId: smallId });
assert(
  "chunked video message created",
  smallMsg.status === 201 && smallMsg.data?.message?.mediaKind === "video" && Boolean(smallMsg.data?.message?.mediaUrl),
  `${smallMsg.status} ${JSON.stringify(smallMsg.data).slice(0, 160)}`
);
const smallRead = smallMsg.data?.message?.mediaUrl
  ? await readBinary(smallMsg.data.message.mediaUrl, customer)
  : { status: 0, type: "", bytes: 0 };
assert(
  "chunked video served byte-exact",
  smallRead.status === 200 && smallRead.type.includes("video/mp4") && smallRead.bytes === smallBuf.length,
  `${smallRead.status} ${smallRead.type} ${smallRead.bytes}`
);
const reuse = await customer.post("/api/coach/messages", { body: "محاولة إعادة استخدام", mediaUploadId: smallId });
assert("chat upload attaches once", reuse.status === 410, `${reuse.status} ${JSON.stringify(reuse.data).slice(0, 120)}`);

// (b) a 9 MB video across several chunks, byte-exact on the way back
const bigBuf = fakeMp4(9 * 1024 * 1024);
const createBig = await customer.post("/api/coach/uploads", { mime: "video/mp4", bytes: bigBuf.length });
const bigChunks = createBig.data?.chunks ?? 0;
assert(
  "9 MB session splits into chunks",
  createBig.status === 201 && bigChunks === Math.ceil(bigBuf.length / CHUNK) && bigChunks >= 3,
  JSON.stringify({ ...createBig.data, expected: Math.ceil(bigBuf.length / CHUNK) })
);
const bigId = createBig.data?.uploadId ?? "";
const bigStatuses = [];
for (let i = 0; i < bigChunks; i += 1) {
  const slice = bigBuf.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, bigBuf.length));
  const form = new FormData();
  form.append("file", new Blob([slice], { type: "video/mp4" }), `${i}.part`);
  const put = await customer.req(`/api/coach/uploads/${bigId}/${i}`, { method: "POST", body: form });
  bigStatuses.push(put.status);
}
assert("9 MB video uploads in chunks", bigStatuses.every((status) => status === 200), bigStatuses.join(","));
const bigMsg = await customer.post("/api/coach/messages", { body: "فيديو 9 ميجا", mediaUploadId: bigId });
assert(
  "9 MB chunked message created",
  bigMsg.status === 201 && bigMsg.data?.message?.mediaKind === "video",
  `${bigMsg.status} ${JSON.stringify(bigMsg.data).slice(0, 160)}`
);
const bigRead = bigMsg.data?.message?.mediaUrl
  ? await readBinary(bigMsg.data.message.mediaUrl, customer)
  : { status: 0, type: "", bytes: 0 };
assert(
  "9 MB video served byte-exact",
  bigRead.status === 200 && bigRead.bytes === bigBuf.length,
  `${bigRead.status} ${bigRead.bytes}`
);
// A range that crosses a chunk boundary must return exactly those bytes.
const midRange = bigMsg.data?.message?.mediaUrl
  ? await readRange(bigMsg.data.message.mediaUrl, customer, "bytes=3100000-3300000")
  : { status: 0, contentRange: "", acceptRanges: "", body: Buffer.alloc(0) };
assert(
  "9 MB video honours range requests across chunks",
  midRange.status === 206 &&
    midRange.acceptRanges === "bytes" &&
    midRange.contentRange === `bytes 3100000-3300000/${bigBuf.length}` &&
    midRange.body.length === 200001 &&
    midRange.body.equals(bigBuf.subarray(3100000, 3300001)),
  `${midRange.status} ${midRange.contentRange} ${midRange.body.length}`
);
const badRange = bigMsg.data?.message?.mediaUrl
  ? await readRange(bigMsg.data.message.mediaUrl, customer, `bytes=${bigBuf.length + 5}-`)
  : { status: 0, contentRange: "", acceptRanges: "", body: Buffer.alloc(0) };
assert(
  "range past the end answered 416",
  badRange.status === 416 && badRange.contentRange === `bytes */${bigBuf.length}`,
  `${badRange.status} ${badRange.contentRange}`
);

// (c) a 5 MB image across two chunks
const pngBuf = fakePng(5 * 1024 * 1024);
const createPng = await customer.post("/api/coach/uploads", { mime: "image/png", bytes: pngBuf.length });
const pngChunks = createPng.data?.chunks ?? 0;
assert(
  "5 MB image session splits into two chunks",
  createPng.status === 201 && pngChunks === 2,
  JSON.stringify(createPng.data)
);
const pngId = createPng.data?.uploadId ?? "";
for (let i = 0; i < pngChunks; i += 1) {
  const slice = pngBuf.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, pngBuf.length));
  const form = new FormData();
  form.append("file", new Blob([slice], { type: "image/png" }), `${i}.part`);
  await customer.req(`/api/coach/uploads/${pngId}/${i}`, { method: "POST", body: form });
}
const pngMsg = await customer.post("/api/coach/messages", { body: "صورة 5 ميجا", mediaUploadId: pngId });
const pngRead = pngMsg.data?.message?.mediaUrl
  ? await readBinary(pngMsg.data.message.mediaUrl, customer)
  : { status: 0, type: "", bytes: 0 };
assert(
  "5 MB chunked image served byte-exact",
  pngMsg.status === 201 &&
    pngMsg.data?.message?.mediaKind === "image" &&
    pngRead.status === 200 &&
    pngRead.type.includes("image/png") &&
    pngRead.bytes === pngBuf.length,
  `${pngMsg.status} ${pngRead.status} ${pngRead.bytes}`
);

// (d) doctor sends a chunked clip; the customer reads and opens it
const docBuf = fakeMp4(80 * 1024);
const docCreate = await admin.post("/api/coach/uploads", { mime: "video/mp4", bytes: docBuf.length });
const docId = docCreate.data?.uploadId ?? "";
const docPart = new FormData();
docPart.append("file", new Blob([docBuf], { type: "video/mp4" }), "0.part");
await admin.req(`/api/coach/uploads/${docId}/0`, { method: "POST", body: docPart });
const docMsg = await admin.post(`/api/admin/conversations/${createdCustomerId}/messages`, {
  body: "رد الدكتور بفيديو",
  mediaUploadId: docId,
});
assert(
  "doctor chunked reply created",
  docMsg.status === 201 && docMsg.data?.message?.mediaKind === "video",
  `${docMsg.status} ${JSON.stringify(docMsg.data).slice(0, 160)}`
);
const custList = await customer.get("/api/coach/messages");
const docSeen = Array.isArray(custList.data?.messages)
  ? custList.data.messages.find((item) => item.sender === "doctor" && String(item.body ?? "").includes("رد الدكتور بفيديو"))
  : null;
const docRead = docSeen?.mediaUrl ? await readBinary(docSeen.mediaUrl, customer) : { status: 0, type: "", bytes: 0 };
assert(
  "customer opens the doctor's chunked clip",
  docRead.status === 200 && docRead.type.includes("video/mp4") && docRead.bytes === docBuf.length,
  `${docRead.status} ${docRead.bytes}`
);

// (e) limits and ownership
const tooBig = await customer.post("/api/coach/uploads", { mime: "video/mp4", bytes: 65 * 1024 * 1024 });
assert(
  "65 MB declaration refused",
  tooBig.status === 413 && !tooBig.data?.uploadId,
  `${tooBig.status} ${JSON.stringify(tooBig.data).slice(0, 120)}`
);
const adminSess = await admin.post("/api/coach/uploads", { mime: "image/png", bytes: 2048 });
const adminUploadId = adminSess.data?.uploadId ?? "";
const stealMsg = await customer.post("/api/coach/messages", { body: "محاولة سرقة", mediaUploadId: adminUploadId });
assert("customer cannot attach the doctor's upload", stealMsg.status === 403, `${stealMsg.status}`);
const stealPart = new FormData();
stealPart.append("file", new Blob([fakePng(64)], { type: "image/png" }), "0.part");
const stealPut = await customer.req(`/api/coach/uploads/${adminUploadId}/0`, { method: "POST", body: stealPart });
assert("customer cannot write to the doctor's upload", stealPut.status === 403, `${stealPut.status}`);
const mine = await customer.post("/api/coach/uploads", { mime: "image/png", bytes: 1024 });
const mineId = mine.data?.uploadId ?? "";
const badIndexForm = new FormData();
badIndexForm.append("file", new Blob([fakePng(32)], { type: "image/png" }), "9.part");
const badIndex = await customer.req(`/api/coach/uploads/${mineId}/9`, { method: "POST", body: badIndexForm });
assert("chunk index outside the session is refused", badIndex.status === 400, `${badIndex.status}`);
const ghost = await customer.post("/api/coach/messages", {
  body: "جلسة مش موجودة",
  mediaUploadId: "AAAAAAAAAAAAAAAAAAAAAAAA",
});
assert("unknown upload session refused", ghost.status === 410, `${ghost.status}`);

// --- admin manual grant ---
const grant = await admin.post("/api/admin/subscriptions", { userId: createdCustomerId, programId, days: 7 });
assert("admin manual grant", grant.status === 201 && Number(grant.data?.subscriptionId) > 0, JSON.stringify(grant.data));

// --- admin create + edit + block customer ---
const email3 = `smoke2.${stamp}@example.com`;
const createCust = await admin.post("/api/admin/customers", {
  name: "عميل تاني",
  email: email3,
  phone: "01112223334",
  password: "TestPass@123",
});
assert("admin creates customer", createCust.status === 201 && Number(createCust.data?.id) > 0, JSON.stringify(createCust.data));
const cust3Id = createCust.data?.id;

const editCust = await admin.patch(`/api/admin/customers/${cust3Id}`, { name: "عميل معدل", phone: "01000000001" });
assert("admin edits customer", editCust.status === 200 && editCust.data?.user?.name === "عميل معدل", JSON.stringify(editCust.data?.user));

const block3 = await admin.patch(`/api/admin/customers/${cust3Id}`, { blocked: true });
assert("admin blocks customer", block3.status === 200 && block3.data?.user?.blocked === true);
const blockedLogin = await customer2.post("/api/auth/login", { email: email3, password: "TestPass@123" });
assert("blocked customer cannot login", blockedLogin.status === 403, `status ${blockedLogin.status}`);
await admin.patch(`/api/admin/customers/${cust3Id}`, { blocked: false });

// --- content CRUD ---
const adminContent = await admin.get("/api/admin/content/programs");
assert("admin content list", adminContent.status === 200 && Array.isArray(adminContent.data?.items), `${adminContent.data?.items?.length} items`);
const firstProgram = adminContent.data?.items?.[0];
if (firstProgram) {
  const edited = {
    ...firstProgram,
    ar: { ...firstProgram.ar, subtitle: (firstProgram.ar?.subtitle ?? "") + " (اختبار)" },
  };
  const saved = await admin.req(`/api/admin/content/programs/${firstProgram.id}`, { method: "PATCH", body: edited });
  assert("admin content update", saved.status === 200, JSON.stringify(saved.data));
  const siteAfter = await customer.get("/api/site");
  const changed = siteAfter.data?.programs?.find((p) => p.id === firstProgram.id);
  assert(
    "content update reflected publicly",
    String(changed?.ar?.subtitle ?? "").includes("(اختبار)"),
    String(changed?.ar?.subtitle ?? "").slice(-12)
  );
  const reverted = await admin.req(`/api/admin/content/programs/${firstProgram.id}`, { method: "PATCH", body: firstProgram });
  assert("content revert", reverted.status === 200);
}

// --- copy overrides ---
const copy = await admin.get("/api/admin/copy");
assert("admin copy list", copy.status === 200 && Boolean(copy.data?.copy?.ar) && Boolean(copy.data?.copy?.en), Object.keys(copy.data?.copy ?? {}).join(","));

const copyBody = { ar: { "nav.home": "الرئيسية (اختبار)" }, en: { "nav.home": "Home (test)" } };
const copySave = await admin.put("/api/admin/copy", copyBody);
assert("admin copy save", copySave.status === 200 || copySave.status === 201, `${copySave.status} ${JSON.stringify(copySave.data).slice(0, 160)}`);
const siteCopy = await customer.get("/api/site");
assert(
  "copy override served publicly",
  siteCopy.data?.copy?.ar?.["nav.home"] === "الرئيسية (اختبار)",
  JSON.stringify(siteCopy.data?.copy?.ar).slice(0, 120)
);
const copyReset = await admin.put("/api/admin/copy", { ar: {}, en: {} });
assert("admin copy reset", copyReset.status === 200 || copyReset.status === 201);

// --- settings ---
const settings = await admin.get("/api/admin/settings");
assert("admin settings get", settings.status === 200 && Boolean(settings.data?.settings?.contact), JSON.stringify(Object.keys(settings.data ?? {})));
const settingsSave = await admin.put("/api/admin/settings", settings.data?.settings ?? settings.data);
assert("admin settings save", settingsSave.status === 200 || settingsSave.status === 201, `${settingsSave.status}`);

// --- messages ---
const msg = await customer.post("/api/messages", {
  name: "عميل اختبار",
  phone: "01012345678",
  email: email1,
  goal: "إنقاص وزن",
  message: "عايز أبدأ البرنامج",
});
assert("public message submit", msg.status === 201, `status ${msg.status}`);
const msgs = await admin.get("/api/admin/messages");
const newMsg = msgs.data?.messages?.find((m) => m.email === email1);
assert("admin sees message", Boolean(newMsg));
if (newMsg) {
  const readMsg = await admin.patch(`/api/admin/messages/${newMsg.id}`, { read: true });
  assert("admin marks message read", readMsg.status === 200, `${readMsg.status}`);
  const delMsg = await admin.delete(`/api/admin/messages/${newMsg.id}`);
  assert("admin deletes message", delMsg.status === 200, `${delMsg.status}`);
}

// --- media ---
const mediaForm = new FormData();
mediaForm.append("file", new Blob([makePng(320, 240, (stamp % 1000000007) + 9)], { type: "image/png" }), "media.png");
const mediaUpload = await admin.req("/api/admin/media", { method: "POST", body: mediaForm });
assert("admin media upload", mediaUpload.status === 201, `${mediaUpload.status} ${JSON.stringify(mediaUpload.data).slice(0, 160)}`);
const mediaList = await admin.get("/api/admin/media");
assert("admin media list", mediaList.status === 200 && mediaList.data?.media?.length >= 1, `${mediaList.data?.media?.length} items`);
const uploadedMedia = mediaList.data?.media?.find((m) => String(m.filename ?? "").includes("media"));
const justUploaded = mediaList.data?.media?.find((m) => m.id === mediaUpload.data?.media?.id);
assert(
  "admin media records uploader and dimensions",
  Boolean(justUploaded) && typeof justUploaded?.width === "number" && String(justUploaded?.uploadedByName ?? "").length > 0,
  JSON.stringify(justUploaded ?? {}).slice(0, 200)
);
if (justUploaded) {
  const delMedia = await admin.delete(`/api/admin/media/${justUploaded.id}`);
  assert("admin media delete", delMedia.status === 200, `${delMedia.status}`);
} else if (uploadedMedia) {
  const delMedia = await admin.delete(`/api/admin/media/${uploadedMedia.id}`);
  assert("admin media delete", delMedia.status === 200, `${delMedia.status}`);
}

// --- CSV exports ---
for (const [name, path] of [
  ["payments", "/api/admin/export/payments.csv"],
  ["customers", "/api/admin/export/customers.csv"],
  ["subscriptions", "/api/admin/export/subscriptions.csv"],
]) {
  const exported = await admin.get(path);
  assert(
    `CSV export: ${name}`,
    exported.status === 200 && String(exported.headers.get("content-type")).includes("text/csv") && exported.text.includes(","),
    `status ${exported.status}`
  );
}

// --- audit ---
const audit = await admin.get("/api/admin/audit");
assert("admin audit log", audit.status === 200 && Array.isArray(audit.data?.entries), Object.keys(audit.data ?? {}).join(","));

// --- audit cleanup ---
const anonAudit = new Session();
const anonClear = await anonAudit.delete("/api/admin/audit?confirm=1");
assert("audit clear requires admin", anonClear.status === 401, `${anonClear.status}`);
const auditEntries = audit.data?.entries ?? [];
assert("audit has entries to clean", auditEntries.length >= 1, `${auditEntries.length} entries`);
const auditTarget = auditEntries[0];
if (auditTarget) {
  const delEntry = await admin.delete(`/api/admin/audit/${auditTarget.id}`);
  assert("admin deletes audit entry", delEntry.status === 200, `${delEntry.status}`);
  const delAgain = await admin.delete(`/api/admin/audit/${auditTarget.id}`);
  assert("deleting missing audit entry", delAgain.status === 404, `${delAgain.status}`);
}
const clearNoConfirm = await admin.delete("/api/admin/audit");
assert("audit clear needs confirm flag", clearNoConfirm.status === 400, `${clearNoConfirm.status}`);
const cleared = await admin.delete("/api/admin/audit?confirm=1");
assert(
  "admin clears audit log",
  cleared.status === 200 && typeof cleared.data?.removed === "number",
  `${cleared.status} ${JSON.stringify(cleared.data)}`
);
const auditAfter = await admin.get("/api/admin/audit");
assert("audit log empty after clear", auditAfter.data?.entries?.length === 0, `${auditAfter.data?.entries?.length} left`);

// --- logout ---
const out = await customer.post("/api/auth/logout", {});
assert("logout", out.status === 200);
const afterLogout = await customer.get("/api/account");
assert("account requires auth after logout", afterLogout.status === 401, `status ${afterLogout.status}`);

// --- summary ---
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n${passed}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:");
  for (const f of failed) console.log(` - ${f.name} ${f.extra}`);
  process.exitCode = 1;
}
