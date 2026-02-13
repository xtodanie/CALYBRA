"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePhase2Closure = evaluatePhase2Closure;
function evaluatePhase2Closure(input) {
    const blockers = [];
    if (!input.determinismPass)
        blockers.push("determinism gate failed");
    if (!input.integrityPass)
        blockers.push("integrity gate failed");
    if (!input.aclPass)
        blockers.push("acl gate failed");
    if (!input.replayStabilityPass)
        blockers.push("replay stability failed");
    if (!input.emulatorE2ePass)
        blockers.push("emulator e2e failed");
    if (!input.preflightPass)
        blockers.push("preflight failed");
    if (input.unresolvedCriticalDefects > 0)
        blockers.push("unresolved critical defects");
    return {
        closed: blockers.length === 0,
        blockers,
    };
}
//# sourceMappingURL=phase2-closure-evaluator.js.map