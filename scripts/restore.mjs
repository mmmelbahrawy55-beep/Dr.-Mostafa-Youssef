/**
 * Restores a file produced by scripts/backup.mjs.
 *
 * Destructive on purpose, so it requires an explicit confirmation AND the
 * target namespace must match unless RESTORE_FORCE_NAMESPACE=1 is set.
 *
 *   RESTORE_CONFIRM=YES node scripts/restore.mjs data/backups/backup-....json
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const envFile = path.join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error("Usage: RESTORE_CONFIRM=YES node scripts/restore.mjs data/backups/<file>.json");
  process.exit(1);
}
if (process.env.RESTORE_CONFIRM !== "YES") {
  console.error("Refusing to restore without RESTORE_CONFIRM=YES.");
  process.exit(1);
}

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const prefix = (process.env.REDIS_PREFIX || "dm").replace(/:+$/, "");
if (!url?.startsWith("http") || !token) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN.");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8"));
if (backup.namespace !== prefix && process.env.RESTORE_FORCE_NAMESPACE !== "1") {
  console.error(
    `Backup namespace "${backup.namespace}" does not match the current "${prefix}". ` +
      "Set RESTORE_FORCE_NAMESPACE=1 only if you are certain."
  );
  process.exit(1);
}
if (!Array.isArray(backup.keys)) {
  console.error("This file is not a full Redis backup. Use the admin JSON export for row-level recovery.");
  process.exit(1);
}

/**
 * Retries transient Upstash failures. A restore deletes a key before writing it
 * back, so a dropped connection must be retried instead of leaving that key
 * empty (or aborting the rest of the file).
 */
async function command(...args) {
  const attempts = 6;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(5_000, 300 * 2 ** attempt)));
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      lastError = error;
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`Redis command failed (${response.status}): ${args[0]}`);
      continue;
    }
    if (!response.ok) throw new Error(`Redis command failed (${response.status}): ${args[0]}`);
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      lastError = error;
      continue;
    }
    if (payload?.error) throw new Error(`Redis command failed: ${args[0]} — ${payload.error}`);
    return payload.result;
  }
  throw lastError instanceof Error ? lastError : new Error(`Redis command failed: ${args[0]}`);
}

function chunks(list, size) {
  const out = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

async function main() {
  const verifyOnly = process.env.RESTORE_VERIFY_ONLY === "1";
  let restored = 0;
  if (!verifyOnly) {
    for (const row of backup.keys) {
      if (!row?.key || !row.type) continue;
      await command("DEL", row.key);

      if (row.type === "string") {
        await command("SET", row.key, row.value ?? "");
      } else if (row.type === "hash") {
        const flat = Array.isArray(row.value) ? row.value : [];
        for (const part of chunks(flat, 500)) {
          if (part.length >= 2) await command("HSET", row.key, ...part);
        }
      } else if (row.type === "set") {
        const members = Array.isArray(row.value) ? row.value : [];
        for (const part of chunks(members, 500)) {
          if (part.length) await command("SADD", row.key, ...part);
        }
      } else if (row.type === "list") {
        const items = Array.isArray(row.value) ? row.value : [];
        for (const part of chunks(items, 500)) {
          if (part.length) await command("RPUSH", row.key, ...part);
        }
      }
      restored += 1;
      if (restored % 50 === 0) console.log(`Restored ${restored}/${backup.keys.length}…`);
    }
  } else {
    console.log(`Verify-only: checking ${backup.keys.length} keys without writing…`);
  }

  // Verify every key exists with the expected type and size. Cheap commands
  // (TYPE/STRLEN/…) catch a key that ended up empty without re-reading 70 MB.
  const bad = [];
  for (const row of backup.keys) {
    if (!row?.key || !row.type) continue;
    const type = await command("TYPE", row.key);
    let count = 0;
    if (row.type === "string") count = Number(await command("STRLEN", row.key));
    else if (row.type === "hash") count = Number(await command("HLEN", row.key));
    else if (row.type === "set") count = Number(await command("SCARD", row.key));
    else if (row.type === "list") count = Number(await command("LLEN", row.key));
    const expected =
      row.type === "string"
        ? // STRLEN counts UTF-8 bytes, not JS characters (Arabic text is 2 bytes).
          Buffer.byteLength(String(row.value ?? ""), "utf8")
        : Array.isArray(row.value)
          ? row.type === "hash"
            ? row.value.length / 2
            : row.value.length
          : 0;
    if (type !== row.type || (expected > 0 && count !== expected)) {
      bad.push(`${row.key} (${type}, ${count} vs ${expected})`);
    }
  }
  if (bad.length) {
    const sample = bad.slice(0, 5).join("; ");
    throw new Error(`${bad.length} keys did not restore correctly (${sample}). Run the restore again.`);
  }

  console.log(
    verifyOnly
      ? `Verified ${restored || backup.keys.length} keys in namespace "${prefix}".`
      : `Restored ${restored} keys into namespace "${prefix}" and verified every one.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
