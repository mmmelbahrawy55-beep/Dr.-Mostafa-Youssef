// Adversarial robustness suite: malformed input, concurrency, aborted uploads,
// limits and ownership. Every check also asserts the API is still alive, so a
// crash or a hung process fails the suite loudly.
//
// Run against a local server only (it creates accounts and messages):
//   npm run smoke:robust
import { existsSync, readFileSync } from "node:fs";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:4000";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE);
if (!isLocal) {
  console.error(`Refusing to run the robustness suite against ${BASE}.`);
  process.exit(2);
}

const results = [];
function assert(name, cond, extra = "") {
  results.push({ name, pass: Boolean(cond) });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

const adminPassword =
  process.env.ADMIN_PASSWORD ||
  (/^password:\s*(.+)$/m.exec(readFileSync("data/admin-password.txt", "utf8"))?.[1]?.trim() ?? "");

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
    for (const c of res.headers.getSetCookie?.() ?? []) this.cookie = c.split(";")[0];
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, text };
  }
  get(p) {
    return this.req(p);
  }
  post(p, body) {
    return this.req(p, { method: "POST", body });
  }
}

const admin = new Session();
const alice = new Session();
const bob = new Session();

const fakePng = (bytes) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(Math.max(0, bytes - 8), 65)]);
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 1)]);
const fakeMp4 = (bytes) => {
  const buf = Buffer.alloc(bytes, 7);
  buf.write("ftyp", 4, "ascii");
  return buf;
};

async function health() {
  try {
    const res = await fetch(BASE + "/api/health");
    const data = await res.json().catch(() => null);
    return res.status === 200 && data?.ok === true;
  } catch {
    return false;
  }
}

function chunkForm(buf, type, name = "part.bin") {
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), name);
  return form;
}

async function openSession(who, mime, bytes) {
  const res = await who.post("/api/coach/uploads", { mime, bytes });
  return res;
}

async function completeSession(who, mime, buf) {
  const created = await openSession(who, mime, buf.length);
  if (created.status !== 201) return { created };
  const id = created.data.uploadId;
  const chunks = created.data.chunks;
  const chunkBytes = created.data.chunkBytes;
  for (let i = 0; i < chunks; i += 1) {
    const slice = buf.subarray(i * chunkBytes, Math.min((i + 1) * chunkBytes, buf.length));
    await who.req(`/api/coach/uploads/${id}/${i}`, { method: "POST", body: chunkForm(slice, mime) });
  }
  return { created, id };
}

const stamp = Date.now();

/* --------------------------------- setup --------------------------------- */
assert("api is healthy before the run", await health());

assert(
  "admin logs in",
  (await admin.post("/api/auth/login", { email: "admin@drmostafayoussef.com", password: adminPassword })).status === 200
);
const site = await admin.get("/api/site");
const programId = site.data?.programs?.find((p) => Number(p.common?.amount) > 0)?.id;

await alice.post("/api/auth/register", {
  name: "عميل أمان أ",
  email: `safety-a.${stamp}@example.com`,
  phone: "01011112222",
  password: "TestPass@123",
});
await bob.post("/api/auth/register", {
  name: "عميل أمان ب",
  email: `safety-b.${stamp}@example.com`,
  phone: "01033334444",
  password: "TestPass@123",
});
const aliceUser = (await alice.get("/api/auth/me")).data?.user;
const bobUser = (await bob.get("/api/auth/me")).data?.user;
const granted = await admin.post("/api/admin/subscriptions", { userId: aliceUser?.id, programId, days: 5 });
assert("alice gets a plan to use chat", granted.status === 201, `${granted.status}`);
assert(
  "bob is a second customer without a plan",
  bobUser?.id > 0 && bobUser?.id !== aliceUser?.id,
  `alice ${aliceUser?.id} / bob ${bobUser?.id}`
);
// Give bob a plan too, so the ownership checks below exercise the upload rules
// themselves rather than the "no plan" gate.
const bobGrant = await admin.post("/api/admin/subscriptions", { userId: bobUser?.id, programId, days: 5 });
assert("bob also gets a plan", bobGrant.status === 201, `${bobGrant.status}`);

