"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAIAuditRecord = buildAIAuditRecord;
const hash_1 = require("./hash");
function buildAIAuditRecord(params) {
    const tokenTotal = params.tokenUsage.input + params.tokenUsage.output;
    const promptHash = (0, hash_1.stableSha256Hex)(params.prompt);
    const contextHash = (0, hash_1.stableSha256Hex)(params.context);
    const responseHash = (0, hash_1.stableSha256Hex)(params.response);
    const auditId = `audit:${(0, hash_1.stableSha256Hex)({
        tenantId: params.tenantId,
        traceId: params.traceId,
        promptHash,
        contextHash,
        responseHash,
        atIso: params.atIso,
    }).slice(0, 24)}`;
    return {
        auditId,
        tenantId: params.tenantId,
        traceId: params.traceId,
        promptHash,
        contextHash,
        tokenUsage: {
            input: params.tokenUsage.input,
            output: params.tokenUsage.output,
            total: tokenTotal,
        },
        model: params.response.model,
        responseHash,
        decisionMap: params.decisionMap,
        atIso: params.atIso,
    };
}
//# sourceMappingURL=ai-audit.js.map