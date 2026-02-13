import { PatternDsl } from "./pattern-dsl";

export const DEFAULT_PATTERN_REGISTRY: readonly PatternDsl[] = [
  {
    id: "supplier_inflation_alert",
    category: "financial",
    when: [{ metric: "supplier.cost_delta", comparator: ">", threshold: 0.08, overPeriods: 3 }],
    thenEmit: "supplier_inflation_alert",
    minEvidenceCount: 3,
    enabled: true,
  },
  {
    id: "expense_cluster_anomaly",
    category: "operational",
    when: [{ metric: "expense.cluster_score", comparator: ">", threshold: 0.7, overPeriods: 3 }],
    thenEmit: "expense_cluster_anomaly",
    minEvidenceCount: 3,
    enabled: true,
  },
  {
    id: "reconciliation_drift_frequency",
    category: "risk",
    when: [{ metric: "reconciliation.drift_rate", comparator: ">", threshold: 0.12, overPeriods: 3 }],
    thenEmit: "reconciliation_drift_frequency",
    minEvidenceCount: 3,
    enabled: true,
  },
  {
    id: "manual_override_frequency_spike",
    category: "behavioral",
    when: [{ metric: "manual.override_rate", comparator: ">", threshold: 0.2, overPeriods: 3 }],
    thenEmit: "manual_override_frequency_spike",
    minEvidenceCount: 3,
    enabled: true,
  },
] as const;

export function getPatternRegistry(): readonly PatternDsl[] {
  return DEFAULT_PATTERN_REGISTRY;
}
