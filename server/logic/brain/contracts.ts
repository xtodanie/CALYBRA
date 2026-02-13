export const BRAIN_SCHEMA_VERSION = 1 as const;

export const TRIGGER_CLASSES = [
  "THRESHOLD_BREACH",
  "INCONSISTENCY",
  "ANOMALY",
  "END_OF_DAY",
  "MANUAL",
] as const;

export const TRIGGER_SOURCES = ["heartbeat", "manual", "end_of_day"] as const;

export const TRIGGER_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const MEMORY_NAMESPACES = [
  "event-ledger",
  "temporal-graph",
  "behavior-summary",
] as const;

export const SKILL_NAMES = ["Finance", "Inventory", "POS", "Supplier"] as const;

export type TriggerClass = (typeof TRIGGER_CLASSES)[number];
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];
export type TriggerSeverity = (typeof TRIGGER_SEVERITIES)[number];
export type MemoryNamespace = (typeof MEMORY_NAMESPACES)[number];
export type SkillName = (typeof SKILL_NAMES)[number];

export interface TriggerEvent {
  readonly schemaVersion: typeof BRAIN_SCHEMA_VERSION;
  readonly triggerId: string;
  readonly triggerClass: TriggerClass;
  readonly source: TriggerSource;
  readonly severity: TriggerSeverity;
  readonly occurredAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface SkillInput {
  readonly schemaVersion: typeof BRAIN_SCHEMA_VERSION;
  readonly skill: SkillName;
  readonly contextHash: string;
  readonly trigger: TriggerEvent;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface TenantSkillContext {
  readonly schemaVersion: typeof BRAIN_SCHEMA_VERSION;
  readonly tenantId: string;
  readonly actorId: string;
  readonly readOnly: true;
  readonly policyPath: string;
  readonly executionWindow: {
    readonly startsAtIso: string;
    readonly endsAtIso: string;
  };
}

export interface DecisionItem {
  readonly code: string;
  readonly summary: string;
  readonly confidence: number;
  readonly policyPath: string;
  readonly evidenceRefs: readonly string[];
}

export interface DecisionEnvelope {
  readonly schemaVersion: typeof BRAIN_SCHEMA_VERSION;
  readonly envelopeId: string;
  readonly tenantId: string;
  readonly skill: SkillName;
  readonly contextHash: string;
  readonly deterministicFallbackUsed: boolean;
  readonly modelVersion?: string;
  readonly decisions: readonly DecisionItem[];
}

export interface MemoryWrite {
  readonly schemaVersion: typeof BRAIN_SCHEMA_VERSION;
  readonly tenantId: string;
  readonly namespace: MemoryNamespace;
  readonly entityId: string;
  readonly value: string;
  readonly relation?: string;
  readonly contextHash: string;
  readonly evidenceRefs: readonly string[];
  readonly atIso: string;
}

export interface SkillOutput {
  readonly schemaVersion: typeof BRAIN_SCHEMA_VERSION;
  readonly envelope: DecisionEnvelope;
  readonly memoryWrites: readonly MemoryWrite[];
}

export interface BrainValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoLike(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/.test(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function validateTriggerEvent(trigger: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(trigger)) {
    return ["trigger must be an object"];
  }
  if (trigger.schemaVersion !== BRAIN_SCHEMA_VERSION) {
    errors.push("trigger.schemaVersion must be 1");
  }
  if (!isNonEmptyString(trigger.triggerId)) {
    errors.push("trigger.triggerId is required");
  }
  if (!isOneOf(trigger.triggerClass, TRIGGER_CLASSES)) {
    errors.push("trigger.triggerClass is invalid");
  }
  if (!isOneOf(trigger.source, TRIGGER_SOURCES)) {
    errors.push("trigger.source is invalid");
  }
  if (!isOneOf(trigger.severity, TRIGGER_SEVERITIES)) {
    errors.push("trigger.severity is invalid");
  }
  if (!isIsoLike(trigger.occurredAt)) {
    errors.push("trigger.occurredAt must be an ISO UTC string");
  }
  if (!Array.isArray(trigger.evidenceRefs)) {
    errors.push("trigger.evidenceRefs must be an array");
  }
  return errors;
}

export function validateSkillInput(input: unknown): BrainValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ["input must be an object"] };
  }
  if (input.schemaVersion !== BRAIN_SCHEMA_VERSION) {
    errors.push("schemaVersion must be 1");
  }
  if (!isOneOf(input.skill, SKILL_NAMES)) {
    errors.push("skill is invalid");
  }
  if (!isNonEmptyString(input.contextHash)) {
    errors.push("contextHash is required");
  }
  errors.push(...validateTriggerEvent(input.trigger));
  if (!isRecord(input.payload)) {
    errors.push("payload must be an object");
  }
  return { valid: errors.length === 0, errors };
}

