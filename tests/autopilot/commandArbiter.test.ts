/**
 * ZEREBROX CALYBRA OS - Command Arbiter Tests
 * Tests for policy enforcement, AI vs deterministic arbitration, and conflict resolution
 */

import {
  CommandArbiter,
  DecisionContext,
  AIRecommendation,
  PolicyRule,
  createCommandArbiter,
} from '../../src/lib/autopilot/commandArbiter';
import { SystemMode } from '../../src/lib/autopilot/modeManager';

describe('CommandArbiter', () => {
  let arbiter: CommandArbiter;
  const tenantId = 'tenant-123';
  const userId = 'user-456';

  beforeEach(() => {
    arbiter = createCommandArbiter();
  });

  describe('Hard Policy Enforcement', () => {
    test('should deny all actions in LOCKDOWN mode', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 1000,
        tenantId,
        userId,
        mode: SystemMode.LOCKDOWN,
        confidence: 95,
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('DENY');
      expect(result.winner).toBe('HARD_POLICY');
      expect(result.reasoning).toContain('LOCKDOWN');
    });

    test('should deny execution in non-CONSTRAINED_ACT modes', () => {
      const modes = [SystemMode.OBSERVE, SystemMode.ADVISE, SystemMode.HOLD];

      modes.forEach(mode => {
        const context: DecisionContext = {
          actionType: 'CONFIRM_MATCH',
          amount: 1000,
          tenantId,
          userId,
          mode,
          confidence: 95,
        };

        const result = arbiter.arbitrate(context);

        expect(result.decision).toBe('DENY');
        expect(result.winner).toBe('HARD_POLICY');
      });
    });

    test('should enforce hard amount limits', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 150000, // Over 100k hard limit
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 95,
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('DENY');
      expect(result.winner).toBe('HARD_POLICY');
      expect(result.reasoning).toContain('hard limit');
    });

    test('hard policy should always win over AI', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 150000, // Over hard limit
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 95,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true, // AI says yes
        confidence: 99,
        reasoning: 'AI thinks this is fine',
      };

      const result = arbiter.arbitrate(context, aiRecommendation);

      // Hard policy should override AI
      expect(result.decision).toBe('DENY');
      expect(result.winner).toBe('HARD_POLICY');
    });
  });

  describe('Deterministic Logic Evaluation', () => {
    test('should evaluate deterministic rules after hard policy', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60, // Below minimum 75
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('DENY');
      expect(result.winner).toBe('DETERMINISTIC');
      expect(result.reasoning).toContain('Confidence');
    });

    test('should enforce supplier scope limits', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: Array.from({ length: 15 }, (_, i) => `sup-${i}`), // 15 suppliers, limit is 10
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('DENY');
      expect(result.reasoning).toContain('suppliers');
    });

    test('should allow action when all deterministic rules pass', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: ['sup-1', 'sup-2'],
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('ALLOW');
      expect(result.winner).toBe('DETERMINISTIC');
    });
  });

  describe('AI Integration', () => {
    test('should not use AI recommendations in OBSERVE mode', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.OBSERVE, // AI not allowed
        confidence: 85,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 95,
        reasoning: 'AI recommendation',
      };

      const result = arbiter.arbitrate(context, aiRecommendation);

      // AI should not be used because mode doesn't allow execution
      expect(result.aiOutput).not.toBeNull(); // Logged but not used
      expect(result.decision).toBe('DENY'); // Mode policy denies
    });

    test('should use AI recommendations in CONSTRAINED_ACT mode', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 95,
        reasoning: 'High confidence match',
      };

      const result = arbiter.arbitrate(context, aiRecommendation);

      expect(result.decision).toBe('ALLOW');
      expect(result.winner).toBe('AI');
      expect(result.aiOutput).toEqual(aiRecommendation);
    });

    test('should validate AI compliance with policy', () => {
      const contextAllowed: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      expect(arbiter.validateAICompliance(contextAllowed)).toBe(true);

      const contextNotAllowed: DecisionContext = {
        ...contextAllowed,
        mode: SystemMode.OBSERVE,
      };

      expect(arbiter.validateAICompliance(contextNotAllowed)).toBe(false);
    });
  });

  describe('Conflict Detection and Resolution', () => {
    test('should detect conflict when deterministic and AI disagree', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60, // Fails deterministic rule (< 75)
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true, // AI says allow
        confidence: 90,
        reasoning: 'AI override',
      };

      const result = arbiter.arbitrate(context, aiRecommendation);

      expect(result.conflictFlag).toBe(true);
      expect(result.winner).toBe('DETERMINISTIC'); // Deterministic wins
      expect(result.decision).toBe('DENY');
    });

    test('should log all evaluation stages', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 95,
        reasoning: 'AI recommendation',
      };

      const result = arbiter.arbitrate(context, aiRecommendation);

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.some(log => log.stage === 'HARD_POLICY')).toBe(true);
      expect(result.logs.some(log => log.stage === 'DETERMINISTIC')).toBe(true);
      expect(result.logs.some(log => log.stage === 'AI_RECOMMENDATION')).toBe(true);
      expect(result.logs.some(log => log.stage === 'FINAL_VALIDATION')).toBe(true);
    });

    test('should escalate to HOLD after repeated disagreements', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60, // Will fail deterministic
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true, // Will conflict
        confidence: 90,
        reasoning: 'AI disagrees',
      };

      // Create 5 disagreements
      for (let i = 0; i < 5; i++) {
        arbiter.arbitrate(context, aiRecommendation);
      }

      // 6th should trigger escalation
      const result = arbiter.arbitrate(context, aiRecommendation);

      expect(result.decision).toBe('ESCALATE');
      expect(result.winner).toBe('ESCALATION');
      expect(result.reasoning).toContain('HOLD');
    });

    test('should track disagreement counts', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 90,
        reasoning: 'AI disagrees',
      };

      arbiter.arbitrate(context, aiRecommendation);
      arbiter.arbitrate(context, aiRecommendation);

      const counts = arbiter.getDisagreementCounts();
      expect(counts.get(tenantId)).toBeGreaterThan(0);
    });

    test('should reset disagreement count after escalation', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 90,
        reasoning: 'AI disagrees',
      };

      // Create escalation
      for (let i = 0; i < 6; i++) {
        arbiter.arbitrate(context, aiRecommendation);
      }

      const counts = arbiter.getDisagreementCounts();
      expect(counts.get(tenantId)).toBe(0); // Should reset after escalation
    });
  });

  describe('Custom Rules', () => {
    test('should allow adding custom hard policy rules', () => {
      const customRule: PolicyRule = {
        id: 'custom-hp',
        name: 'Custom Hard Policy',
        priority: 95,
        evaluate: (ctx) => ({
          allow: ctx.amount! < 5000,
          reason: 'Custom rule: amount must be under 5000',
          confidence: 100,
        }),
      };

      arbiter.addHardPolicyRule(customRule);

      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 6000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('DENY');
      expect(result.reasoning).toContain('5000');
    });

    test('should allow adding custom deterministic rules', () => {
      const customRule: PolicyRule = {
        id: 'custom-det',
        name: 'Custom Deterministic Rule',
        priority: 65,
        evaluate: (ctx) => ({
          allow: ctx.actionType !== 'DANGEROUS_ACTION',
          reason: 'Dangerous action not allowed',
          confidence: 100,
        }),
      };

      arbiter.addDeterministicRule(customRule);

      const context: DecisionContext = {
        actionType: 'DANGEROUS_ACTION',
        amount: 1000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      expect(result.decision).toBe('DENY');
      expect(result.reasoning).toContain('Dangerous');
    });
  });

  describe('Execution Order Validation', () => {
    test('should evaluate in correct order: Hard Policy → Deterministic → AI', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 95,
        reasoning: 'AI says yes',
      };

      const result = arbiter.arbitrate(context, aiRecommendation);

      // Check log order
      const stages = result.logs.map(log => log.stage);
      const hardPolicyIndex = stages.indexOf('HARD_POLICY');
      const deterministicIndex = stages.indexOf('DETERMINISTIC');
      const aiIndex = stages.indexOf('AI_RECOMMENDATION');

      expect(hardPolicyIndex).toBeLessThan(deterministicIndex);
      expect(deterministicIndex).toBeLessThan(aiIndex);
    });

    test('should stop evaluation if hard policy fails', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.LOCKDOWN, // Will fail hard policy
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      // Should only have hard policy log, not deterministic or AI
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].stage).toBe('HARD_POLICY');
      expect(result.deterministicOutput).toBeNull();
    });
  });

  describe('Mandatory Logging', () => {
    test('should log all required fields', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      // Check main result fields
      expect(result.decision).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.conflictFlag).toBeDefined();
      expect(result.confidenceScore).toBeDefined();
      expect(result.envelopeStatus).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(result.logs)).toBe(true);
    });

    test('should include rule outputs in result', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 85,
      };

      const result = arbiter.arbitrate(context);

      expect(result.ruleOutput).not.toBeNull();
      expect(result.deterministicOutput).not.toBeNull();
    });
  });

  describe('Tenant Isolation', () => {
    test('should track disagreements separately per tenant', () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      const context1: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId: tenant1,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60,
      };

      const context2: DecisionContext = {
        ...context1,
        tenantId: tenant2,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 90,
        reasoning: 'AI disagrees',
      };

      arbiter.arbitrate(context1, aiRecommendation);
      arbiter.arbitrate(context1, aiRecommendation);
      arbiter.arbitrate(context2, aiRecommendation);

      const counts = arbiter.getDisagreementCounts();
      expect(counts.get(tenant1)).toBe(2);
      expect(counts.get(tenant2)).toBe(1);
    });

    test('should allow resetting disagreement count per tenant', () => {
      const context: DecisionContext = {
        actionType: 'CONFIRM_MATCH',
        amount: 10000,
        tenantId,
        userId,
        mode: SystemMode.CONSTRAINED_ACT,
        confidence: 60,
      };

      const aiRecommendation: AIRecommendation = {
        action: 'CONFIRM_MATCH',
        allow: true,
        confidence: 90,
        reasoning: 'AI disagrees',
      };

      arbiter.arbitrate(context, aiRecommendation);
      arbiter.resetDisagreementCount(tenantId);

      const counts = arbiter.getDisagreementCounts();
      expect(counts.has(tenantId)).toBe(false);
    });
  });
});
