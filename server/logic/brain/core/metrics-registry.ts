export type ImprovementDomain = "finance" | "ops" | "staff" | "supplier";

export interface ImprovementMetric {
  readonly metric_id: string;
  readonly domain: ImprovementDomain;
  readonly formula: string;
  readonly measurement_frequency: "daily" | "weekly" | "monthly";
  readonly baseline_window: number;
  readonly evaluation_window: number;
}

export const METRICS_REGISTRY: readonly ImprovementMetric[] = [
  {
    metric_id: "cost_variance_pct",
    domain: "finance",
    formula: "(actual_cost - baseline_cost) / baseline_cost",
    measurement_frequency: "monthly",
    baseline_window: 90,
    evaluation_window: 30,
  },
  {
    metric_id: "reconciliation_time_reduction",
    domain: "ops",
    formula: "(baseline_minutes - current_minutes) / baseline_minutes",
    measurement_frequency: "weekly",
    baseline_window: 28,
    evaluation_window: 14,
  },
  {
    metric_id: "supplier_inflation_delta",
    domain: "supplier",
    formula: "(current_price - baseline_price) / baseline_price",
    measurement_frequency: "monthly",
    baseline_window: 90,
    evaluation_window: 30,
  },
  {
    metric_id: "manual_override_frequency",
    domain: "ops",
    formula: "manual_overrides / decision_count",
    measurement_frequency: "weekly",
    baseline_window: 28,
    evaluation_window: 14,
  },
] as const;
