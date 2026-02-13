"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeterministicContextWindow = buildDeterministicContextWindow;
function byNewest(left, right) {
    const byTime = right.timestamp.localeCompare(left.timestamp);
    if (byTime !== 0) {
        return byTime;
    }
    return right.id.localeCompare(left.id);
}
function buildDeterministicContextWindow(params) {
    const tenantEvents = params.events
        .filter((event) => event.context.tenantId === params.tenantId)
        .sort(byNewest);
    const selectedEvents = tenantEvents.slice(0, Math.max(0, params.maxEvents));
    const reflectionEventIds = selectedEvents
        .filter((event) => event.type === "brain.reflection")
        .map((event) => event.id);
    const latestSnapshot = [...params.snapshots]
        .filter((snapshot) => snapshot.tenantId === params.tenantId)
        .sort((left, right) => right.atTimestamp.localeCompare(left.atTimestamp))[0];
    return {
        tenantId: params.tenantId,
        eventIds: selectedEvents.map((event) => event.id),
        snapshotId: latestSnapshot === null || latestSnapshot === void 0 ? void 0 : latestSnapshot.snapshotId,
        reflectionEventIds,
    };
}
//# sourceMappingURL=context-builder.js.map