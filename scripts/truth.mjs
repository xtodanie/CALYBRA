#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SNAPSHOT_PATH = "agent/TRUTH_SNAPSHOT.md";

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}

function write(p, content) {
  const full = path.join(ROOT, p);
  const dir = path.dirname(full);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, "utf8");
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

function listFiles(dir, exts = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".rules"])) {
  const out = [];
  function walk(d) {
    const full = path.join(ROOT, d);
    if (!fs.existsSync(full)) return;
    for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
      const rel = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "dist") continue;
        walk(rel);
      } else {
        const ext = path.extname(ent.name);
        if (exts.has(ext) || ent.name === "firestore.rules" || ent.name === "storage.rules") out.push(rel);
      }
    }
  }
  walk(dir);
  return out;
}

function lineNumberAt(text, index) {
  if (index <= 0) return 1;
  return text.slice(0, index).split("\n").length;
}

function collectRegexMatches(filePath, text, regex) {
  const hits = [];
  for (const match of text.matchAll(regex)) {
    const idx = match.index ?? 0;
    hits.push({
      file: filePath,
      line: lineNumberAt(text, idx),
      text: match[0].trim(),
      groups: match.slice(1),
    });
  }
  return hits;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function toLines(title, items) {
  if (!items.length) return ["- (none)"];
  return items.map((item) => `- ${item}`);
}

function summarizeRolesFromRules(rulesText) {
  const roleHits = collectRegexMatches(
    "firestore.rules",
    rulesText,
    /hasRole\(\s*\[([^\]]+)\]\s*\)/g
  );
  const roles = [];
  for (const hit of roleHits) {
    const list = hit.groups?.[0] || "";
    for (const m of list.matchAll(/"([A-Z_]+)"/g)) roles.push(m[1]);
  }
  return {
    roles: uniqueSorted(roles),
    refs: roleHits.map((h) => `${h.file}:${h.line} | ${h.text}`),
  };
}

function summarizeStatusLiterals(rulesText) {
  const statusHits = collectRegexMatches(
    "firestore.rules",
    rulesText,
    /\b(status|parseStatus)\s*[!=]=\s*"([A-Z_]+)"/g
  );
  const statuses = statusHits.map((h) => h.groups?.[1]).filter(Boolean);
  return {
    statuses: uniqueSorted(statuses),
    refs: statusHits.map((h) => `${h.file}:${h.line} | ${h.text}`),
  };
}

