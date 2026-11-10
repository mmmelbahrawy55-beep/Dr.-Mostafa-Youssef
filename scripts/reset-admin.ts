/**
 * Local/emergency admin recovery.
 *
 *   REDIS_PREFIX=dev npx tsx scripts/reset-admin.ts
 *
 * Generates a fresh random password for the existing admin account, bumps the
 * session version (logging out old cookies), and writes the credentials to the
 * git-ignored data/ folder. It never prints the password.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, findAdmin, updateUser } from "../server/db";
import { hashPassword } from "../server/security";

const admin = await findAdmin();
if (!admin) {
  console.error("No admin account exists. Start the server once so the seed can create it (set ADMIN_EMAIL/ADMIN_PASSWORD).");
  process.exit(1);
}

const password = randomBytes(18).toString("base64url");
const { salt, hash } = hashPassword(password);

await updateUser(admin.id, {
  password_salt: salt,
  password_hash: hash,
  session_version: Number(admin.session_version ?? 0) + 1,
});

const file = path.join(DATA_DIR, "admin-password.txt");
writeFileSync(file, `email: ${admin.email}\npassword: ${password}\nreset: ${new Date().toISOString()}\n`, { mode: 0o600 });

console.log(`Admin password reset for ${admin.email}. Credentials saved to ${file}`);
