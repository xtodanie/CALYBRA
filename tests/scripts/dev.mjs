import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const withEmulators = args.includes("--emulators");

if (withEmulators) {
  spawn("node scripts/emulators.mjs", {
    stdio: "inherit",
    shell: true,
  });
}

const dev = spawn("npm run dev", {
  stdio: "inherit",
  shell: true,
});

dev.on("exit", (code) => {
  process.exit(code ?? 0);
});
