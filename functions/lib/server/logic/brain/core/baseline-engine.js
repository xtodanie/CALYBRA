"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaselineSnapshot = createBaselineSnapshot;
const deterministic_1 = require("./deterministic");
function createBaselineSnapshot(params) {
    const values = Object.freeze(Object.assign({}, params.values));
    const hash = (0, deterministic_1.sha256Hex)({
        baselineId: params.baselineId,
        tenantId: params.tenantId,
        domain: params.domain,
        values,
        capturedAt: params.capturedAt,
    });
    return Object.freeze({
        baselineId: params.baselineId,
        tenantId: params.tenantId,
        domain: params.domain,
        values,
        capturedAt: params.capturedAt,
        hash,
    });
}
//# sourceMappingURL=baseline-engine.js.map