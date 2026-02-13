"use strict";
/**
 * Close Friction Index - derived metrics
 * Pure logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCloseFrictionIndex = computeCloseFrictionIndex;
const events_1 = require("../../domain/events");
const rounding_1 = require("../../domain/money/rounding");
function computeCloseFrictionIndex(input) {
    const monthEvents = input.events.filter((event) => event.monthKey === input.monthKey);
    const totalEventCount = monthEvents.length;
    const lateArrivalCutoff = (0, events_1.addDaysToDateKey)(input.periodEnd, input.dayForLateArrival);
    const lateArrivalCount = monthEvents.filter((event) => (0, events_1.dateKeyFromIso)(event.recordedAt) > lateArrivalCutoff).length;
    const adjustments = monthEvents.filter((event) => event.type === "ADJUSTMENT_POSTED");
    const adjustmentsAfterClose = adjustments.filter((event) => (0, events_1.dateKeyFromIso)(event.occurredAt) > input.periodEnd).length;
    const lateArrivalPercent = totalEventCount === 0
        ? 0
        : (0, rounding_1.bankersRound)((lateArrivalCount / totalEventCount) * 100);
    const adjustmentAfterClosePercent = adjustments.length === 0
        ? 0
        : (0, rounding_1.bankersRound)((adjustmentsAfterClose / adjustments.length) * 100);
    const reconciliationHalfLifeDays = computeHalfLifeDays(input.timeline, input.asOfDays);
    const closeFrictionScore = clamp(0, 100, 100 -
        (0, rounding_1.bankersRound)(lateArrivalPercent * 0.5 +
            adjustmentAfterClosePercent * 0.3 +
            reconciliationHalfLifeDays * 2));
    return {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        lateArrivalPercent,
        adjustmentAfterClosePercent,
        reconciliationHalfLifeDays,
        closeFrictionScore,
    };
}
function computeHalfLifeDays(timeline, asOfDays) {
    if (timeline.length === 0)
        return 0;
    const finalEntry = timeline[timeline.length - 1];
    const baseline = timeline[0];
    const initialVariance = calculateVariance(baseline, finalEntry);
    if (initialVariance === 0)
        return 0;
    const threshold = initialVariance * 0.1;
    for (let i = 0; i < timeline.length; i += 1) {
        const entry = timeline[i];
        const variance = calculateVariance(entry, finalEntry);
        if (variance <= threshold) {
            if (entry.asOfDay === null) {
                return asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
            }
            return entry.asOfDay;
        }
    }
    return asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
}
function calculateVariance(entry, finalEntry) {
    return (Math.abs(entry.revenueCents - finalEntry.revenueCents) +
        Math.abs(entry.expenseCents - finalEntry.expenseCents) +
        Math.abs(entry.vatCents - finalEntry.vatCents) +
        Math.abs(entry.unmatchedTotalCount - finalEntry.unmatchedTotalCount));
}
function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
}
//# sourceMappingURL=closeFrictionIndex.js.map