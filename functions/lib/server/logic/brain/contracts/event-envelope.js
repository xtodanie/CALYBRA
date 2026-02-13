"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventEnvelopeSchema = exports.eventContextSchema = exports.eventActorSchema = exports.ISO_UTC_REGEX = void 0;
exports.toEventHashMaterial = toEventHashMaterial;
exports.validateEventEnvelope = validateEventEnvelope;
const zod_1 = require("zod");
exports.ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/;
exports.eventActorSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    actorId: zod_1.z.string().min(1),
    actorType: zod_1.z.enum(["system", "human", "service", "ai"]),
    role: zod_1.z.string().min(1),
});
exports.eventContextSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    traceId: zod_1.z.string().min(1),
    policyPath: zod_1.z.string().min(1),
    readOnly: zod_1.z.boolean(),
});
exports.eventEnvelopeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    type: zod_1.z.string().min(1),
    actor: exports.eventActorSchema,
    context: exports.eventContextSchema,
    payload: zod_1.z.record(zod_1.z.unknown()),
    timestamp: zod_1.z.string().regex(exports.ISO_UTC_REGEX),
    hash: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    parent_id: zod_1.z.string().min(1).optional(),
});
function toEventHashMaterial(event) {
    return {
        id: event.id,
        type: event.type,
        actor: event.actor,
        context: event.context,
        payload: event.payload,
        timestamp: event.timestamp,
        parent_id: event.parent_id,
    };
}
function validateEventEnvelope(value) {
    const parsed = exports.eventEnvelopeSchema.safeParse(value);
    if (parsed.success) {
        return { valid: true, errors: [], event: parsed.data };
    }
    return {
        valid: false,
        errors: parsed.error.errors.map((issue) => `${issue.path.join(".") || "event"}: ${issue.message}`),
    };
}
//# sourceMappingURL=event-envelope.js.map