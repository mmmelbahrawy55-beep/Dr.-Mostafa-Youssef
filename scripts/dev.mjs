import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

const children = [];

function run(name, args, color) {
  const child = spawn(npm, args, {
    stdio: ["inherit", "pipe", "pipe"],
    // Windows cannot spawn .cmd shims directly, so route them through the shell.
    shell: isWindows,
    windowsHide: true,
    env: process.env,
  });

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;

  child.stdout.on("data", (chunk) => {
    process.stdout.write(
      String(chunk)
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => `${prefix}${line}`)
        .join("\n") + "\n"
    );
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(
      String(chunk)
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => `${prefix}${line}`)
        .join("\n") + "\n"
    );
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${prefix}exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

run("api", ["run", "dev:api"], "33");
run("web", ["run", "dev:web"], "36");

function shutdown() {
  for (const child of children) {
    if (child.killed) continue;
    if (isWindows && child.pid) {
      // Kill the whole process tree so vite/tsx watchers stop too.
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
    } else {
      child.kill("SIGINT");
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