export function validateTenantSkillContext(context: unknown): BrainValidationResult {
  const errors: string[] = [];
  if (!isRecord(context)) {
    return { valid: false, errors: ["context must be an object"] };
  }
  if (context.schemaVersion !== BRAIN_SCHEMA_VERSION) {
    errors.push("context.schemaVersion must be 1");
  }
  if (!isNonEmptyString(context.tenantId)) {
    errors.push("context.tenantId is required");
  }
  if (!isNonEmptyString(context.actorId)) {
    errors.push("context.actorId is required");
  }
  if (context.readOnly !== true) {
    errors.push("context.readOnly must be true");
  }
  if (!isNonEmptyString(context.policyPath)) {
    errors.push("context.policyPath is required");
  }
  if (!isRecord(context.executionWindow)) {
    errors.push("context.executionWindow must be an object");
  } else {
    if (!isIsoLike(context.executionWindow.startsAtIso)) {
      errors.push("context.executionWindow.startsAtIso must be an ISO UTC string");
    }
    if (!isIsoLike(context.executionWindow.endsAtIso)) {
      errors.push("context.executionWindow.endsAtIso must be an ISO UTC string");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateSkillOutput(output: unknown): BrainValidationResult {
  const errors: string[] = [];
  if (!isRecord(output)) {
    return { valid: false, errors: ["output must be an object"] };
  }
  if (output.schemaVersion !== BRAIN_SCHEMA_VERSION) {
    errors.push("output.schemaVersion must be 1");
  }

  const envelope = output.envelope;
  if (!isRecord(envelope)) {
    errors.push("output.envelope must be an object");
  } else {
    if (envelope.schemaVersion !== BRAIN_SCHEMA_VERSION) {
      errors.push("output.envelope.schemaVersion must be 1");
    }
    if (!isNonEmptyString(envelope.envelopeId)) {
      errors.push("output.envelope.envelopeId is required");
    }
    if (!isNonEmptyString(envelope.tenantId)) {
      errors.push("output.envelope.tenantId is required");
    }
    if (!isOneOf(envelope.skill, SKILL_NAMES)) {
      errors.push("output.envelope.skill is invalid");
    }
    if (!isNonEmptyString(envelope.contextHash)) {
      errors.push("output.envelope.contextHash is required");
    }
    if (typeof envelope.deterministicFallbackUsed !== "boolean") {
      errors.push("output.envelope.deterministicFallbackUsed must be boolean");
    }
    if (!Array.isArray(envelope.decisions)) {
      errors.push("output.envelope.decisions must be an array");
    }
  }

  if (!Array.isArray(output.memoryWrites)) {
    errors.push("output.memoryWrites must be an array");
  } else {
    for (const memoryWrite of output.memoryWrites) {
      if (!isRecord(memoryWrite)) {
        errors.push("memory write must be an object");
        continue;
      }
      if (memoryWrite.schemaVersion !== BRAIN_SCHEMA_VERSION) {
        errors.push("memoryWrite.schemaVersion must be 1");
      }
      if (!isNonEmptyString(memoryWrite.tenantId)) {
        errors.push("memoryWrite.tenantId is required");
      }
      if (!isOneOf(memoryWrite.namespace, MEMORY_NAMESPACES)) {
        errors.push("memoryWrite.namespace is invalid");
      }
      if (!isNonEmptyString(memoryWrite.entityId)) {
        errors.push("memoryWrite.entityId is required");
      }
      if (!isNonEmptyString(memoryWrite.value)) {
        errors.push("memoryWrite.value is required");
      }
      if (!isNonEmptyString(memoryWrite.contextHash)) {
        errors.push("memoryWrite.contextHash is required");
      }
      if (!Array.isArray(memoryWrite.evidenceRefs)) {
        errors.push("memoryWrite.evidenceRefs must be an array");
      }
      if (!isIsoLike(memoryWrite.atIso)) {
        errors.push("memoryWrite.atIso must be an ISO UTC string");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
