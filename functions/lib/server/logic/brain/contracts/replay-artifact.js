"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brainArtifactSchema = exports.brainArtifactTypeSchema = void 0;
exports.validateBrainReplayArtifact = validateBrainReplayArtifact;
const zod_1 = require("zod");
exports.brainArtifactTypeSchema = zod_1.z.enum([
    "decision",
    "escalation",
    "health",
    "context_window",
    "snapshot",
    "gate_audit",
    "event_log",
]);
exports.brainArtifactSchema = zod_1.z.object({
    artifactId: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().min(1),
    monthKey: zod_1.z.string().min(1),
    type: exports.brainArtifactTypeSchema,
    generatedAt: zod_1.z.string().min(1),
    hash: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    schemaVersion: zod_1.z.literal(1),
    payload: zod_1.z.record(zod_1.z.unknown()),
});
function validateBrainReplayArtifact(input) {
    const parsed = exports.brainArtifactSchema.safeParse(input);
    if (parsed.success) {
        return { valid: true, errors: [], artifact: parsed.data };
    }
    return {
        valid: false,
        errors: parsed.error.errors.map((issue) => `${issue.path.join(".") || "artifact"}: ${issue.message}`),
    };
}
//# sourceMappingURL=replay-artifact.js.map