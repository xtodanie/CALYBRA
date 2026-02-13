export interface PolicyRule {
  readonly id: string;
  readonly path: string;
  readonly enabled: boolean;
  readonly minConfidence: number;
}

export interface PolicyEvaluationResult {
  readonly allowed: boolean;
  readonly reason: string;
}

export class DeterministicPolicyRegistry {
  private readonly rules = new Map<string, PolicyRule>();

  register(rule: PolicyRule): void {
    this.rules.set(rule.path, rule);
  }

  evaluate(path: string, confidence: number): PolicyEvaluationResult {
    const rule = this.rules.get(path);
    if (!rule) {
      return { allowed: false, reason: "policy path not found" };
    }
    if (!rule.enabled) {
      return { allowed: false, reason: "policy disabled" };
    }
    if (confidence < rule.minConfidence) {
      return { allowed: false, reason: "confidence below threshold" };
    }
    return { allowed: true, reason: "policy accepted" };
  }

  list(): readonly PolicyRule[] {
    return [...this.rules.values()].sort((a, b) => a.path.localeCompare(b.path));
  }
}
