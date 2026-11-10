// Public media proxy for /uploads/* on Vercel.
//
// Uploaded files live in Upstash Redis (base64 JSON), not on the function
// filesystem. A Vercel rewrite sends /uploads/<name> here with ?name=<name>,
// because Vercel only serves function files under /api/*.
import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.REDIS_URL || "";
const token = process.env.KV_REST_API_TOKEN || "";
const prefix = `${(process.env.REDIS_PREFIX || "dm").replace(/:+$/, "")}:`;

const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!redis) {
    res.status(503).json({ error: "Storage is not configured" });
    return;
  }

  const name = String(req.query.name || "")
    .split("/")
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "");

  if (!name) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const raw = await redis.get(`${prefix}f:${name}`);
    if (!raw) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed?.data) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const buffer = Buffer.from(parsed.data, "base64");
    res.setHeader("Content-Type", parsed.mime || "application/octet-stream");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(buffer);
  } catch {
    res.status(500).json({ error: "Could not load the image" });
  }
}
