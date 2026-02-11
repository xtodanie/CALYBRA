/**
 * Local up - starts emulators and app with readiness checks.
 */

import { spawn } from "child_process";

const appUrl = "http://127.0.0.1:9002";
const readinessTimeoutMs = 120_000;
const pollIntervalMs = 1_000;

function spawnProcess(command, args) {
  return spawn(command, args, { shell: true, stdio: "inherit" });
}

async function waitForApp() {
  const start = Date.now();
  while (Date.now() - start < readinessTimeoutMs) {
    try {
      const response = await fetch(appUrl);
      if (response) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`App not ready within ${readinessTimeoutMs}ms`);
}

async function main() {
  const emulators = spawnProcess("firebase", ["emulators:start", "--only", "auth,firestore,storage,functions"]);
  const devServer = spawnProcess("npm", ["run", "dev"]);

  const shutdown = () => {
    devServer.kill("SIGTERM");
    emulators.kill("SIGTERM");
    setTimeout(() => {
      devServer.kill("SIGKILL");
      emulators.kill("SIGKILL");
    }, 5_000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await waitForApp();
  // Keep process alive until SIGINT/SIGTERM
  await new Promise(() => {});
}

main().catch((error) => {
  process.stderr.write(`[local:up] failed: ${String(error)}\n`);
  process.exit(1);
});
