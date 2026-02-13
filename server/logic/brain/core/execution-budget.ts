export interface ExecutionBudgetEnvelope {
  readonly maxTokens: number;
  readonly maxDurationMs: number;
  readonly maxCostMicros: number;
}

export interface ExecutionUsage {
  readonly tokensUsed: number;
  readonly durationMs: number;
  readonly costMicros: number;
}

export interface ExecutionBudgetOutcome {
  readonly allowed: boolean;
  readonly circuitBroken: boolean;
  readonly fallbackAction: "RULE_ONLY_FALLBACK";
  readonly reasonCodes: readonly (
    | "BUDGET_TOKEN_EXCEEDED"
    | "BUDGET_DURATION_EXCEEDED"
    | "BUDGET_COST_EXCEEDED"
  )[];
}

export function evaluateExecutionBudget(
  budget: ExecutionBudgetEnvelope,
  usage: ExecutionUsage
): ExecutionBudgetOutcome {
  const reasonCodes: Array<
    "BUDGET_TOKEN_EXCEEDED" | "BUDGET_DURATION_EXCEEDED" | "BUDGET_COST_EXCEEDED"
  > = [];

  if (usage.tokensUsed > budget.maxTokens) {
    reasonCodes.push("BUDGET_TOKEN_EXCEEDED");
  }
  if (usage.durationMs > budget.maxDurationMs) {
    reasonCodes.push("BUDGET_DURATION_EXCEEDED");
  }
  if (usage.costMicros > budget.maxCostMicros) {
    reasonCodes.push("BUDGET_COST_EXCEEDED");
  }

  return {
    allowed: reasonCodes.length === 0,
    circuitBroken: reasonCodes.length > 0,
    fallbackAction: "RULE_ONLY_FALLBACK",
    reasonCodes,
  };
}
