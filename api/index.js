// Vercel function entry point for /api (all other /api/* requests are routed
// here through the rewrite in vercel.json).
// `build/server.mjs` is produced by `npm run build:server` during the build step,
// so the whole Express app ships as one self-contained ES module.
import app from "../build/server.mjs";

export default app;
