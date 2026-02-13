"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPolicySimulation = runPolicySimulation;
function runPolicySimulation(registry, cases) {
    return [...cases]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((item) => {
        const decision = registry.evaluate(item.path, item.confidence);
        return {
            label: item.label,
            allowed: decision.allowed,
            reason: decision.reason,
        };
    });
}
//# sourceMappingURL=policy-simulation.js.map