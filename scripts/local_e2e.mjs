/**
 * Local E2E orchestrator - single command for Step 3.
 */

import { spawn } from "child_process";

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { shell: true, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`${command} exited with code ${code}`));
    });
  });
}

function runShell(command) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, { shell: true, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`command exited with code ${code}`));
    });
  });
}

async function main() {
  await run("node", ["scripts/local_clean.mjs"]);
  await run("npm", ["install"]);
  await run("npm", ["--prefix", "functions", "install"]);
  await run("npm", ["--prefix", "calybra-database", "install"]);
  await run("node", ["scripts/truth.mjs"]);
  await run("node", ["scripts/consistency.mjs"]);

  await runShell(
    "firebase emulators:exec --only auth,firestore,storage,functions \"node scripts/local_e2e_runner.mjs\""
  );
}

main().catch((error) => {
  process.stderr.write(`[local:e2e] failed: ${String(error)}\n`);
  process.exit(1);
});
