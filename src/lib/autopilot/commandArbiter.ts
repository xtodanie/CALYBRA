/**
 * ZEREBROX CALYBRA OS - Command Arbiter
 * 
 * Purpose: Enforces deterministic-first, AI-second execution flow.
 * Hard policy always wins. Disagreements trigger escalation.
 */

import { SystemMode } from './modeManager';

export interface PolicyRule {
  id: string;
  name: string;
  evaluate: (context: DecisionContext) => PolicyDecision;
  priority: number; // Higher priority rules checked first
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  confidence: number; // 0-100
  metadata?: Record<string, any>;
}

export interface AIRecommendation {
  action: string;
  allow: boolean;
  confidence: number; // 0-100
  reasoning: string;
  alternativeSuggestions?: string[];
}

export interface DecisionContext {
  actionType: string;
  amount?: number;
  supplierIds?: string[];
  monthCloseId?: string;
  confidence?: number;
  tenantId: string;
  userId: string;
  mode: SystemMode;
  metadata?: Record<string, any>;
}

export interface ArbitrationResult {
  decision: 'ALLOW' | 'DENY' | 'ESCALATE';
  winner: 'HARD_POLICY' | 'DETERMINISTIC' | 'AI' | 'ESCALATION';
  ruleOutput: PolicyDecision | null;
  deterministicOutput: PolicyDecision | null;
  aiOutput: AIRecommendation | null;
  conflictFlag: boolean;
  confidenceScore: number;
  envelopeStatus: 'APPROVED' | 'VIOLATED' | 'NOT_CHECKED';
  reasoning: string;
  timestamp: Date;
  logs: ArbitrationLog[];
}

export interface ArbitrationLog {
  stage: string;
  decision: string;
  reason: string;
  timestamp: Date;
}

export interface DisagreementConfig {
  toleranceThreshold: number; // Confidence difference threshold to trigger escalation
  maxDisagreements: number; // Max disagreements before escalating to HOLD
}

/**
 * Command Arbiter - Deterministic-first execution arbiter
 */
export class CommandArbiter {
  private hardPolicyRules: PolicyRule[] = [];
  private deterministicRules: PolicyRule[] = [];
  private disagreementConfig: DisagreementConfig;
  private disagreementCounts: Map<string, number> = new Map();

  constructor(disagreementConfig?: Partial<DisagreementConfig>) {
    this.disagreementConfig = {
      toleranceThreshold: disagreementConfig?.toleranceThreshold ?? 30,
      maxDisagreements: disagreementConfig?.maxDisagreements ?? 5,
    };
    this.initializeDefaultRules();
  }

  /**
   * Initialize default hard policy and deterministic rules
   */
  private initializeDefaultRules(): void {
    // Hard Policy Rules (highest priority, always enforced)
    this.hardPolicyRules = [
      {
        id: 'hp-lockdown',
        name: 'Lockdown Mode Policy',
        priority: 100,
        evaluate: (ctx) => ({
          allow: ctx.mode !== SystemMode.LOCKDOWN,
          reason: ctx.mode === SystemMode.LOCKDOWN 
            ? 'System in LOCKDOWN - all actions denied'
            : 'Not in LOCKDOWN mode',
          confidence: 100,
        }),
      },
      {
        id: 'hp-execution-mode',
        name: 'Execution Mode Policy',
        priority: 90,
        evaluate: (ctx) => ({
          allow: ctx.mode === SystemMode.CONSTRAINED_ACT,
          reason: ctx.mode === SystemMode.CONSTRAINED_ACT
            ? 'Mode allows execution'
            : `Current mode (${ctx.mode}) does not allow execution`,
          confidence: 100,
        }),
      },
      {
        id: 'hp-amount-limit',
        name: 'Hard Amount Limit Policy',
        priority: 80,
        evaluate: (ctx) => {
          const HARD_LIMIT = 100000;
          const amount = ctx.amount ?? 0;
          return {
            allow: amount <= HARD_LIMIT,
            reason: amount > HARD_LIMIT
              ? `Amount ${amount} exceeds hard limit ${HARD_LIMIT}`
              : 'Within hard amount limit',
            confidence: 100,
          };
        },
      },
    ];

    // Deterministic Logic Rules (business logic, no AI)
    this.deterministicRules = [
      {
        id: 'det-confidence',
        name: 'Minimum Confidence Rule',
        priority: 70,
        evaluate: (ctx) => {
          const MIN_CONFIDENCE = 75;
          const confidence = ctx.confidence ?? 0;
          return {
            allow: confidence >= MIN_CONFIDENCE,
            reason: confidence < MIN_CONFIDENCE
              ? `Confidence ${confidence} below minimum ${MIN_CONFIDENCE}`
              : 'Confidence meets minimum threshold',
            confidence: 100,
          };
        },
      },
      {
        id: 'det-supplier-scope',
        name: 'Supplier Scope Rule',
        priority: 60,
        evaluate: (ctx) => {
          const MAX_SUPPLIERS = 10;
          const supplierCount = ctx.supplierIds?.length ?? 0;
          return {
            allow: supplierCount <= MAX_SUPPLIERS,
            reason: supplierCount > MAX_SUPPLIERS
              ? `Too many suppliers: ${supplierCount} > ${MAX_SUPPLIERS}`
              : 'Supplier count within limits',
            confidence: 100,
          };
        },
      },
    ];
  }

