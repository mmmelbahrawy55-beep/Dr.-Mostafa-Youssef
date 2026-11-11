/**
 * Full off-site backup of the project's Redis namespace.
 *
 * Uses the Upstash REST API directly (no server or admin login needed), so it
 * still works if the app is down. Sessions, login challenges and rate-limit
 * counters are skipped: they are short-lived and restoring them is not useful.
 *
 *   npm run backup
 *
 * Writes data/backups/backup-<timestamp>.json (git-ignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const prefix = (process.env.REDIS_PREFIX || "dm").replace(/:+$/, "");
if (!url?.startsWith("http") || !token) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN in .env.local or the environment.");
  process.exit(1);
}

async function command(...args) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw new Error(`Redis command failed (${response.status}): ${args[0]}`);
  }
  const payload = await response.json();
  return payload.result;
}

async function scan(pattern) {
  let cursor = "0";
  const keys = [];
  do {
    const [next, batch] = await command("SCAN", cursor, "MATCH", pattern, "COUNT", "200");
    cursor = String(next);
    keys.push(...(batch ?? []));
  } while (cursor !== "0");
  return keys;
}

const EPHEMERAL = ["sess", "usess", "chal", "rl", "fail"];
const skip = (key) => {
  const rest = key.slice(prefix.length + 1);
  const group = rest.split(":")[0];
  return EPHEMERAL.includes(group);
};

async function main() {
  const started = Date.now();
  const keys = (await scan(`${prefix}:*`)).filter((key) => !skip(key)).sort();
  console.log(`Backing up ${keys.length} keys from namespace "${prefix}"…`);

  const rows = [];
  let index = 0;
  let files = 0;

  async function worker() {
    while (index < keys.length) {
      const key = keys[index++];
      const type = await command("TYPE", key);
      let value = null;
      if (type === "string") value = await command("GET", key);
      else if (type === "hash") value = await command("HGETALL", key);
      else if (type === "set") value = await command("SMEMBERS", key);
      else if (type === "list") value = await command("LRANGE", key, 0, -1);
      else continue;

      if (key.startsWith(`${prefix}:f:`)) files += 1;
      rows.push({ key, type, value });
    }
  }

  await Promise.all(Array.from({ length: 8 }, worker));

  const directory = path.join(ROOT, "data", "backups");
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(directory, `backup-${stamp}.json`);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    namespace: prefix,
    keyCount: rows.length,
    keys: rows,
  };
  writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });

  const size = (JSON.stringify(payload).length / 1024 / 1024).toFixed(1);
  console.log(`Saved ${rows.length} keys (${files} stored images), ${size} MB → ${path.relative(ROOT, file)}`);
  console.log(`Took ${Date.now() - started} ms`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
