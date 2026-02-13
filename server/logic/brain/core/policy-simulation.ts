import { DeterministicPolicyRegistry } from "./policy-registry";

export interface PolicySimulationCase {
  readonly path: string;
  readonly confidence: number;
  readonly label: string;
}

export interface PolicySimulationResult {
  readonly label: string;
  readonly allowed: boolean;
  readonly reason: string;
}

export function runPolicySimulation(
  registry: DeterministicPolicyRegistry,
  cases: readonly PolicySimulationCase[],
): readonly PolicySimulationResult[] {
  return [...cases]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => {
      const decision = registry.evaluate(item.path, item.confidence);
      return {
        label: item.label,
        allowed: decision.allowed,
        reason: decision.reason,
      };
    });
}
