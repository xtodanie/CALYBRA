#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}

function fail(msg) {
  console.error(`TRUTH_LOCK_FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`TRUTH_LOCK_OK: ${msg}`);
}

function assertFile(p, hint) {
  if (!exists(p)) fail(`Missing required file: ${p}${hint ? ` | ${hint}` : ""}`);
  else ok(`Found ${p}`);
}

function assertDir(p, hint) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    fail(`Missing required directory: ${p}${hint ? ` | ${hint}` : ""}`);
  } else {
    ok(`Found dir ${p}`);
  }
}

function jsonParse(p) {
  try {
    return JSON.parse(read(p));
  } catch (e) {
    fail(`Invalid JSON in ${p}: ${e.message}`);
    return null;
  }
}

function main() {
  // ==== Required governance/docs (adjust only if your constitution says otherwise)
  assertFile("firebase.json", "Needed to confirm deployed functions source.");
  assertFile("firestore.rules", "Firestore rules are a primary truth source.");
  assertFile("storage.rules", "Storage rules are a primary truth source.");

  // Contracts (these were referenced in your recon)
  if (exists("contracts")) {
    assertFile("contracts/firestore.schema.md", "Schema contract referenced by repo.");
    assertFile("contracts/status-machines.md", "Status machines referenced by repo.");
  }

  // ==== Deployment sanity: functions.source must exist
  const fb = jsonParse("firebase.json");
  if (fb) {
    // Firebase can define "functions" as object or array; handle both.
    const functions = fb.functions;
    if (!functions) {
      fail(`firebase.json missing "functions" key. Cannot confirm deploy source.`);
    } else {
      const sources = [];
      if (Array.isArray(functions)) {
        for (const f of functions) if (f?.source) sources.push(f.source);
      } else if (typeof functions === "object") {
        if (functions.source) sources.push(functions.source);
      }

      if (sources.length === 0) {
        fail(`firebase.json functions section does not declare a "source".`);
      } else {
        // Ensure all sources exist on disk
        for (const s of sources) {
          assertDir(s, `firebase.json declares this as deployed functions source.`);
          // Require a package.json inside each functions source
          assertFile(path.join(s, "package.json"), "Functions source must be a Node package.");
        }
        ok(`Functions sources: ${sources.join(", ")}`);
      }
    }
  }

  // ==== Minimal invariant: scripts directory exists (this script is inside it)
  assertDir("scripts");

  // Final decision
  if (process.exitCode === 1) {
    console.error("TRUTH_LOCK: FAILED. Fix the reported issues before any implementation work.");
    process.exit(1);
  } else {
    console.log("TRUTH_LOCK: PASSED.");
  }
}

main();
