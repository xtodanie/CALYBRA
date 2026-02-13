"use strict";
/**
 * Close Friction - read model
 * Pure projection logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCloseFrictionReadModel = buildCloseFrictionReadModel;
function buildCloseFrictionReadModel(input) {
    return Object.assign(Object.assign({}, input.result), { periodEnd: input.periodEnd, dayForLateArrival: input.dayForLateArrival, generatedAt: input.generatedAt, periodLockHash: input.periodLockHash, schemaVersion: 1 });
}
//# sourceMappingURL=closeFriction.js.map