/* --------------------------- malformed sessions -------------------------- */
const badMime = await openSession(alice, "text/html", 1024);
assert("session with a non-media mime refused", badMime.status === 400, `${badMime.status}`);

const zeroBytes = await openSession(alice, "image/png", 0);
assert("session with zero bytes refused", zeroBytes.status === 400, `${zeroBytes.status}`);

const negative = await openSession(alice, "image/png", -5);
assert("session with negative bytes refused", negative.status === 400, `${negative.status}`);

const absurd = await openSession(alice, "image/png", 1e15);
assert("absurd declared size refused", absurd.status === 413, `${absurd.status}`);

const textBytes = await openSession(alice, "image/png", "abc");
assert("non-numeric size refused", textBytes.status === 400, `${textBytes.status}`);

const traversal = await alice.post("/api/coach/uploads/..%2F..%2Fetc/0", {});
assert("path traversal in session id rejected", traversal.status >= 400 && traversal.status < 500, `${traversal.status}`);

const shortId = await alice.req("/api/coach/uploads/abc/0", { method: "POST", body: chunkForm(fakePng(64), "image/png") });
assert("short session id rejected", shortId.status === 400, `${shortId.status}`);

const ghost = await alice.post("/api/coach/messages", { body: "شبح", mediaUploadId: "Z".repeat(20) });
assert("attach to unknown session answers 410", ghost.status === 410, `${ghost.status}`);

const shortGhost = await alice.post("/api/coach/messages", { body: "شبح", mediaUploadId: ".." });
assert("attach with malformed id answers 400", shortGhost.status === 400, `${shortGhost.status}`);

const empty = await alice.post("/api/coach/messages", { body: "   ", videoUrl: "" });
assert("empty message refused", empty.status === 400, `${empty.status}`);

const malformedJson = await alice.req("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{bad json",
});
assert("malformed JSON body answers 400 (not 500)", malformedJson.status === 400, `${malformedJson.status}`);

const oversizedJson = await alice.req("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "a@b.co", password: "x".repeat(4 * 1024 * 1024) }),
});
assert("oversized JSON body answers 413 (not 500)", oversizedJson.status === 413, `${oversizedJson.status}`);

/* ------------------------------ bad chunks ------------------------------- */
const sess = await openSession(alice, "image/png", 1024);
const sessId = sess.data?.uploadId;

const wrongType = await alice.req(`/api/coach/uploads/${sessId}/0`, {
  method: "POST",
  body: chunkForm(Buffer.from("plain text"), "text/plain"),
});
assert("non-image chunk refused", wrongType.status === 400, `${wrongType.status}`);

const tooLargeChunk = await alice.req(`/api/coach/uploads/${sessId}/0`, {
  method: "POST",
  body: chunkForm(Buffer.alloc(3 * 1024 * 1024 + 512 * 1024, 9), "image/png"),
});
assert("chunk above 3 MB refused", tooLargeChunk.status === 413, `${tooLargeChunk.status}`);

const outOfRange = await alice.req(`/api/coach/uploads/${sessId}/7`, {
  method: "POST",
  body: chunkForm(fakePng(64), "image/png"),
});
assert("chunk index past the session refused", outOfRange.status === 400, `${outOfRange.status}`);

const wrongKindBuf = await openSession(alice, "image/png", 4096);
const wrongKind = await alice.req(`/api/coach/uploads/${wrongKindBuf.data?.uploadId}/0`, {
  method: "POST",
  body: chunkForm(fakeMp4(2048), "video/mp4"),
});
assert("video chunk in an image session refused", wrongKind.status === 400, `${wrongKind.status}`);

// Declared video/mp4 but the bytes are a JPEG: upload passes, attach must refuse.
const liar = await completeSession(alice, "video/mp4", jpegBytes);
const liarAttach = await alice.post("/api/coach/messages", { body: "مزيف", mediaUploadId: liar.id });
assert("magic-byte mismatch refused at attach", liarAttach.status === 400, `${liarAttach.status}`);

