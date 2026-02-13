#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const mode = process.argv.includes("--full") ? "full" : "fast";

const steps = mode === "full"
  ? [
      ["npm", ["run", "typecheck"]],
      ["npm", ["run", "lint"]],
      ["npm", ["run", "test", "--", "server/tests/invariants/zerebroxInvariants.test.ts"]],
      ["npm", ["run", "test", "--", "server/tests/e2e/zerebroxControlPlane.e2e.test.ts"]],
      ["npm", ["run", "test", "--", "server/tests/workflows/zerebroxControlPlane.workflow.test.ts"]],
      ["npm", ["run", "test", "--", "server/tests/logic/zerebroxControlPlane.test.ts"]],
      ["npm", ["run", "truth-lock"]],
    ]
  : [
      ["npm", ["run", "test", "--", "server/tests/invariants/zerebroxInvariants.test.ts"]],
      ["npm", ["run", "test", "--", "server/tests/e2e/zerebroxControlPlane.e2e.test.ts"]],
      ["npm", ["run", "test", "--", "server/tests/workflows/zerebroxControlPlane.workflow.test.ts"]],
    ];

console.log(`[control-plane-harness] mode=${mode}`);

for (const [command, args] of steps) {
  console.log(`\n[control-plane-harness] running: ${command} ${args.join(" ")}`);
  const run = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (run.status !== 0) {
    console.error(`[control-plane-harness] failed: ${command} ${args.join(" ")}`);
    process.exit(run.status ?? 1);
  }
}

console.log("\n[control-plane-harness] all checks passed");
