import { deterministicEventId, sha256Hex } from "./deterministic";
import { evaluatePatternDsl, ReplayMetricSeries } from "./pattern-dsl";
import { getPatternRegistry } from "./pattern-registry";
import { scoreSignalConfidence } from "./signal-score";

export type PatternEventType = "pattern_detected" | "pattern_resolved" | "pattern_escalated";

export interface PatternEvent {
  readonly id: string;
  readonly type: PatternEventType;
  readonly tenantId: string;
  readonly patternId: string;
  readonly signal: string;
  readonly confidence: number;
  readonly evidence_count: number;
  readonly drift_delta: number;
  readonly timestamp: string;
  readonly hash: string;
}

export function runPatternDetection(params: {
  tenantId: string;
  metrics: ReplayMetricSeries;
  timestamp: string;
}): readonly PatternEvent[] {
  const events: PatternEvent[] = [];
  for (const pattern of getPatternRegistry()) {
    const result = evaluatePatternDsl(pattern, params.metrics);
    if (!result.matched) continue;
    const latestSeries = params.metrics[pattern.when[0]?.metric ?? ""] ?? [];
    const latest = latestSeries[latestSeries.length - 1] ?? 0;
    const threshold = typeof pattern.when[0]?.threshold === "number" ? (pattern.when[0]?.threshold as number) : 0;
    const driftDelta = Math.max(0, latest - threshold);
    const confidence = scoreSignalConfidence({
      evidenceCount: result.evidenceCount,
      timeWeight: 1,
      driftMagnitude: driftDelta,
      historicalStability: 0.75,
    });
    const payload = {
      tenantId: params.tenantId,
      patternId: pattern.id,
      signal: pattern.thenEmit,
      confidence,
      evidence_count: result.evidenceCount,
      drift_delta: driftDelta,
      timestamp: params.timestamp,
    };
    const hash = sha256Hex(payload);
    events.push({
      id: deterministicEventId({ tenantId: params.tenantId, type: "pattern_detected", timestamp: params.timestamp, hash }),
      type: "pattern_detected",
      hash,
      ...payload,
    });
  }
  return events.sort((a, b) => a.id.localeCompare(b.id));
}
