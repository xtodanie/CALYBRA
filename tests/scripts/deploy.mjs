import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(cmd) {
  const result = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const firebaseConfig = JSON.parse(readFileSync("firebase.json", "utf8"));
const targets = [];

if (firebaseConfig.firestore) targets.push("firestore");
if (firebaseConfig.storage) targets.push("storage");
if (firebaseConfig.functions) targets.push("functions");
if (firebaseConfig.hosting) targets.push("hosting");

run("node scripts/test.mjs");

if (targets.length === 0) {
  console.error("No deploy targets found in firebase.json");
  process.exit(1);
}

run(`firebase deploy --only ${targets.join(",")}`);
