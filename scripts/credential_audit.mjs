#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const trackedFiles = execSync("git ls-files", { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith("node_modules/"));

const rules = [
  {
    name: "Google API key",
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
  },
  {
    name: "Private key block",
    regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
  },
  {
    name: "Service account private_key field",
    regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/g,
  },
  {
    name: "Service account JSON type",
    regex: /"type"\s*:\s*"service_account"/g,
  },
  {
    name: "Suspicious secret assignment",
    regex: /(?:GEMINI|GOOGLE_MAPS|ANTHROPIC|OPENAI|API|SECRET|TOKEN)[A-Z0-9_]*\s*=\s*([^\r\n#]+)/g,
  },
];

const ignoredFileSuffixes = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".lock"];
const ignoredFiles = new Set([
  ".env.local.example",
  "agent/RELEASE.md",
]);

const findings = [];

for (const file of trackedFiles) {
  if (ignoredFiles.has(file)) continue;
  if (ignoredFileSuffixes.some((suffix) => file.endsWith(suffix))) continue;

  const absolutePath = path.join(root, file);
  let content;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }

  for (const rule of rules) {
    const matches = [...content.matchAll(rule.regex)];
    for (const match of matches) {
      if (rule.name === "Suspicious secret assignment") {
        const rawValue = (match[1] ?? "").trim().replace(/^['\"]|['\"]$/g, "");
        const placeholderLike =
          rawValue.startsWith("<") ||
          rawValue.startsWith("your-") ||
          rawValue.includes("your-") ||
          rawValue.startsWith("${") ||
          rawValue.startsWith("process.env") ||
          rawValue.length < 20;

        if (placeholderLike) {
          continue;
        }
      }

      const before = content.slice(0, match.index);
      const line = before.split(/\r?\n/).length;
      findings.push({
        file,
        line,
        rule: rule.name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("CREDENTIAL_AUDIT_FAIL: potential credentials detected in tracked files");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`);
  }
  process.exit(1);
}

console.log("CREDENTIAL_AUDIT_PASS: no tracked credential signatures detected");
