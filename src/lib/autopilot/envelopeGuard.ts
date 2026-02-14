/**
 * ZEREBROX CALYBRA OS - Envelope Guard
 * 
 * Purpose: Prevents financial and operational overreach.
 * Stateless per action but cumulative-aware with configurable limits.
 */

export interface EnvelopePolicy {
  financial: {
    maxPerDecision: number; // Maximum amount per single decision
    maxCumulative: number; // Maximum cumulative exposure
    maxDailyExposure: number; // Maximum exposure per day
  };
  scope: {
    maxSuppliersPerAction: number;
    maxMonthsPerAction: number;
    requireManualApprovalAbove: number; // Amount threshold for manual approval
  };
  confidence: {
    minimumThreshold: number; // 0-100
    requireHighConfidenceAbove: number; // Amount threshold requiring high confidence
    highConfidenceThreshold: number; // What counts as "high confidence"
  };
  risk: {
    maxLowRiskCumulative: number;
    maxMediumRiskCumulative: number;
    maxHighRiskSingle: number;
  };
}

export enum RiskTier {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface ActionRequest {
  actionId: string;
  tenantId: string;
  type: string; // e.g., 'CONFIRM_MATCH', 'RESOLVE_EXCEPTION'
  amount: number;
  supplierIds: string[];
  monthCloseId: string;
  confidence: number; // 0-100
  riskTier: RiskTier;
  timestamp: Date;
}

export interface EnvelopeViolation {
  type: 'FINANCIAL' | 'SCOPE' | 'CONFIDENCE' | 'RISK' | 'BLAST_RADIUS';
  reason: string;
  limit: number | string;
  actual: number | string;
  severity: 'WARNING' | 'BLOCK';
}

export interface ValidationResult {
  approved: boolean;
  violations: EnvelopeViolation[];
  usedLimits: {
    dailyExposure: number;
    cumulativeExposure: number;
    riskExposure: Record<RiskTier, number>;
  };
  suggestedAction?: string;
  timestamp: Date;
}

export interface CumulativeState {
  tenantId: string;
  dailyExposure: number;
  cumulativeExposure: number;
  riskExposure: Record<RiskTier, number>;
  lastResetDate: Date;
  violationCount: number;
  lastViolationAt?: Date;
}

/**
 * Envelope Guard - Financial and operational boundary enforcement
 */
export class EnvelopeGuard {
  private policy: EnvelopePolicy;
  private cumulativeStates: Map<string, CumulativeState> = new Map();
  private readonly VIOLATION_THRESHOLD = 3;
  private readonly VIOLATION_WINDOW_MS = 3600000; // 1 hour

  constructor(policy?: Partial<EnvelopePolicy>) {
    this.policy = this.mergeWithDefaults(policy);
  }

  /**
   * Merge provided policy with safe defaults
   */
  private mergeWithDefaults(policy?: Partial<EnvelopePolicy>): EnvelopePolicy {
    return {
      financial: {
        maxPerDecision: policy?.financial?.maxPerDecision ?? 50000,
        maxCumulative: policy?.financial?.maxCumulative ?? 500000,
        maxDailyExposure: policy?.financial?.maxDailyExposure ?? 100000,
      },
      scope: {
        maxSuppliersPerAction: policy?.scope?.maxSuppliersPerAction ?? 5,
        maxMonthsPerAction: policy?.scope?.maxMonthsPerAction ?? 1,
        requireManualApprovalAbove: policy?.scope?.requireManualApprovalAbove ?? 25000,
      },
      confidence: {
        minimumThreshold: policy?.confidence?.minimumThreshold ?? 70,
        requireHighConfidenceAbove: policy?.confidence?.requireHighConfidenceAbove ?? 10000,
        highConfidenceThreshold: policy?.confidence?.highConfidenceThreshold ?? 90,
      },
      risk: {
        maxLowRiskCumulative: policy?.risk?.maxLowRiskCumulative ?? 200000,
        maxMediumRiskCumulative: policy?.risk?.maxMediumRiskCumulative ?? 100000,
        maxHighRiskSingle: policy?.risk?.maxHighRiskSingle ?? 5000,
      },
    };
  }

