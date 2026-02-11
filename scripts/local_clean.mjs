/**
 * Local clean - destructive cleanup of repo-local build artifacts.
 */

import { rm } from "fs/promises";
import { resolve } from "path";

const targets = [
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".nx",
  ".expo",
  ".gradle",
  ".cache",
  "artifacts/step3",
];

async function removeTarget(target) {
  const path = resolve(process.cwd(), target);
  try {
    await rm(path, { recursive: true, force: true });
    process.stdout.write(`[local:clean] removed ${target}\n`);
  } catch (error) {
    process.stdout.write(`[local:clean] failed ${target}: ${String(error)}\n`);
  }
}

async function main() {
  for (const target of targets) {
    await removeTarget(target);
  }
}

main().catch((error) => {
  process.stderr.write(`[local:clean] fatal: ${String(error)}\n`);
  process.exit(1);
});
