export interface EscalationContext {
  readonly decisionHistory: readonly string[];
  readonly patternChain: readonly string[];
  readonly riskSummary: {
    readonly compositeRisk: number;
    readonly financialExposure: number;
  };
  readonly expectationDelta: {
    readonly expected: number;
    readonly actual: number;
  };
}

export function buildEscalationContext(input: EscalationContext): EscalationContext {
  return {
    decisionHistory: [...input.decisionHistory],
    patternChain: [...input.patternChain],
    riskSummary: { ...input.riskSummary },
    expectationDelta: { ...input.expectationDelta },
  };
}
