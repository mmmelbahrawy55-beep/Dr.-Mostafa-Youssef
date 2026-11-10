/**
 * One-time (or on-demand) admin password rotation.
 *
 *   BASE_URL=https://... OLD_ADMIN_PASSWORD="..." node scripts/rotate-admin.mjs
 *
 * - logs in with the current password
 * - sets a fresh random password (and invalidates every old session)
 * - writes the new credentials to a git-ignored file under data/
 * - turns automatic payment approval off (manual review is the safe default)
 * - verifies the old password is rejected and the new one works
 *
 * The new password is never printed to stdout, so it does not end up in logs.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const base = (process.env.BASE_URL || "https://dr-mostafa-youssef.vercel.app").replace(/\/+$/, "");
const email = (process.env.ADMIN_EMAIL || "admin@drmostafayoussef.com").toLowerCase();
const oldPassword = process.env.OLD_ADMIN_PASSWORD;

if (!oldPassword) {
  console.error("OLD_ADMIN_PASSWORD is required.");
  process.exit(1);
}

let cookie = "";

async function request(pathname, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (cookie) headers.cookie = cookie;
  let body = init.body;
  if (body && typeof body !== "string" && !(body instanceof FormData)) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(base + pathname, { ...init, headers, body });
  for (const entry of response.headers.getSetCookie?.() ?? []) {
    const pair = entry.split(";")[0];
    if (pair.startsWith("my_session=")) cookie = pair;
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

const login = await request("/api/auth/login", { method: "POST", body: { email, password: oldPassword } });
if (login.status !== 200 || !login.data?.user) {
  console.error(`Login failed with status ${login.status}. The password may already be rotated.`);
  process.exit(1);
}

const user = login.data.user;
const newPassword = randomBytes(18).toString("base64url");

const changed = await request("/api/account", {
  method: "PATCH",
  body: {
    name: user.name,
    phone: user.phone,
    password: newPassword,
    // Ignored by older deployments, required after the security update.
    currentPassword: oldPassword,
  },
});

if (changed.status !== 200) {
  console.error(`Password change failed (${changed.status}): ${JSON.stringify(changed.data)}`);
  process.exit(1);
}

const settings = await request("/api/admin/settings");
if (settings.status === 200 && settings.data?.settings) {
  const current = settings.data.settings;
  const result = await request("/api/admin/settings", {
    method: "PUT",
    body: { ...current, payments: { ...current.payments, autoApprove: false } },
  });
  console.log(`automatic approval: ${result.status === 200 ? "disabled (manual review)" : `update failed (${result.status})`}`);
}

const host = new URL(base).host.replace(/[^a-z0-9.-]/gi, "_");
mkdirSync("data", { recursive: true });
const file = path.join("data", `admin-password-${host}.txt`);
writeFileSync(
  file,
  `url: ${base}\nemail: ${email}\npassword: ${newPassword}\nchanged: ${new Date().toISOString()}\n`,
  { mode: 0o600 }
);

async function loginStatus(password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.status;
}

const oldStatus = await loginStatus(oldPassword);
const newStatus = await loginStatus(newPassword);

console.log(`Rotated admin password for ${base}.`);
console.log(`Saved credentials to ${file}`);
console.log(`old password -> HTTP ${oldStatus} (expected 401), new password -> HTTP ${newStatus} (expected 200)`);

if (newStatus !== 200 || oldStatus === 200) process.exit(1);