  /**
   * Validate action against all envelope limits
   */
  validate(request: ActionRequest): ValidationResult {
    const violations: EnvelopeViolation[] = [];
    const state = this.getOrInitializeCumulativeState(request.tenantId);

    // Reset daily counters if needed
    this.resetDailyCountersIfNeeded(state);

    // Check financial exposure cap per decision
    if (request.amount > this.policy.financial.maxPerDecision) {
      violations.push({
        type: 'FINANCIAL',
        reason: 'Amount exceeds maximum per decision limit',
        limit: this.policy.financial.maxPerDecision,
        actual: request.amount,
        severity: 'BLOCK',
      });
    }

    // Check cumulative financial exposure
    const newCumulative = state.cumulativeExposure + request.amount;
    if (newCumulative > this.policy.financial.maxCumulative) {
      violations.push({
        type: 'FINANCIAL',
        reason: 'Action would exceed cumulative exposure limit',
        limit: this.policy.financial.maxCumulative,
        actual: newCumulative,
        severity: 'BLOCK',
      });
    }

    // Check daily exposure
    const newDailyExposure = state.dailyExposure + request.amount;
    if (newDailyExposure > this.policy.financial.maxDailyExposure) {
      violations.push({
        type: 'FINANCIAL',
        reason: 'Action would exceed daily exposure limit',
        limit: this.policy.financial.maxDailyExposure,
        actual: newDailyExposure,
        severity: 'BLOCK',
      });
    }

    // Check scope restrictions
    if (request.supplierIds.length > this.policy.scope.maxSuppliersPerAction) {
      violations.push({
        type: 'SCOPE',
        reason: 'Too many suppliers affected by single action',
        limit: this.policy.scope.maxSuppliersPerAction,
        actual: request.supplierIds.length,
        severity: 'BLOCK',
      });
    }

    // Check manual approval requirement
    if (request.amount > this.policy.scope.requireManualApprovalAbove) {
      violations.push({
        type: 'SCOPE',
        reason: 'Amount requires manual approval',
        limit: this.policy.scope.requireManualApprovalAbove,
        actual: request.amount,
        severity: 'WARNING',
      });
    }

    // Check confidence threshold
    if (request.confidence < this.policy.confidence.minimumThreshold) {
      violations.push({
        type: 'CONFIDENCE',
        reason: 'Confidence below minimum threshold',
        limit: this.policy.confidence.minimumThreshold,
        actual: request.confidence,
        severity: 'BLOCK',
      });
    }

    // Check high confidence requirement for large amounts
    if (
      request.amount > this.policy.confidence.requireHighConfidenceAbove &&
      request.confidence < this.policy.confidence.highConfidenceThreshold
    ) {
      violations.push({
        type: 'CONFIDENCE',
        reason: 'Large amount requires high confidence',
        limit: this.policy.confidence.highConfidenceThreshold,
        actual: request.confidence,
        severity: 'BLOCK',
      });
    }

    // Check risk tier limits
    const riskViolation = this.checkRiskLimits(request, state);
    if (riskViolation) {
      violations.push(riskViolation);
    }

    // Check blast radius (cumulative risk exposure)
    const blastRadiusViolation = this.checkBlastRadius(state);
    if (blastRadiusViolation) {
      violations.push(blastRadiusViolation);
    }

    // Determine if action is approved
    const hasBlockingViolations = violations.some(v => v.severity === 'BLOCK');
    const approved = !hasBlockingViolations;

    // Update state if approved
    if (approved) {
      state.dailyExposure = newDailyExposure;
      state.cumulativeExposure = newCumulative;
      state.riskExposure[request.riskTier] += request.amount;
    } else {
      // Track violation
      state.violationCount++;
      state.lastViolationAt = new Date();
    }

    const result: ValidationResult = {
      approved,
      violations,
      usedLimits: {
        dailyExposure: approved ? state.dailyExposure : state.dailyExposure,
        cumulativeExposure: approved ? state.cumulativeExposure : state.cumulativeExposure,
        riskExposure: { ...state.riskExposure },
      },
      timestamp: new Date(),
    };

    // Add suggested action if violations exist
    if (violations.length > 0) {
      result.suggestedAction = this.getSuggestedAction(violations, state);
    }

    return result;
  }

  /**
   * Check risk tier specific limits
   */
  private checkRiskLimits(
    request: ActionRequest,
    state: CumulativeState
  ): EnvelopeViolation | null {
    switch (request.riskTier) {
      case RiskTier.HIGH:
      case RiskTier.CRITICAL:
        if (request.amount > this.policy.risk.maxHighRiskSingle) {
          return {
            type: 'RISK',
            reason: `${request.riskTier} risk action exceeds single action limit`,
            limit: this.policy.risk.maxHighRiskSingle,
            actual: request.amount,
            severity: 'BLOCK',
          };
        }
        break;

      case RiskTier.MEDIUM:
        const newMediumExposure = state.riskExposure[RiskTier.MEDIUM] + request.amount;
        if (newMediumExposure > this.policy.risk.maxMediumRiskCumulative) {
          return {
            type: 'RISK',
            reason: 'Medium risk cumulative exposure would be exceeded',
            limit: this.policy.risk.maxMediumRiskCumulative,
            actual: newMediumExposure,
            severity: 'BLOCK',
          };
        }
        break;

      case RiskTier.LOW:
        const newLowExposure = state.riskExposure[RiskTier.LOW] + request.amount;
        if (newLowExposure > this.policy.risk.maxLowRiskCumulative) {
          return {
            type: 'RISK',
            reason: 'Low risk cumulative exposure would be exceeded',
            limit: this.policy.risk.maxLowRiskCumulative,
            actual: newLowExposure,
            severity: 'BLOCK',
          };
        }
        break;
    }

    return null;
  }

