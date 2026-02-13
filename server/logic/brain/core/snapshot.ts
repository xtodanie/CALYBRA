import { CanonicalEventEnvelope } from "../contracts/event-envelope";
import { stableSha256Hex } from "./hash";

export interface SnapshotPolicy {
  readonly interval: number;
  readonly maxRetained: number;
}

export interface BrainSnapshot<TState = unknown> {
  readonly snapshotId: string;
  readonly tenantId: string;
  readonly atEventId: string;
  readonly atTimestamp: string;
  readonly fromEventIndex: number;
  readonly state: TState;
  readonly stateHash: string;
}

export function shouldCreateSnapshot(params: {
  readonly eventCount: number;
  readonly policy: SnapshotPolicy;
}): boolean {
  if (params.policy.interval <= 0) {
    return false;
  }
  return params.eventCount > 0 && params.eventCount % params.policy.interval === 0;
}

export function createSnapshot<TState>(params: {
  readonly tenantId: string;
  readonly event: CanonicalEventEnvelope;
  readonly eventIndex: number;
  readonly state: TState;
}): BrainSnapshot<TState> {
  const stateHash = stableSha256Hex(params.state);
  const snapshotId = `snap:${stableSha256Hex({
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

export function loadLatestSnapshot<TState>(params: {
  readonly snapshots: readonly BrainSnapshot<TState>[];
  readonly tenantId: string;
  readonly beforeOrAtIso?: string;
}): BrainSnapshot<TState> | undefined {
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

export function retainRecentSnapshots<TState>(
  snapshots: readonly BrainSnapshot<TState>[],
  maxRetained: number,
): readonly BrainSnapshot<TState>[] {
  if (maxRetained <= 0) {
    return [];
  }
  return [...snapshots]
    .sort((left, right) => right.atTimestamp.localeCompare(left.atTimestamp))
    .slice(0, maxRetained)
    .reverse();
}
