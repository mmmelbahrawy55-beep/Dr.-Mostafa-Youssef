// Vercel function entry point for every /api/* request.
// `build/server.mjs` is produced by `npm run build:server` during the build step,
// so the whole Express app ships as one self-contained ES module.
import app from "../build/server.mjs";

export default app;
