import { AutonomyState } from "./autonomy-state";

export interface CircuitBreakerInput {
  readonly autonomy: AutonomyState;
  readonly healthIndex: number;
  readonly riskExposure: number;
  readonly escalationCritical: boolean;
}

export interface CircuitBreakerOutcome {
  readonly tripped: boolean;
  readonly forcedAutonomy: AutonomyState;
  readonly reason: string;
}

export function evaluateAutonomyCircuitBreaker(input: CircuitBreakerInput): CircuitBreakerOutcome {
  if (input.escalationCritical || input.healthIndex < 0.35 || input.riskExposure > 0.8) {
    return {
      tripped: true,
      forcedAutonomy: "Locked",
      reason: "critical risk containment",
    };
  }

  if (input.healthIndex < 0.55 || input.riskExposure > 0.6) {
    return {
      tripped: true,
      forcedAutonomy: "Restricted",
      reason: "degraded health containment",
    };
  }

  return {
    tripped: false,
    forcedAutonomy: input.autonomy,
    reason: "circuit nominal",
  };
}
