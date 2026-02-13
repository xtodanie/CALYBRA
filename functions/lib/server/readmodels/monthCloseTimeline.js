"use strict";
/**
 * Month Close Timeline - read model
 * Pure projection logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMonthCloseTimelineReadModel = buildMonthCloseTimelineReadModel;
function buildMonthCloseTimelineReadModel(input) {
    return {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        periodEnd: input.periodEnd,
        asOfDays: [...input.asOfDays],
        entries: [...input.entries],
        insights: [...input.insights],
        generatedAt: input.generatedAt,
        periodLockHash: input.periodLockHash,
        schemaVersion: 1,
    };
}
//# sourceMappingURL=monthCloseTimeline.js.map