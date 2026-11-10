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
// Receipt auto-approval is off by default (manual review); enable it for this
// dedicated test database so both the automatic and manual paths stay covered.
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
assert(
  "site has programs with prices",
  Array.isArray(site.data?.programs) && site.data.programs.length > 0 && Number(site.data.programs[0].common?.amount) > 0,
  `${site.data?.programs?.length ?? 0} programs`
);
programId = site.data?.programs?.[0]?.id;
amount = Number(site.data?.programs?.[0]?.common?.amount ?? 0);
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
if (uploadedMedia) {
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
