"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCreateSnapshot = shouldCreateSnapshot;
exports.createSnapshot = createSnapshot;
exports.loadLatestSnapshot = loadLatestSnapshot;
exports.retainRecentSnapshots = retainRecentSnapshots;
const hash_1 = require("./hash");
function shouldCreateSnapshot(params) {
    if (params.policy.interval <= 0) {
        return false;
    }
    return params.eventCount > 0 && params.eventCount % params.policy.interval === 0;
}
function createSnapshot(params) {
    const stateHash = (0, hash_1.stableSha256Hex)(params.state);
    const snapshotId = `snap:${(0, hash_1.stableSha256Hex)({
        tenantId: params.tenantId,
        atEventId: params.event.id,
        atTimestamp: params.event.timestamp,
        stateHash,
    }).slice(0, 24)}`;
    return {
        snapshotId,
        tenantId: params.tenantId,
        atEventId: params.event.id,
        atTimestamp: params.event.timestamp,
        fromEventIndex: params.eventIndex,
        state: params.state,
        stateHash,
    };
}
function loadLatestSnapshot(params) {
    const filtered = params.snapshots
        .filter((snapshot) => snapshot.tenantId === params.tenantId)
        .filter((snapshot) => {
        if (!params.beforeOrAtIso) {
            return true;
        }
        return snapshot.atTimestamp.localeCompare(params.beforeOrAtIso) <= 0;
    })
        .sort((left, right) => {
        const byTime = right.atTimestamp.localeCompare(left.atTimestamp);
        if (byTime !== 0) {
            return byTime;
        }
        return right.snapshotId.localeCompare(left.snapshotId);
    });
    return filtered[0];
}
function retainRecentSnapshots(snapshots, maxRetained) {
    if (maxRetained <= 0) {
        return [];
    }
    return [...snapshots]
        .sort((left, right) => right.atTimestamp.localeCompare(left.atTimestamp))
        .slice(0, maxRetained)
        .reverse();
}
//# sourceMappingURL=snapshot.js.map