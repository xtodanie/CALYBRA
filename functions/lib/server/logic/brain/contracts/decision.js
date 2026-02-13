"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDecisionContract = validateDecisionContract;
function validateDecisionContract(value) {
    if (!value || typeof value !== "object")
        return false;
    const v = value;
    return (typeof v.decision_id === "string" &&
        typeof v.hypothesis === "string" &&
        typeof v.metric_target === "string" &&
        typeof v.evaluation_window_days === "number" &&
        typeof v.expected_delta === "number" &&
        typeof v.risk_level === "string" &&
        typeof v.domain === "string");
}
//# sourceMappingURL=decision.js.map