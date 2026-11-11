import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minimal RFC 6238 TOTP implementation.
 *
 * Kept dependency-free on purpose: the app already ships a small server
 * bundle, and a six-line HOTP is easier to audit than a new supply-chain
 * dependency for the single security feature that must never be wrong.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Accepts the previous/next 30-second step to tolerate clock drift. */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const normalized = String(token ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalized) || !secret) return false;

  const counter = Math.floor(Date.now() / 30_000);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(hotp(secret, counter + offset));
    if (timingSafeEqual(expected, Buffer.from(normalized))) return true;
  }
  return false;
}

export function totpUri(secret: string, account: string, issuer = "Dr. Mostafa Youssef"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function hashBackupCode(code: string): string {
  return createHash("sha256")
    .update(String(code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .digest("hex");
}

export function generateBackupCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
  return { codes, hashes: codes.map(hashBackupCode) };
}

/** Returns the index of the matching backup code, or -1. */
export function verifyBackupCode(code: string, hashes: string[]): number {
  const hash = hashBackupCode(code);
  return hashes.findIndex((entry) => entry === hash);
}
