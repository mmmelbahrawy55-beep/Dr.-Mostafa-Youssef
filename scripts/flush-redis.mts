import { Redis } from "@upstash/redis";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Load .env.local (allowlisted keys only, same rule as server/db.ts).
const envFile = path.join(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    if (!["KV_REST_API_URL", "KV_REST_API_TOKEN", "KV_URL", "REDIS_URL"].includes(m[1])) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const url = process.env.KV_REST_API_URL || process.env.REDIS_URL || "";
const token = process.env.KV_REST_API_TOKEN || "";
if (!url.startsWith("http") || token.length < 20) {
  console.error("missing credentials");
  process.exit(1);
}

const redis = new Redis({ url, token, automaticDeserialization: false });
console.log("ping:", await redis.ping());

// Collect every key we own (scan is paginated on the REST API).
const keys: string[] = [];
let cursor = "0";
do {
  const res: any = await redis.scan(cursor, { match: "dm:*", count: 500 });
  cursor = String(res[0]);
  keys.push(...(res[1] || []));
} while (cursor !== "0");

console.log("found", keys.length, "keys");
if (process.argv.includes("--dry-run")) {
  console.log(keys.slice(0, 50).join("\n"));
  process.exit(0);
}
if (keys.length) {
  // DEL in batches to stay well under request limits.
  for (let i = 0; i < keys.length; i += 200) {
    await redis.del(...keys.slice(i, i + 200));
  }
}
console.log("flushed", keys.length, "keys");