/* --------------------------- incomplete uploads -------------------------- */
const incomplete = await openSession(alice, "image/png", 4 * 1024 * 1024);
const incompleteId = incomplete.data?.uploadId;
await alice.req(`/api/coach/uploads/${incompleteId}/0`, {
  method: "POST",
  body: chunkForm(fakePng(incomplete.data.chunks > 1 ? 1024 : 2048), "image/png"),
});
const incompleteAttach = await alice.post("/api/coach/messages", { body: "ناقص", mediaUploadId: incompleteId });
assert("incomplete session cannot attach", incompleteAttach.status === 400, `${incompleteAttach.status}`);

/* ------------------------------- ownership ------------------------------- */
const aliceUpload = await completeSession(alice, "image/png", fakePng(2048));
assert("alice uploads an image", Boolean(aliceUpload.id), `${aliceUpload.created?.status}`);
const aliceMessage = await alice.post("/api/coach/messages", { body: "ملكية أ", mediaUploadId: aliceUpload.id });
assert("alice attaches her image", aliceMessage.status === 201, `${aliceMessage.status}`);
const aliceMediaUrl = aliceMessage.data?.message?.mediaUrl;

const bobAttach = await bob.post("/api/coach/messages", { body: "محاولة", mediaUploadId: aliceUpload.id });
assert("bob cannot re-attach alice's (used) session", bobAttach.status === 410 || bobAttach.status === 409, `${bobAttach.status}`);

// The reverse direction: alice cannot attach a finished session that belongs to
// bob, even though it is complete and valid.
const bobComplete = await completeSession(bob, "image/png", fakePng(1500));
const aliceStealsBob = await alice.post("/api/coach/messages", { body: "محاولة", mediaUploadId: bobComplete.id });
assert("alice cannot attach bob's finished session", aliceStealsBob.status === 403, `${aliceStealsBob.status}`);

const bobWrite = await bob.req(`/api/coach/uploads/${incompleteId}/0`, {
  method: "POST",
  body: chunkForm(fakePng(64), "image/png"),
});
assert("bob cannot write into alice's session", bobWrite.status === 403, `${bobWrite.status}`);

const bobRead = await bob.get(aliceMediaUrl);
assert("bob cannot read alice's media", bobRead.status === 403, `${bobRead.status}`);

const adminRead = await admin.get(aliceMediaUrl);
assert("admin can read any chat media", adminRead.status === 200, `${adminRead.status}`);

const anonRead = await fetch(BASE + aliceMediaUrl);
assert("anonymous cannot read chat media", anonRead.status === 401, `${anonRead.status}`);

const numericGone = await alice.get("/api/coach/media/99999999");
assert("missing media answers 404", numericGone.status === 404, `${numericGone.status}`);

/* --------------------------------- ranges -------------------------------- */
const rangeRead = (range) =>
  fetch(BASE + aliceMediaUrl, { headers: { cookie: alice.cookie, range } }).then(async (res) => ({
    status: res.status,
    body: Buffer.from(await res.arrayBuffer()),
    contentRange: res.headers.get("content-range") ?? "",
  }));

const garbageRange = await rangeRead("bytes=abc");
assert("garbage range falls back to 200", garbageRange.status === 200 && garbageRange.body.length === 2048, `${garbageRange.status} ${garbageRange.body.length}`);

const pastEnd = await rangeRead("bytes=999999-");
assert("range past the end answers 416", pastEnd.status === 416 && pastEnd.contentRange === "bytes */2048", `${pastEnd.status} ${pastEnd.contentRange}`);

const suffix = await rangeRead("bytes=-100");
assert("suffix range returns the last bytes", suffix.status === 206 && suffix.body.length === 100 && suffix.body.equals(fakePng(2048).subarray(1948)), `${suffix.status} ${suffix.body.length}`);

