"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplainabilityPack = buildExplainabilityPack;
const hash_1 = require("./hash");
function buildExplainabilityPack(input) {
    const hash = (0, hash_1.stableSha256Hex)({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        escalationId: input.escalationId,
        policyPath: input.policyPath,
        evidenceRefs: [...input.evidenceRefs].sort((a, b) => a.localeCompare(b)),
        replayHash: input.replayHash,
        healthIndex: input.healthIndex,
        generatedAt: input.generatedAt,
    });
    return Object.assign(Object.assign({ packId: `xpk:${hash.slice(0, 24)}` }, input), { hash });
}
//# sourceMappingURL=explainability-pack.js.map