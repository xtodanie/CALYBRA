export type DecisionDomain = "finance" | "ops" | "staff" | "supplier";
export type DecisionRiskLevel = "low" | "medium" | "high" | "critical";

export interface DecisionContract {
  readonly decision_id: string;
  readonly hypothesis: string;
  readonly metric_target: string;
  readonly evaluation_window_days: number;
  readonly expected_delta: number;
  readonly risk_level: DecisionRiskLevel;
  readonly domain: DecisionDomain;
}

export interface DecisionMarkerEvent {
  readonly type: "decision_marker";
  readonly decision: DecisionContract;
  readonly created_at_iso: string;
}

export function validateDecisionContract(value: unknown): value is DecisionContract {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.decision_id === "string" &&
    typeof v.hypothesis === "string" &&
    typeof v.metric_target === "string" &&
    typeof v.evaluation_window_days === "number" &&
    typeof v.expected_delta === "number" &&
    typeof v.risk_level === "string" &&
    typeof v.domain === "string"
  );
}
