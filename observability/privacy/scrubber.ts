/**
 * Privacy-first scrubbing for telemetry
 *
 * INVARIANT: Scrub before export/logging
 * INVARIANT: Never block execution
 * INVARIANT: Configurable for strictness
 */

export interface ScrubRule {
  keyPattern: RegExp;
  replaceWith: string;
  strict?: boolean; // When true, drop the field entirely
}

export interface ScrubConfig {
  rules: ScrubRule[];
  maxStringLength?: number;
  allowlistKeys?: string[];
}

const DEFAULT_RULES: ScrubRule[] = [
  // Emails
  { keyPattern: /email|e-mail|mail/i, replaceWith: "[REDACTED_EMAIL]" },
  { keyPattern: /@/i, replaceWith: "[REDACTED_EMAIL]", strict: true },

  // Phone numbers
  { keyPattern: /phone|mobile|tel/i, replaceWith: "[REDACTED_PHONE]" },

  // Bank/account numbers
  { keyPattern: /account|iban|routing|swift|bic/i, replaceWith: "[REDACTED_ACCOUNT]" },

  // Government IDs
  { keyPattern: /ssn|social|tax|ein|nid/i, replaceWith: "[REDACTED_GOV_ID]" },

  // Access tokens / secrets
  { keyPattern: /token|secret|password|api_key|apikey/i, replaceWith: "[REDACTED_SECRET]" },
];

const DEFAULT_CONFIG: ScrubConfig = {
  rules: DEFAULT_RULES,
  maxStringLength: 500,
};

/**
 * Scrub a value recursively
 */
export function scrubValue(value: unknown, config: ScrubConfig = DEFAULT_CONFIG): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    const truncated = config.maxStringLength && value.length > config.maxStringLength
      ? value.slice(0, config.maxStringLength) + "..."
      : value;
    return truncated;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, config));
  }

  if (typeof value === "object") {
    return scrubObject(value as Record<string, unknown>, config);
  }

  return String(value);
}

/**
 * Scrub object fields based on key patterns
 */
export function scrubObject(
  obj: Record<string, unknown>,
  config: ScrubConfig = DEFAULT_CONFIG
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (config.allowlistKeys && !config.allowlistKeys.includes(key)) {
      // If allowlist is provided, only keep listed keys
      continue;
    }

    const rule = config.rules.find((r) => r.keyPattern.test(key) || (typeof value === "string" && r.keyPattern.test(value)));

    if (rule) {
      if (rule.strict) {
        continue; // Drop entirely
      }
      result[key] = rule.replaceWith;
      continue;
    }

    result[key] = scrubValue(value, config);
  }

  return result;
}

/**
 * Scrub log payload
 */
export function scrubLogPayload(
  payload: Record<string, unknown>,
  config: ScrubConfig = DEFAULT_CONFIG
): Record<string, unknown> {
  return scrubObject(payload, config);
}

/**
 * Scrub error details
 */
export function scrubErrorDetails(
  error: { message?: string; stack?: string },
  config: ScrubConfig = DEFAULT_CONFIG
): { message?: string; stack?: string } {
  return {
    message: error.message ? String(scrubValue(error.message, config)) : undefined,
    stack: error.stack ? String(scrubValue(error.stack, config)) : undefined,
  };
}
