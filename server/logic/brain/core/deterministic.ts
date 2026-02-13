import crypto from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = sortValue(record[key]);
  }
  return sorted;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256Hex(value: unknown): string {
  const normalized = stableStringify(value);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function deterministicEventId(params: {
  tenantId: string;
  type: string;
  timestamp: string;
  hash: string;
}): string {
  const raw = `${params.tenantId}:${params.type}:${params.timestamp}:${params.hash}`;
  return `evt:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}
