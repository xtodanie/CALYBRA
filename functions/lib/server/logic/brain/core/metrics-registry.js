"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRICS_REGISTRY = void 0;
exports.METRICS_REGISTRY = [
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
];
//# sourceMappingURL=metrics-registry.js.map