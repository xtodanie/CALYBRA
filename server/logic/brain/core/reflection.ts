import { CanonicalEventEnvelope, toEventHashMaterial } from "../contracts/event-envelope";
import { stableSha256Hex } from "./hash";

export interface ReflectionInput {
  readonly tenantId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly policyPath: string;
  readonly timestamp: string;
  readonly indicators: {
    readonly anomalyRate: number;
    readonly efficiencyDelta: number;
    readonly behaviorShift: number;
  };
}

export function buildReflectionEvent(input: ReflectionInput): CanonicalEventEnvelope {
  const severity = input.indicators.anomalyRate >= 0.5 || input.indicators.behaviorShift >= 0.5
    ? "high"
    : input.indicators.anomalyRate >= 0.2 || input.indicators.behaviorShift >= 0.2
      ? "medium"
      : "low";

  const material = {
    id: `reflection:${stableSha256Hex({
      tenantId: input.tenantId,
      traceId: input.traceId,
      actorId: input.actorId,
      timestamp: input.timestamp,
    }).slice(0, 24)}`,
    type: "brain.reflection",
    actor: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: "service",
      role: "brain-reflection",
    } as const,
    context: {
      tenantId: input.tenantId,
      traceId: input.traceId,
      policyPath: input.policyPath,
      readOnly: true,
    } as const,
    payload: {
      severity,
      anomalyRate: input.indicators.anomalyRate,
      efficiencyDelta: input.indicators.efficiencyDelta,
      behaviorShift: input.indicators.behaviorShift,
      emittedAsExplicitEvent: true,
    },
    timestamp: input.timestamp,
    parent_id: undefined,
  };

  return {
    ...material,
    hash: stableSha256Hex(toEventHashMaterial(material)),
  };
}
