import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function checkPassword(password: string, salt: string, hash: string) {
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export function parseCookies(header = "") {
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    if (!key) return;
    out[key] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return out;
}

export const nowIso = () => new Date().toISOString();

export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 86_400_000);

export function randomName(ext: string) {
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
}

export function safeJson<T>(value: unknown, fallback: T): T {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export const str = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
export const int = (value: unknown, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
