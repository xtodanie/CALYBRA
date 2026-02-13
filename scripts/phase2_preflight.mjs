import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "lint"]],
  ["npm", ["test", "--", "server/tests/workflows/brainReplay.workflow.test.ts", "server/tests/workflows/periodFinalized.workflow.test.ts", "server/tests/failure-sim.spec.ts"]],
  ["npm", ["test", "--", "server/tests/workflows/phase2FinalGate.workflow.test.ts"]],
  ["node", ["scripts/integrity-check.mjs"]],
  ["node", ["scripts/consistency.mjs"]],
];

for (const [command, args] of commands) {
  console.log(`PHASE2_PREFLIGHT_RUN: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`PHASE2_PREFLIGHT_FAIL: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

console.log("PHASE2_PREFLIGHT: PASS");
