"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignEscalationDeterministic = assignEscalationDeterministic;
const ROLE_ORDER = {
    auditor: 1,
    controller: 2,
    owner: 3,
};
function assignEscalationDeterministic(input) {
    var _a, _b;
    const minRank = (_a = ROLE_ORDER[input.minRole]) !== null && _a !== void 0 ? _a : 99;
    const eligible = [...input.capacities]
        .filter((item) => { var _a; return ((_a = ROLE_ORDER[item.role]) !== null && _a !== void 0 ? _a : 0) >= minRank && item.availableSlots > 0; })
        .sort((a, b) => {
        if (a.availableSlots !== b.availableSlots) {
            return b.availableSlots - a.availableSlots;
        }
        return a.reviewerId.localeCompare(b.reviewerId);
    });
    if (eligible.length === 0) {
        return {
            escalationId: input.escalationId,
            assigned: false,
            reason: "no eligible reviewer capacity",
        };
    }
    return {
        escalationId: input.escalationId,
        reviewerId: (_b = eligible[0]) === null || _b === void 0 ? void 0 : _b.reviewerId,
        assigned: true,
        reason: "assigned deterministically",
    };
}
//# sourceMappingURL=escalation-balancer.js.map