"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePatternDsl = evaluatePatternDsl;
function evaluateComparator(left, comparator, right) {
    if (typeof left === "boolean" || typeof right === "boolean") {
        return comparator === "=" && left === right;
    }
    if (comparator === ">")
        return left > right;
    if (comparator === ">=")
        return left >= right;
    if (comparator === "<")
        return left < right;
    if (comparator === "<=")
        return left <= right;
    return left === right;
}
function evaluatePatternDsl(dsl, metrics) {
    var _a, _b;
    let evidenceCount = 0;
    for (const condition of dsl.when) {
        const series = (_a = metrics[condition.metric]) !== null && _a !== void 0 ? _a : [];
        const slice = series.slice(Math.max(0, series.length - condition.overPeriods));
        if (slice.length === 0) {
            return { matched: false, evidenceCount };
        }
        const latest = (_b = slice[slice.length - 1]) !== null && _b !== void 0 ? _b : 0;
        const ok = evaluateComparator(latest, condition.comparator, condition.threshold);
        if (!ok) {
            return { matched: false, evidenceCount };
        }
        evidenceCount += slice.length;
    }
    return { matched: evidenceCount >= dsl.minEvidenceCount, evidenceCount };
}
//# sourceMappingURL=pattern-dsl.js.map