function summarizeMatchPaths(rulesText) {
  const matchHits = collectRegexMatches(
    "firestore.rules",
    rulesText,
    /match\s+\/[^\s{]+\{[^}]+\}[^\s]*\s*\{/g
  );
  return matchHits.map((h) => `${h.file}:${h.line} | ${h.text}`);
}

function summarizeStoragePaths(storageText) {
  const matchHits = collectRegexMatches(
    "storage.rules",
    storageText,
    /match\s+\/[^\s{]+\{[^}]+\}[^\s]*\s*\{/g
  );
  return matchHits.map((h) => `${h.file}:${h.line} | ${h.text}`);
}

function summarizeRulesLines(rulesText) {
  const lines = rulesText.split("\n");
  const allowLines = [];
  const hasOnlyLines = [];
  const hasAllLines = [];
  const statusLines = [];
  const serverOnly = [];
  let currentMatch = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNo = i + 1;

    const matchMatch = trimmed.match(/^match\s+([^\s{]+)\s*\{/);
    if (matchMatch) currentMatch = matchMatch[1];

    if (trimmed.startsWith("allow ")) {
      allowLines.push(`firestore.rules:${lineNo} | ${trimmed}`);
      if (currentMatch && /allow\s+write:\s+if\s+isServer\(\)\s*;/.test(trimmed)) {
        serverOnly.push(`firestore.rules:${lineNo} | ${currentMatch} | ${trimmed}`);
      }
    }

    if (trimmed.includes("hasOnly")) {
      hasOnlyLines.push(`firestore.rules:${lineNo} | ${trimmed}`);
    }
    if (trimmed.includes("hasAll")) {
      hasAllLines.push(`firestore.rules:${lineNo} | ${trimmed}`);
    }
    if (/\b(status|parseStatus)\s*[!=]=\s*"[A-Z_]+"/.test(trimmed)) {
      statusLines.push(`firestore.rules:${lineNo} | ${trimmed}`);
    }
  }

  return {
    allowLines,
    hasOnlyLines,
    hasAllLines,
    statusLines,
    serverOnly,
  };
}

function summarizeIdentitySources(rulesText) {
  const identityLines = [];
  const patterns = [
    /^function\s+userPath\(/,
    /^function\s+userData\(/,
    /^function\s+roleOfUser\(/,
    /^function\s+tenantOfUser\(/,
    /^function\s+isServer\(/,
  ];
  const lines = rulesText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (patterns.some((p) => p.test(trimmed))) {
      identityLines.push(`firestore.rules:${i + 1} | ${trimmed}`);
    }
  }
  return identityLines;
}

function summarizeTests() {
  const testFiles = listFiles("tests").filter((f) => /\.test\.(ts|tsx|js)$/.test(f));
  const roleHits = [];
  const statusHits = [];
  for (const f of testFiles) {
    const txt = read(f);
    roleHits.push(...collectRegexMatches(f, txt, /"(OWNER|MANAGER|ACCOUNTANT|VIEWER)"/g));
    statusHits.push(...collectRegexMatches(f, txt, /"(DRAFT|IN_REVIEW|FINALIZED|PENDING_UPLOAD|PROPOSED|CONFIRMED|REJECTED|PENDING|PARSED|FAILED)"/g));
  }
  return {
    testFiles,
    roleRefs: roleHits.map((h) => `${h.file}:${h.line} | ${h.text}`),
    statusRefs: statusHits.map((h) => `${h.file}:${h.line} | ${h.text}`),
  };
}

function buildSnapshot({
  firebaseConfig,
  firebaserc,
  rulesText,
  storageText,
  testsSummary,
}) {
  const rolesSummary = summarizeRolesFromRules(rulesText);
  const statusSummary = summarizeStatusLiterals(rulesText);
  const firestoreMatches = summarizeMatchPaths(rulesText);
  const storageMatches = summarizeStoragePaths(storageText);
  const rulesLines = summarizeRulesLines(rulesText);
  const identitySources = summarizeIdentitySources(rulesText);

  const functionsSources = [];
  if (firebaseConfig?.functions) {
    const functions = firebaseConfig.functions;
    if (Array.isArray(functions)) {
      for (const f of functions) if (f?.source) functionsSources.push(f.source);
    } else if (typeof functions === "object" && functions.source) {
      functionsSources.push(functions.source);
    }
  }

  const emulatorConfig = firebaseConfig?.emulators || {};
  const emulatorEntries = Object.entries(emulatorConfig)
    .filter(([, v]) => v && typeof v === "object" && "host" in v && "port" in v)
    .map(([k, v]) => `${k}: ${(v).host}:${(v).port}`)
    .sort();

  const snapshot = [];
  snapshot.push("# agent/TRUTH_SNAPSHOT.md");
  snapshot.push("");
  snapshot.push("This file is generated by `node scripts/truth.mjs`. Do not edit manually.");
  snapshot.push("");

  snapshot.push("## Sources");
  snapshot.push("- firestore.rules");
  snapshot.push("- storage.rules");
  snapshot.push("- firebase.json");
  if (firebaserc) snapshot.push("- .firebaserc");
  snapshot.push("- tests/**/*.test.ts");
  snapshot.push("");

  snapshot.push("## Firebase Config");
  snapshot.push("### Functions Sources");
  snapshot.push(...toLines("sources", functionsSources.length ? functionsSources : ["(none)"]));
  snapshot.push("");
  snapshot.push("### Emulators");
  snapshot.push(...toLines("emulators", emulatorEntries.length ? emulatorEntries : ["(none)"]));
  snapshot.push("");

  if (firebaserc) {
    snapshot.push("### .firebaserc Projects");
    const projects = firebaserc.projects ? Object.entries(firebaserc.projects).map(([k, v]) => `${k}: ${v}`) : [];
    snapshot.push(...toLines("projects", projects.length ? projects : ["(none)"]));
    snapshot.push("");
  }

  snapshot.push("## Firestore Rules Paths");
  snapshot.push(...toLines("paths", firestoreMatches));
  snapshot.push("");

  snapshot.push("## Storage Rules Paths");
  snapshot.push(...toLines("paths", storageMatches));
  snapshot.push("");

  snapshot.push("## Identity + RBAC Sources (from Firestore rules)");
  snapshot.push(...toLines("refs", identitySources));
  snapshot.push("");

  snapshot.push("## Roles (from Firestore rules)");
  snapshot.push(...toLines("roles", rolesSummary.roles));
  snapshot.push("");
  snapshot.push("### Role References");
  snapshot.push(...toLines("refs", rolesSummary.refs));
  snapshot.push("");

  snapshot.push("## Status Literals (from Firestore rules)");
  snapshot.push(...toLines("statuses", statusSummary.statuses));
  snapshot.push("");
  snapshot.push("### Status References");
  snapshot.push(...toLines("refs", statusSummary.refs));
  snapshot.push("");

  snapshot.push("## Access Rules (from Firestore rules)");
  snapshot.push("### Allow Rules");
  snapshot.push(...toLines("refs", rulesLines.allowLines));
  snapshot.push("");
  snapshot.push("### Required Fields (hasAll)");
  snapshot.push(...toLines("refs", rulesLines.hasAllLines));
  snapshot.push("");
  snapshot.push("### Field Allowlists (hasOnly)");
  snapshot.push(...toLines("refs", rulesLines.hasOnlyLines));
  snapshot.push("");
  snapshot.push("### Status Constraints (from rules)");
  snapshot.push(...toLines("refs", rulesLines.statusLines));
  snapshot.push("");
  snapshot.push("### Server-only Writes (derived from allow write: if isServer())");
  snapshot.push(...toLines("refs", rulesLines.serverOnly));
  snapshot.push("");

  snapshot.push("## Test Observations");
  snapshot.push(`- Test files scanned: ${testsSummary.testFiles.length}`);
  snapshot.push("### Roles in tests (sampled)");
  snapshot.push(...toLines("refs", testsSummary.roleRefs.slice(0, 50)));
  if (testsSummary.roleRefs.length > 50) snapshot.push(`- ... +${testsSummary.roleRefs.length - 50} more`);
  snapshot.push("");
  snapshot.push("### Statuses in tests (sampled)");
  snapshot.push(...toLines("refs", testsSummary.statusRefs.slice(0, 50)));
  if (testsSummary.statusRefs.length > 50) snapshot.push(`- ... +${testsSummary.statusRefs.length - 50} more`);
  snapshot.push("");

  snapshot.push("## Canonical Path Model (derived)");
  const usesTenantModel = /match\s+\/tenants\/\{tenantId\}/.test(rulesText);
  snapshot.push(`- Model: ${usesTenantModel ? "Tenant subcollections (Model A)" : "Unknown"}`);
  snapshot.push("");

  return snapshot.join("\n");
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

  const rulesText = read("firestore.rules");
  const storageText = read("storage.rules");
  const firebaserc = exists(".firebaserc") ? jsonParse(".firebaserc") : null;
  const testsSummary = summarizeTests();

  const snapshot = buildSnapshot({
    firebaseConfig: fb,
    firebaserc,
    rulesText,
    storageText,
    testsSummary,
  });
  write(SNAPSHOT_PATH, snapshot);
  ok(`Wrote ${SNAPSHOT_PATH}`);

  // Final decision
  if (process.exitCode === 1) {
    console.error("TRUTH_LOCK: FAILED. Fix the reported issues before any implementation work.");
    process.exit(1);
  } else {
    console.log("TRUTH_LOCK: PASSED.");
  }
}

main();
