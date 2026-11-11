/**
 * End-to-end security check against a running API.
 *
 * Uses the local admin credentials and a real TOTP code, so it verifies the
 * whole flow (password -> challenge -> code -> session -> revoke -> disable)
 * instead of only the happy path. Refuses to run against production unless
 * ALLOW_REMOTE_SMOKE=1 is set explicitly.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = (process.env.SMOKE_BASE || "http://127.0.0.1:4000").replace(/\/$/, "");
const parsed = new URL(BASE);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) && process.env.ALLOW_REMOTE_SMOKE !== "1") {
  console.error("Refusing to run security checks outside localhost. Set ALLOW_REMOTE_SMOKE=1 to override.");
  process.exit(1);
}

const source = readFileSync("data/admin-password.txt", "utf8");
const email = /email:\s*(\S+)/.exec(source)?.[1];
const password = /password:\s*(\S+)/.exec(source)?.[1];
if (!email || !password) {
  console.error("Could not read local admin credentials from data/admin-password.txt");
  process.exit(1);
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of input.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function codeFor(secret, offset = 0) {
  const counter = Math.floor(Date.now() / 30_000) + offset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const index = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[index] & 0x7f) << 24) |
    ((digest[index + 1] & 0xff) << 16) |
    ((digest[index + 2] & 0xff) << 8) |
    (digest[index + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

let cookie = "";
async function call(path, init = {}, overrideCookie) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(init.body);
  }
  const active = overrideCookie === undefined ? cookie : overrideCookie;
  if (active) headers.set("cookie", active);
  const response = await fetch(BASE + path, { ...init, headers });
  for (const entry of response.headers.getSetCookie?.() ?? []) {
    const pair = entry.split(";")[0];
    if (pair.startsWith("my_session=")) cookie = pair === "my_session=" ? "" : pair;
  }
  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: response.status, data };
}

let passed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    throw new Error(label);
  }
}

async function main() {
  let enabled = false;
  let secret = "";

  try {
    const login = await call("/api/auth/login", { method: "POST", body: { email, password } });
    check("admin password login", login.status === 200 && login.data?.user?.role === "admin", `status ${login.status}`);
    const firstCookie = cookie;

    const sessions = await call("/api/account/sessions");
    check(
      "sessions are listed with the current device",
      sessions.status === 200 && sessions.data.sessions.some((entry) => entry.current),
      `status ${sessions.status}`
    );

    const setup = await call("/api/admin/2fa/setup", { method: "POST" });
    check("2FA setup returns a secret", setup.status === 200 && setup.data.secret?.length >= 16, `status ${setup.status}`);
    secret = setup.data.secret;

    const enable = await call("/api/admin/2fa/enable", {
      method: "POST",
      body: { code: codeFor(secret) },
    });
    check(
      "2FA enables with a valid TOTP code",
      enable.status === 200 && enable.data.backupCodes?.length === 10,
      `status ${enable.status}`
    );
    enabled = true;

    const logout = await call("/api/auth/logout", { method: "POST" });
    check("logout succeeds", logout.status === 200, `status ${logout.status}`);

    const relogin = await call("/api/auth/login", { method: "POST", body: { email, password } });
    check(
      "password alone no longer creates a session",
      relogin.status === 200 && relogin.data.twoFactorRequired === true && relogin.data.challenge,
      `status ${relogin.status}`
    );

    const wrong = await call("/api/auth/2fa", {
      method: "POST",
      body: { challenge: relogin.data.challenge, code: "000000" },
    });
    check("a wrong TOTP code is rejected", wrong.status === 401, `status ${wrong.status}`);

    const second = await call("/api/auth/2fa", {
      method: "POST",
      body: { challenge: relogin.data.challenge, code: codeFor(secret) },
    });
    check("a valid TOTP code opens a session", second.status === 200 && second.data.user?.role === "admin", `status ${second.status}`);

    const stale = await call("/api/account", {}, firstCookie);
    check("the old session was revoked", stale.status === 401, `status ${stale.status}`);

    const freshSessions = await call("/api/account/sessions");
    check(
      "the new session is the only current one",
      freshSessions.status === 200 && freshSessions.data.sessions.filter((entry) => entry.current).length === 1,
      `status ${freshSessions.status}`
    );

    const backup = await call("/api/admin/backup");
    check(
      "backup export includes core tables",
      backup.status === 200 &&
        Array.isArray(backup.data.users) &&
        Array.isArray(backup.data.payments) &&
        backup.data.settings,
      `status ${backup.status}`
    );

    const disable = await call("/api/admin/2fa/disable", {
      method: "POST",
      body: { password, code: codeFor(secret) },
    });
    check("2FA can be disabled with password + code", disable.status === 200, `status ${disable.status}`);
    enabled = false;

    await call("/api/auth/logout", { method: "POST" });
    const normal = await call("/api/auth/login", { method: "POST", body: { email, password } });
    check("password login works again after disabling 2FA", normal.status === 200 && normal.data.user?.role === "admin", `status ${normal.status}`);
  } finally {
    if (enabled) {
      try {
        await call("/api/admin/2fa/disable", { method: "POST", body: { password, code: codeFor(secret) } });
      } catch {
        /* best-effort cleanup */
      }
    }
  }

  console.log(`\n${passed} security checks passed`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
