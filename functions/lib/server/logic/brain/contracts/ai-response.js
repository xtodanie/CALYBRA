"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiResponseSchema = exports.aiSuggestionSchema = void 0;
exports.validateAIIsolationBoundary = validateAIIsolationBoundary;
const zod_1 = require("zod");
exports.aiSuggestionSchema = zod_1.z.object({
    suggestionId: zod_1.z.string().min(1),
    code: zod_1.z.string().min(1),
    summary: zod_1.z.string().min(1),
    confidence: zod_1.z.number().min(0).max(1),
    evidenceRefs: zod_1.z.array(zod_1.z.string().min(1)).default([]),
});
exports.aiResponseSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    contextHash: zod_1.z.string().min(1),
    model: zod_1.z.string().min(1),
    generatedAt: zod_1.z.string().min(1),
    suggestions: zod_1.z.array(exports.aiSuggestionSchema),
    mutationIntent: zod_1.z.literal("none"),
    allowedActions: zod_1.z.array(zod_1.z.enum(["suggest", "explain", "escalate"]))
        .default(["suggest", "explain", "escalate"]),
});
function validateAIIsolationBoundary(input) {
    const parsed = exports.aiResponseSchema.safeParse(input);
    if (!parsed.success) {
        return {
            accepted: false,
            reasons: parsed.error.errors.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`),
        };
    }
    if (parsed.data.mutationIntent !== "none") {
        return { accepted: false, reasons: ["mutationIntent must be none"] };
    }
    return { accepted: true, reasons: [] };
}
//# sourceMappingURL=ai-response.js.map