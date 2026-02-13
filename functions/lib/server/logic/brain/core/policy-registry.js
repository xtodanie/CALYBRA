"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeterministicPolicyRegistry = void 0;
class DeterministicPolicyRegistry {
    constructor() {
        this.rules = new Map();
    }
    register(rule) {
        this.rules.set(rule.path, rule);
    }
    evaluate(path, confidence) {
        const rule = this.rules.get(path);
        if (!rule) {
            return { allowed: false, reason: "policy path not found" };
        }
        if (!rule.enabled) {
            return { allowed: false, reason: "policy disabled" };
        }
        if (confidence < rule.minConfidence) {
            return { allowed: false, reason: "confidence below threshold" };
        }
        return { allowed: true, reason: "policy accepted" };
    }
    list() {
        return [...this.rules.values()].sort((a, b) => a.path.localeCompare(b.path));
    }
}
exports.DeterministicPolicyRegistry = DeterministicPolicyRegistry;
//# sourceMappingURL=policy-registry.js.map