/* ------------------------------- concurrency ----------------------------- */
// Let the per-account message window (20/min) reset so the race is about
// attach atomicity, not about tripping the rate limiter.
console.log("waiting 61s for the message rate-limit window to reset…");
await new Promise((resolve) => setTimeout(resolve, 61_000));
const raceBuf = fakePng(3000);
const race = await completeSession(alice, "image/png", raceBuf);
const raceResults = await Promise.all(
  Array.from({ length: 5 }, (_, i) => alice.post("/api/coach/messages", { body: `سباق ${stamp}`, mediaUploadId: race.id }))
);
const created = raceResults.filter((r) => r.status === 201).length;
const rejected = raceResults.filter((r) => r.status === 409 || r.status === 410).length;
assert("five parallel attaches create exactly one message", created === 1 && rejected === 4, `${raceResults.map((r) => r.status).join(",")}`);
const raceList = await alice.get("/api/coach/messages");
const raceCopies = (raceList.data?.messages ?? []).filter((m) => m.body === `سباق ${stamp}`).length;
assert("the race left no duplicate messages", raceCopies === 1, `${raceCopies} copies`);

const sameChunk = fakePng(4000);
const same = await openSession(alice, "image/png", sameChunk.length);
const sameWrites = await Promise.all(
  Array.from({ length: 3 }, () =>
    alice.req(`/api/coach/uploads/${same.data?.uploadId}/0`, { method: "POST", body: chunkForm(sameChunk, "image/png") })
  )
);
assert("three parallel writes of one chunk all succeed", sameWrites.every((r) => r.status === 200), sameWrites.map((r) => r.status).join(","));
const afterParallel = await alice.post("/api/coach/messages", { body: "بعد الكتابة المتوازية", mediaUploadId: same.data?.uploadId });
assert("file survives parallel writes and attaches", afterParallel.status === 201, `${afterParallel.status}`);

const burst = await Promise.all(Array.from({ length: 6 }, (_, i) => alice.post("/api/coach/messages", { body: `دفعة ${stamp} ${i}` })));
assert("six parallel text messages all accepted", burst.every((r) => r.status === 201), burst.map((r) => r.status).join(","));

const parallelReads = await Promise.all(
  Array.from({ length: 3 }, () =>
    fetch(BASE + aliceMediaUrl, { headers: { cookie: alice.cookie } }).then(async (res) => ({
      status: res.status,
      size: (await res.arrayBuffer()).byteLength,
    }))
  )
);
assert("three parallel media reads return the full file", parallelReads.every((r) => r.status === 200 && r.size === 2048), JSON.stringify(parallelReads));

const pageBurst = await Promise.all(Array.from({ length: 12 }, () => fetch(BASE + "/api/site").then((r) => r.status)));
assert("public API handles a burst of reads", pageBurst.every((s) => s === 200), pageBurst.join(","));

/* --------------------------- aborted client upload ----------------------- */
let aborted = false;
try {
  const controller = new AbortController();
  const big = fakeMp4(3 * 1024 * 1024);
  const id = (await openSession(alice, "video/mp4", big.length)).data?.uploadId;
  const form = chunkForm(big, "video/mp4");
  const pending = fetch(`${BASE}/api/coach/uploads/${id}/0`, { method: "POST", body: form, signal: controller.signal });
  controller.abort();
  await pending;
} catch {
  aborted = true;
}
assert("aborted upload is dropped cleanly", aborted);
assert("api is healthy after the abort", await health());

/* ------------------------------ rate limiting ---------------------------- */
let sawLimit = false;
let attempts = 0;
// The limiter is a fixed one-minute window, so a burst that straddles the
// boundary can split its count. Probe long enough to cover a whole window.
for (; attempts < 80 && !sawLimit; attempts += 1) {
  const res = await openSession(alice, "image/png", 128);
  if (res.status === 429) sawLimit = true;
  else if (res.status >= 500) {
    console.log("unexpected 5xx while probing the limiter:", res.status, res.text.slice(0, 200));
    break;
  }
}
assert("upload session limiter kicks in", sawLimit, `${attempts} attempts`);

/* -------------------------------- survival ------------------------------- */
assert("api is healthy after every abuse case", await health());
const siteAfter = await fetch(BASE + "/api/site");
assert("site still renders data after the storm", siteAfter.status === 200);
const loginAfter = await admin.post("/api/auth/login", { email: "admin@drmostafayoussef.com", password: adminPassword });
assert("admin can still log in afterwards", loginAfter.status === 200, `${loginAfter.status}`);

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} robustness checks passed`);
if (failures.length) process.exit(1);
void existsSync;
