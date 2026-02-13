"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planEscalationSla = planEscalationSla;
const SLA_PLANS = {
    recommended: {
        tier: "recommended",
        maxResponseMinutes: 180,
        minReviewerRole: "auditor",
    },
    required: {
        tier: "required",
        maxResponseMinutes: 60,
        minReviewerRole: "controller",
    },
    critical: {
        tier: "critical",
        maxResponseMinutes: 15,
        minReviewerRole: "owner",
    },
};
function planEscalationSla(tier) {
    return SLA_PLANS[tier];
}
//# sourceMappingURL=escalation-sla.js.map