/**
 * Local E2E runner executed under firebase emulators:exec.
 */

import { spawn } from "child_process";
import { mkdirSync, createWriteStream } from "fs";
import { resolve } from "path";

const appUrl = "http://127.0.0.1:9002";
const readinessTimeoutMs = 120_000;
const pollIntervalMs = 1_000;

const artifactsDir = resolve(process.cwd(), "artifacts", "step3");
mkdirSync(artifactsDir, { recursive: true });
const logPath = resolve(artifactsDir, "local_e2e.log");
const logStream = createWriteStream(logPath, { flags: "a" });

function log(line) {
  const text = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(text);
  logStream.write(text);
}

function spawnLogged(command, args, options = {}) {
  log(`[spawn] ${command} ${args.join(" ")}`);
  const child = spawn(command, args, { shell: true, ...options });
  child.stdout.on("data", (chunk) => logStream.write(chunk));
  child.stderr.on("data", (chunk) => logStream.write(chunk));
  return child;
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    child.once("exit", finish);
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }

    setTimeout(() => {
      try {
        if (!child.killed) child.kill("SIGKILL");
      } finally {
        finish();
      }
    }, 5_000).unref();
  });
}

async function waitForApp() {
  const start = Date.now();
  while (Date.now() - start < readinessTimeoutMs) {
    try {
      const response = await fetch(appUrl);
      if (response) {
        log(`[ready] app responded with status ${response.status}`);
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`App not ready within ${readinessTimeoutMs}ms`);
}

async function runCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnLogged(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    child.on("exit", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  log("[step3] starting Next.js dev server");
  const devServer = spawnLogged("npm", ["run", "dev"]);
  let success = false;

  try {
    await waitForApp();

    log("[step3] running workflow contract tests");
    await runCommand("npm", ["test", "--", "server/tests/workflows/workflow.contracts.test.ts"]);

    log("[step3] running emulator-backed invariant tests");
    await runCommand("npm", ["test", "--", "tests/invariants"]);

    log("[step3] completed successfully");
    success = true;
  } finally {
    log("[step3] stopping Next.js dev server");
    await stopProcess(devServer);
    logStream.end();
    if (!success) process.exit(1);
  }
}

main().catch((error) => {
  log(`[step3] failed: ${String(error)}`);
  logStream.end();
  process.exit(1);
});