  /**
   * Check overall blast radius
   */
  private checkBlastRadius(state: CumulativeState): EnvelopeViolation | null {
    const totalRiskExposure = Object.values(state.riskExposure).reduce(
      (sum, val) => sum + val,
      0
    );

    // Blast radius check: if cumulative is approaching max, warn
    if (totalRiskExposure > this.policy.financial.maxCumulative * 0.8) {
      return {
        type: 'BLAST_RADIUS',
        reason: 'Cumulative risk exposure approaching critical threshold',
        limit: this.policy.financial.maxCumulative,
        actual: totalRiskExposure,
        severity: 'WARNING',
      };
    }

    return null;
  }

  /**
   * Get or initialize cumulative state for tenant
   */
  private getOrInitializeCumulativeState(tenantId: string): CumulativeState {
    let state = this.cumulativeStates.get(tenantId);
    if (!state) {
      state = {
        tenantId,
        dailyExposure: 0,
        cumulativeExposure: 0,
        riskExposure: {
          [RiskTier.LOW]: 0,
          [RiskTier.MEDIUM]: 0,
          [RiskTier.HIGH]: 0,
          [RiskTier.CRITICAL]: 0,
        },
        lastResetDate: new Date(),
        violationCount: 0,
      };
      this.cumulativeStates.set(tenantId, state);
    }
    return state;
  }

  /**
   * Reset daily counters if new day
   */
  private resetDailyCountersIfNeeded(state: CumulativeState): void {
    const now = new Date();
    const lastReset = state.lastResetDate;

    // Check if it's a new day
    if (
      now.getDate() !== lastReset.getDate() ||
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      state.dailyExposure = 0;
      state.lastResetDate = now;
    }
  }

  /**
   * Get suggested action based on violations
   */
  private getSuggestedAction(
    violations: EnvelopeViolation[],
    state: CumulativeState
  ): string {
    const hasRepeatedViolations = this.hasRepeatedViolations(state);

    if (hasRepeatedViolations) {
      return 'Trigger Mode downgrade - repeated envelope violations detected';
    }

    const blockingViolations = violations.filter(v => v.severity === 'BLOCK');
    if (blockingViolations.length > 0) {
      return `Action denied - resolve: ${blockingViolations.map(v => v.reason).join('; ')}`;
    }

    return 'Proceed with caution - warnings present';
  }

  /**
   * Check for repeated violations within time window
   */
  hasRepeatedViolations(state: CumulativeState): boolean {
    if (!state.lastViolationAt) {
      return false;
    }

    const timeSinceViolation = Date.now() - state.lastViolationAt.getTime();
    return (
      state.violationCount >= this.VIOLATION_THRESHOLD &&
      timeSinceViolation < this.VIOLATION_WINDOW_MS
    );
  }

  /**
   * Check if mode downgrade is recommended
   */
  shouldDowngradeMode(tenantId: string): boolean {
    const state = this.cumulativeStates.get(tenantId);
    return state ? this.hasRepeatedViolations(state) : false;
  }

  /**
   * Get current state for tenant
   */
  getState(tenantId: string): CumulativeState | null {
    const state = this.cumulativeStates.get(tenantId);
    return state ? { ...state } : null;
  }

  /**
   * Reset state for tenant (for testing/recovery)
   */
  reset(tenantId: string): void {
    this.cumulativeStates.delete(tenantId);
  }

  /**
   * Update policy (allows runtime configuration)
   */
  updatePolicy(policy: Partial<EnvelopePolicy>): void {
    this.policy = this.mergeWithDefaults(policy);
  }

  /**
   * Get current policy
   */
  getPolicy(): EnvelopePolicy {
    return { ...this.policy };
  }
}

/**
 * Factory function for creating envelope guard
 */
export function createEnvelopeGuard(policy?: Partial<EnvelopePolicy>): EnvelopeGuard {
  return new EnvelopeGuard(policy);
}
