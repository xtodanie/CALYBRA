"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPatternDetection = runPatternDetection;
const deterministic_1 = require("./deterministic");
const pattern_dsl_1 = require("./pattern-dsl");
const pattern_registry_1 = require("./pattern-registry");
const signal_score_1 = require("./signal-score");
function runPatternDetection(params) {
    var _a, _b, _c, _d, _e, _f;
    const events = [];
    for (const pattern of (0, pattern_registry_1.getPatternRegistry)()) {
        const result = (0, pattern_dsl_1.evaluatePatternDsl)(pattern, params.metrics);
        if (!result.matched)
            continue;
        const latestSeries = (_c = params.metrics[(_b = (_a = pattern.when[0]) === null || _a === void 0 ? void 0 : _a.metric) !== null && _b !== void 0 ? _b : ""]) !== null && _c !== void 0 ? _c : [];
        const latest = (_d = latestSeries[latestSeries.length - 1]) !== null && _d !== void 0 ? _d : 0;
        const threshold = typeof ((_e = pattern.when[0]) === null || _e === void 0 ? void 0 : _e.threshold) === "number" ? (_f = pattern.when[0]) === null || _f === void 0 ? void 0 : _f.threshold : 0;
        const driftDelta = Math.max(0, latest - threshold);
        const confidence = (0, signal_score_1.scoreSignalConfidence)({
            evidenceCount: result.evidenceCount,
            timeWeight: 1,
            driftMagnitude: driftDelta,
            historicalStability: 0.75,
        });
        const payload = {
            tenantId: params.tenantId,
            patternId: pattern.id,
            signal: pattern.thenEmit,
            confidence,
            evidence_count: result.evidenceCount,
            drift_delta: driftDelta,
            timestamp: params.timestamp,
        };
        const hash = (0, deterministic_1.sha256Hex)(payload);
        events.push(Object.assign({ id: (0, deterministic_1.deterministicEventId)({ tenantId: params.tenantId, type: "pattern_detected", timestamp: params.timestamp, hash }), type: "pattern_detected", hash }, payload));
    }
    return events.sort((a, b) => a.id.localeCompare(b.id));
}
//# sourceMappingURL=pattern-runner.js.map