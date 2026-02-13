"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_NAMES = exports.MEMORY_NAMESPACES = exports.TRIGGER_SEVERITIES = exports.TRIGGER_SOURCES = exports.TRIGGER_CLASSES = exports.BRAIN_SCHEMA_VERSION = void 0;
exports.validateSkillInput = validateSkillInput;
exports.validateTenantSkillContext = validateTenantSkillContext;
exports.validateSkillOutput = validateSkillOutput;
exports.BRAIN_SCHEMA_VERSION = 1;
exports.TRIGGER_CLASSES = [
    "THRESHOLD_BREACH",
    "INCONSISTENCY",
    "ANOMALY",
    "END_OF_DAY",
    "MANUAL",
];
exports.TRIGGER_SOURCES = ["heartbeat", "manual", "end_of_day"];
exports.TRIGGER_SEVERITIES = ["low", "medium", "high", "critical"];
exports.MEMORY_NAMESPACES = [
    "event-ledger",
    "temporal-graph",
    "behavior-summary",
];
exports.SKILL_NAMES = ["Finance", "Inventory", "POS", "Supplier"];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isIsoLike(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/.test(value);
}
function isOneOf(value, values) {
    return typeof value === "string" && values.includes(value);
}
function validateTriggerEvent(trigger) {
    const errors = [];
    if (!isRecord(trigger)) {
        return ["trigger must be an object"];
    }
    if (trigger.schemaVersion !== exports.BRAIN_SCHEMA_VERSION) {
        errors.push("trigger.schemaVersion must be 1");
    }
    if (!isNonEmptyString(trigger.triggerId)) {
        errors.push("trigger.triggerId is required");
    }
    if (!isOneOf(trigger.triggerClass, exports.TRIGGER_CLASSES)) {
        errors.push("trigger.triggerClass is invalid");
    }
    if (!isOneOf(trigger.source, exports.TRIGGER_SOURCES)) {
        errors.push("trigger.source is invalid");
    }
    if (!isOneOf(trigger.severity, exports.TRIGGER_SEVERITIES)) {
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
function validateSkillInput(input) {
    const errors = [];
    if (!isRecord(input)) {
        return { valid: false, errors: ["input must be an object"] };
    }
    if (input.schemaVersion !== exports.BRAIN_SCHEMA_VERSION) {
        errors.push("schemaVersion must be 1");
    }
    if (!isOneOf(input.skill, exports.SKILL_NAMES)) {
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
function validateTenantSkillContext(context) {
    const errors = [];
    if (!isRecord(context)) {
        return { valid: false, errors: ["context must be an object"] };
    }
    if (context.schemaVersion !== exports.BRAIN_SCHEMA_VERSION) {
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
    }
    else {
        if (!isIsoLike(context.executionWindow.startsAtIso)) {
            errors.push("context.executionWindow.startsAtIso must be an ISO UTC string");
        }
        if (!isIsoLike(context.executionWindow.endsAtIso)) {
            errors.push("context.executionWindow.endsAtIso must be an ISO UTC string");
        }
    }
    return { valid: errors.length === 0, errors };
}
function validateSkillOutput(output) {
    const errors = [];
    if (!isRecord(output)) {
        return { valid: false, errors: ["output must be an object"] };
    }
    if (output.schemaVersion !== exports.BRAIN_SCHEMA_VERSION) {
        errors.push("output.schemaVersion must be 1");
    }
    const envelope = output.envelope;
    if (!isRecord(envelope)) {
        errors.push("output.envelope must be an object");
    }
    else {
        if (envelope.schemaVersion !== exports.BRAIN_SCHEMA_VERSION) {
            errors.push("output.envelope.schemaVersion must be 1");
        }
        if (!isNonEmptyString(envelope.envelopeId)) {
            errors.push("output.envelope.envelopeId is required");
        }
        if (!isNonEmptyString(envelope.tenantId)) {
            errors.push("output.envelope.tenantId is required");
        }
        if (!isOneOf(envelope.skill, exports.SKILL_NAMES)) {
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
    }
    else {
        for (const memoryWrite of output.memoryWrites) {
            if (!isRecord(memoryWrite)) {
                errors.push("memory write must be an object");
                continue;
            }
            if (memoryWrite.schemaVersion !== exports.BRAIN_SCHEMA_VERSION) {
                errors.push("memoryWrite.schemaVersion must be 1");
            }
            if (!isNonEmptyString(memoryWrite.tenantId)) {
                errors.push("memoryWrite.tenantId is required");
            }
            if (!isOneOf(memoryWrite.namespace, exports.MEMORY_NAMESPACES)) {
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
//# sourceMappingURL=contracts.js.map