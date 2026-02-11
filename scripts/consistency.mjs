#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readFileIfExists(p) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function listFiles(dir, exts = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".rules", ".json"])) {
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

function grep(files, regex) {
  const hits = [];
  for (const f of files) {
    const txt = readFileIfExists(f);
    if (!txt) continue;
    const lines = txt.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) hits.push({ file: f, line: i + 1, text: lines[i].trim() });
    }
  }
  return hits;
}

function fail(msg) {
  console.error(`CONSISTENCY_FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`CONSISTENCY_OK: ${msg}`);
}

function printTop(hits, n = 10) {
  for (const h of hits.slice(0, n)) {
    console.error(`  - ${h.file}:${h.line} | ${h.text}`);
  }
  if (hits.length > n) console.error(`  ... +${hits.length - n} more`);
}

function extractZodEnumValues(tsText) {
  // crude but effective for z.enum(["A","B"])
  const m = tsText.match(/z\.enum\(\s*\[([^\]]+)\]\s*\)/);
  if (!m) return null;
  const inner = m[1];
  const vals = [];
  for (const mm of inner.matchAll(/"([^"]+)"/g)) vals.push(mm[1]);
  return vals.length ? vals : null;
}

function extractMonthCloseStatusFromTypes(tsText) {
  // Matches: export enum MonthCloseStatus { DRAFT = "DRAFT", ... }
  const enumMatch = tsText.match(/enum\s+MonthCloseStatus\s*\{([\s\S]*?)\}/m);
  if (!enumMatch) return null;

  const body = enumMatch[1];
  const vals = [];
  for (const mm of body.matchAll(/\b([A-Z_]+)\s*=\s*"([A-Z_]+)"/g)) {
    if (mm[1] === mm[2]) vals.push(mm[2]);
  }
  return vals.length ? Array.from(new Set(vals)) : null;
}

function main() {
  const allFiles = [
    ...listFiles("."),
  ];

  // 1) Detect top-level fileAssets reads/writes (the exact bug you saw)
    const topLevelFileAssets = grep(allFiles, /\bcollection\(\s*[^,]+,\s*['"]fileAssets['"]\s*\)/);
    const adminTopLevelFileAssets = grep(
      allFiles,
      /\bdb\.collection\(\s*['"]fileAssets['"]\s*\)|\bcollection\(\s*[^,]+,\s*['"]fileAssets['"]\s*\)/
    );

  const tenantFileAssets = grep(allFiles, /['"]tenants['"]\s*,\s*[^,]+\s*,\s*['"]fileAssets['"]/);

  if (adminTopLevelFileAssets.length > 0 && tenantFileAssets.length > 0) {
    fail(`fileAssets path drift detected: both top-level "fileAssets" and tenant-scoped "tenants/{tenantId}/fileAssets" are used.`);
    console.error(`Top-level usages (sample):`);
    printTop(adminTopLevelFileAssets);
    console.error(`Tenant-scoped usages (sample):`);
    printTop(tenantFileAssets);
  } else if (adminTopLevelFileAssets.length > 0) {
    fail(`Top-level "fileAssets" usage detected. Expected tenant-scoped path only.`);
    printTop(adminTopLevelFileAssets);
  } else if (tenantFileAssets.length > 0) {
    ok(`fileAssets appears tenant-scoped (no top-level usages detected).`);
  } else {
    fail(`No fileAssets usage found. If expected, paths may be different than assumed.`);
  }

  // 2) MonthCloseStatus drift check (types vs schema vs UI)
  // Adjust these paths if your repo uses different locations.
  const typesPathCandidates = [
    "src/lib/types.ts",
    "src/types.ts",
    "src/domain/types.ts",
    "types.ts",
  ];
  const schemaPathCandidates = [
    "src/domain/schemas/monthClose.schema.ts",
    "src/schemas/monthClose.schema.ts",
    "monthClose.schema.ts",
  ];

  const typesPath = typesPathCandidates.find(p => readFileIfExists(p));
  const schemaPath = schemaPathCandidates.find(p => readFileIfExists(p));

  if (!typesPath) fail(`Could not locate types file (checked: ${typesPathCandidates.join(", ")}).`);
  if (!schemaPath) fail(`Could not locate monthClose schema file (checked: ${schemaPathCandidates.join(", ")}).`);

  let typeStatuses = null;
  let schemaStatuses = null;

  if (typesPath) {
    const t = readFileIfExists(typesPath);
    typeStatuses = extractMonthCloseStatusFromTypes(t || "");
    if (!typeStatuses) fail(`Could not extract MonthCloseStatus values from ${typesPath}.`);
    else ok(`Extracted MonthCloseStatus from ${typesPath}: ${typeStatuses.join(", ")}`);
  }

  if (schemaPath) {
    const s = readFileIfExists(schemaPath);
    schemaStatuses = extractZodEnumValues(s || "");
    if (!schemaStatuses) fail(`Could not extract z.enum([...]) values from ${schemaPath}.`);
    else ok(`Extracted schema statuses from ${schemaPath}: ${schemaStatuses.join(", ")}`);
  }

  if (typeStatuses && schemaStatuses) {
    const typeSet = new Set(typeStatuses);
    const schemaSet = new Set(schemaStatuses);
    const onlyInTypes = [...typeSet].filter(x => !schemaSet.has(x));
    const onlyInSchema = [...schemaSet].filter(x => !typeSet.has(x));

    if (onlyInTypes.length || onlyInSchema.length) {
      fail(`MonthCloseStatus drift detected between types and schema.`);
      if (onlyInTypes.length) console.error(`  Present only in types: ${onlyInTypes.join(", ")}`);
      if (onlyInSchema.length) console.error(`  Present only in schema: ${onlyInSchema.join(", ")}`);

      // also find UI usage of missing statuses
      const uiHits = grep(allFiles, new RegExp(`\\b(${onlyInTypes.join("|")})\\b`));
      if (uiHits.length) {
        console.error(`  UI/code references to drift statuses (sample):`);
        printTop(uiHits);
      }
    } else {
      ok(`MonthCloseStatus types and schema are consistent.`);
    }
  }

  // 3) Rules allow client writes to invoices/matches (authority boundary)
  const rules = readFileIfExists("firestore.rules");
  if (rules) {
    const invoicesAllowClient = /match\s+\/tenants\/\{tenantId\}\/invoices\/\{invoiceId\}\s*\{[\s\S]*allow\s+(create|write|update)[^;]*\(\s*[^)]*isServer\(\)[^)]*\|\|/m.test(rules);
    const matchesAllowClient = /match\s+\/tenants\/\{tenantId\}\/matches\/\{matchId\}\s*\{[\s\S]*allow\s+(create|write|update)[^;]*\(\s*[^)]*isServer\(\)[^)]*\|\|/m.test(rules);

    if (invoicesAllowClient) fail(`firestore.rules appears to allow non-server writes for invoices (isServer() || ...). Review authority boundary.`);
    else ok(`firestore.rules does not obviously allow client writes for invoices (heuristic).`);

    if (matchesAllowClient) fail(`firestore.rules appears to allow non-server writes for matches (isServer() || ...). Review authority boundary.`);
    else ok(`firestore.rules does not obviously allow client writes for matches (heuristic).`);
  } else {
    fail(`firestore.rules not found at repo root.`);
  }

  if (process.exitCode === 1) {
    console.error("CONSISTENCY: FAILED. Fix the reported inconsistencies before implementation work.");
    process.exit(1);
  } else {
    console.log("CONSISTENCY: PASSED.");
  }
}

main();
