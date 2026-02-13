export interface PolicyShadowDecisionInput {
  readonly enabled: boolean;
  readonly enforcedAllowed: boolean;
  readonly candidateAllowed: boolean;
}

export interface PolicyShadowDecisionOutcome {
  readonly enabled: boolean;
  readonly disagreement: boolean;
  readonly classification: "nominal" | "false_block_risk" | "false_allow_risk";
}

export interface PolicyShadowSummary {
  readonly sampleCount: number;
  readonly disagreementCount: number;
  readonly falseBlockRiskCount: number;
  readonly falseAllowRiskCount: number;
  readonly falseBlockRiskRate: number;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

export function evaluatePolicyShadowDecision(
  input: PolicyShadowDecisionInput
): PolicyShadowDecisionOutcome {
  if (!input.enabled) {
    return {
      enabled: false,
      disagreement: false,
      classification: "nominal",
    };
  }

  if (input.enforcedAllowed && !input.candidateAllowed) {
    return {
      enabled: true,
      disagreement: true,
      classification: "false_block_risk",
    };
  }

  if (!input.enforcedAllowed && input.candidateAllowed) {
    return {
      enabled: true,
      disagreement: true,
      classification: "false_allow_risk",
    };
  }

  return {
    enabled: true,
    disagreement: false,
    classification: "nominal",
  };
}

export function summarizePolicyShadow(
  outcomes: readonly PolicyShadowDecisionOutcome[]
): PolicyShadowSummary {
  const enabledOutcomes = outcomes.filter((outcome) => outcome.enabled);
  const sampleCount = enabledOutcomes.length;
  const disagreementCount = enabledOutcomes.filter((outcome) => outcome.disagreement).length;
  const falseBlockRiskCount = enabledOutcomes.filter(
    (outcome) => outcome.classification === "false_block_risk"
  ).length;
  const falseAllowRiskCount = enabledOutcomes.filter(
    (outcome) => outcome.classification === "false_allow_risk"
  ).length;
  const denominator = Math.max(1, sampleCount);

  return {
    sampleCount,
    disagreementCount,
    falseBlockRiskCount,
    falseAllowRiskCount,
    falseBlockRiskRate: round4(falseBlockRiskCount / denominator),
  };
}