  /**
   * Arbitrate a decision through the evaluation order
   */
  arbitrate(
    context: DecisionContext,
    aiRecommendation?: AIRecommendation
  ): ArbitrationResult {
    const logs: ArbitrationLog[] = [];
    const timestamp = new Date();

    // Stage 1: Hard Policy Rules (always enforced first)
    const hardPolicyResult = this.evaluateHardPolicy(context);
    logs.push({
      stage: 'HARD_POLICY',
      decision: hardPolicyResult.allow ? 'ALLOW' : 'DENY',
      reason: hardPolicyResult.reason,
      timestamp: new Date(),
    });

    // If hard policy denies, stop immediately
    if (!hardPolicyResult.allow) {
      return {
        decision: 'DENY',
        winner: 'HARD_POLICY',
        ruleOutput: hardPolicyResult,
        deterministicOutput: null,
        aiOutput: aiRecommendation ?? null,
        conflictFlag: false,
        confidenceScore: hardPolicyResult.confidence,
        envelopeStatus: 'NOT_CHECKED',
        reasoning: `Hard policy denial: ${hardPolicyResult.reason}`,
        timestamp,
        logs,
      };
    }

    // Stage 2: Deterministic Logic Engine
    const deterministicResult = this.evaluateDeterministic(context);
    logs.push({
      stage: 'DETERMINISTIC',
      decision: deterministicResult.allow ? 'ALLOW' : 'DENY',
      reason: deterministicResult.reason,
      timestamp: new Date(),
    });

    // Stage 3: AI Recommendation (if allowed by mode)
    let aiResult: AIRecommendation | null = null;
    if (context.mode === SystemMode.CONSTRAINED_ACT && aiRecommendation) {
      aiResult = aiRecommendation;
      logs.push({
        stage: 'AI_RECOMMENDATION',
        decision: aiResult.allow ? 'ALLOW' : 'DENY',
        reason: aiResult.reasoning,
        timestamp: new Date(),
      });
    }

    // Stage 4: Conflict Detection and Resolution
    const conflictDetected = this.detectConflict(
      deterministicResult,
      aiResult
    );

    if (conflictDetected) {
      logs.push({
        stage: 'CONFLICT_DETECTION',
        decision: 'CONFLICT',
        reason: 'Deterministic and AI outputs disagree',
        timestamp: new Date(),
      });

      // Check if we should escalate
      const shouldEscalate = this.shouldEscalateToHold(context.tenantId);

      if (shouldEscalate) {
        return {
          decision: 'ESCALATE',
          winner: 'ESCALATION',
          ruleOutput: hardPolicyResult,
          deterministicOutput: deterministicResult,
          aiOutput: aiResult,
          conflictFlag: true,
          confidenceScore: 0,
          envelopeStatus: 'NOT_CHECKED',
          reasoning: 'Repeated disagreements - escalating to HOLD mode',
          timestamp,
          logs,
        };
      }
    }

    // Stage 5: Final Policy Validation
    // Deterministic wins if there's a conflict
    const finalDecision = conflictDetected
      ? deterministicResult
      : (aiResult ?? deterministicResult);

    const finalReason = conflictDetected
      ? deterministicResult.reason
      : (aiResult?.reasoning ?? deterministicResult.reason);

    logs.push({
      stage: 'FINAL_VALIDATION',
      decision: finalDecision.allow ? 'ALLOW' : 'DENY',
      reason: conflictDetected
        ? 'Deterministic wins over AI in conflict'
        : 'No conflict detected',
      timestamp: new Date(),
    });

    return {
      decision: finalDecision.allow ? 'ALLOW' : 'DENY',
      winner: conflictDetected ? 'DETERMINISTIC' : (aiResult ? 'AI' : 'DETERMINISTIC'),
      ruleOutput: hardPolicyResult,
      deterministicOutput: deterministicResult,
      aiOutput: aiResult,
      conflictFlag: conflictDetected,
      confidenceScore: finalDecision.confidence ?? deterministicResult.confidence,
      envelopeStatus: 'APPROVED', // Simplified - real impl would check envelope
      reasoning: finalReason,
      timestamp,
      logs,
    };
  }

