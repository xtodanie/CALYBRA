"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNormalizedDelta = computeNormalizedDelta;
function computeNormalizedDelta(params) {
    var _a;
    if (params.baseline === 0) {
        return { actualDelta: 0, normalizedDelta: 0, expectedDelta: params.expectedDelta };
    }
    const actualDelta = (params.current - params.baseline) / params.baseline;
    const seasonality = (_a = params.seasonalityFactor) !== null && _a !== void 0 ? _a : 1;
    const normalizedDelta = actualDelta / (seasonality === 0 ? 1 : seasonality);
    return {
        actualDelta: Number(actualDelta.toFixed(6)),
        normalizedDelta: Number(normalizedDelta.toFixed(6)),
        expectedDelta: params.expectedDelta,
    };
}
//# sourceMappingURL=delta-engine.js.map