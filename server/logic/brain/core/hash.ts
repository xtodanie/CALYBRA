import crypto from "node:crypto";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const orderedKeys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  const normalizedRecord: Record<string, unknown> = {};
  for (const key of orderedKeys) {
    normalizedRecord[key] = normalize(record[key]);
  }
  return normalizedRecord;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function stableSha256Hex(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}