  /**
   * Evaluate hard policy rules (highest priority)
   */
  private evaluateHardPolicy(context: DecisionContext): PolicyDecision {
    // Sort by priority and evaluate
    const sortedRules = [...this.hardPolicyRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const result = rule.evaluate(context);
      if (!result.allow) {
        return result; // First denial wins
      }
    }

    return {
      allow: true,
      reason: 'All hard policy rules passed',
      confidence: 100,
    };
  }

  /**
   * Evaluate deterministic rules
   */
  private evaluateDeterministic(context: DecisionContext): PolicyDecision {
    const sortedRules = [...this.deterministicRules].sort((a, b) => b.priority - a.priority);
    const failures: string[] = [];

    for (const rule of sortedRules) {
      const result = rule.evaluate(context);
      if (!result.allow) {
        failures.push(result.reason);
      }
    }

    if (failures.length > 0) {
      return {
        allow: false,
        reason: `Deterministic rules failed: ${failures.join('; ')}`,
        confidence: 100,
      };
    }

    return {
      allow: true,
      reason: 'All deterministic rules passed',
      confidence: 100,
    };
  }

  /**
   * Detect conflict between deterministic and AI outputs
   */
  private detectConflict(
    deterministicResult: PolicyDecision,
    aiResult: AIRecommendation | null
  ): boolean {
    if (!aiResult) {
      return false; // No AI recommendation, no conflict
    }

    // Check if decisions disagree
    if (deterministicResult.allow !== aiResult.allow) {
      return true;
    }

    // Check if confidence differs significantly
    const confidenceDiff = Math.abs(
      deterministicResult.confidence - aiResult.confidence
    );
    if (confidenceDiff > this.disagreementConfig.toleranceThreshold) {
      this.incrementDisagreementCount('confidence-gap');
      return true;
    }

    return false;
  }

  /**
   * Track disagreement counts
   */
  private incrementDisagreementCount(key: string): void {
    const current = this.disagreementCounts.get(key) ?? 0;
    this.disagreementCounts.set(key, current + 1);
  }

  /**
   * Check if we should escalate to HOLD based on disagreement count
   */
  private shouldEscalateToHold(tenantId: string): boolean {
    const count = this.disagreementCounts.get(tenantId) ?? 0;
    if (count >= this.disagreementConfig.maxDisagreements) {
      // Reset counter after escalation
      this.disagreementCounts.set(tenantId, 0);
      return true;
    }

    // Increment for this tenant
    this.disagreementCounts.set(tenantId, count + 1);
    return false;
  }

  /**
   * Add custom hard policy rule
   */
  addHardPolicyRule(rule: PolicyRule): void {
    this.hardPolicyRules.push(rule);
  }

  /**
   * Add custom deterministic rule
   */
  addDeterministicRule(rule: PolicyRule): void {
    this.deterministicRules.push(rule);
  }

  /**
   * Get disagreement counts (for monitoring)
   */
  getDisagreementCounts(): Map<string, number> {
    return new Map(this.disagreementCounts);
  }

  /**
   * Reset disagreement count for tenant
   */
  resetDisagreementCount(tenantId: string): void {
    this.disagreementCounts.delete(tenantId);
  }

  /**
   * Validate that AI cannot bypass policy
   */
  validateAICompliance(context: DecisionContext): boolean {
    // AI can only execute if mode allows
    if (context.mode !== SystemMode.CONSTRAINED_ACT) {
      return false;
    }

    // AI must pass all hard policy rules
    const hardPolicyResult = this.evaluateHardPolicy(context);
    if (!hardPolicyResult.allow) {
      return false;
    }

    return true;
  }
}

/**
 * Factory function for creating command arbiter
 */
export function createCommandArbiter(
  config?: Partial<DisagreementConfig>
): CommandArbiter {
  return new CommandArbiter(config);
}
