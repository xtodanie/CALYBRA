import { CanonicalEventEnvelope } from "../contracts/event-envelope";
import { BrainSnapshot } from "./snapshot";

export interface ContextWindow {
  readonly tenantId: string;
  readonly eventIds: readonly string[];
  readonly snapshotId?: string;
  readonly reflectionEventIds: readonly string[];
}

function byNewest(left: CanonicalEventEnvelope, right: CanonicalEventEnvelope): number {
  const byTime = right.timestamp.localeCompare(left.timestamp);
  if (byTime !== 0) {
    return byTime;
  }
  return right.id.localeCompare(left.id);
}

export function buildDeterministicContextWindow(params: {
  readonly tenantId: string;
  readonly events: readonly CanonicalEventEnvelope[];
  readonly snapshots: readonly BrainSnapshot[];
  readonly maxEvents: number;
}): ContextWindow {
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
    snapshotId: latestSnapshot?.snapshotId,
    reflectionEventIds,
  };
}
