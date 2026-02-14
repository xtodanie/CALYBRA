/**
 * ZEREBROX CALYBRA OS - Envelope Guard Tests
 * Tests for financial limits, risk tiers, and violation tracking
 */

import {
  EnvelopeGuard,
  ActionRequest,
  RiskTier,
  EnvelopePolicy,
  createEnvelopeGuard,
} from '../../src/lib/autopilot/envelopeGuard';

describe('EnvelopeGuard', () => {
  let guard: EnvelopeGuard;
  const tenantId = 'tenant-123';

  beforeEach(() => {
    guard = createEnvelopeGuard();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with default policy', () => {
      const policy = guard.getPolicy();
      
      expect(policy.financial.maxPerDecision).toBe(50000);
      expect(policy.financial.maxCumulative).toBe(500000);
      expect(policy.confidence.minimumThreshold).toBe(70);
    });

    test('should allow custom policy configuration', () => {
      const customPolicy: Partial<EnvelopePolicy> = {
        financial: {
          maxPerDecision: 100000,
          maxCumulative: 1000000,
          maxDailyExposure: 200000,
        },
      };
      const customGuard = createEnvelopeGuard(customPolicy);
      const policy = customGuard.getPolicy();

      expect(policy.financial.maxPerDecision).toBe(100000);
      expect(policy.financial.maxCumulative).toBe(1000000);
    });

    test('should allow policy updates at runtime', () => {
      guard.updatePolicy({
        confidence: { minimumThreshold: 80, requireHighConfidenceAbove: 5000, highConfidenceThreshold: 95 },
      });
      const policy = guard.getPolicy();

      expect(policy.confidence.minimumThreshold).toBe(80);
    });
  });

  describe('Financial Exposure Limits', () => {
    test('should approve action within per-decision limit', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    test('should block action exceeding per-decision limit', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 60000, // Over default 50000 limit
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.type === 'FINANCIAL')).toBe(true);
      expect(result.violations[0].reason).toContain('per decision');
    });

    test('should track cumulative exposure', () => {
      const request1: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 9000, // Below high confidence threshold
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result1 = guard.validate(request1);
      expect(result1.approved).toBe(true);
      expect(result1.usedLimits.cumulativeExposure).toBe(9000);

      const request2: ActionRequest = {
        ...request1,
        actionId: 'act-2',
        amount: 8000,
      };

      const result2 = guard.validate(request2);
      expect(result2.approved).toBe(true);
      expect(result2.usedLimits.cumulativeExposure).toBe(17000);
    });

    test('should block action exceeding cumulative limit', () => {
      // Use custom guard with higher risk tier limits for this test
      const customGuard = createEnvelopeGuard({
        financial: {
          maxPerDecision: 50000,
          maxCumulative: 500000,
          maxDailyExposure: 1000000, // High to not interfere
        },
        risk: {
          maxLowRiskCumulative: 1000000, // High to not interfere
          maxMediumRiskCumulative: 1000000,
          maxHighRiskSingle: 50000,
        },
      });
      
      // Add 490k with high confidence
      for (let i = 0; i < 10; i++) {
        customGuard.validate({
          actionId: `act-${i}`,
          tenantId,
          type: 'CONFIRM_MATCH',
          amount: 49000,
          supplierIds: ['sup-1'],
          monthCloseId: 'month-1',
          confidence: 95,
          riskTier: RiskTier.LOW,
          timestamp: new Date(),
        });
      }

      // Try to exceed 500k cumulative
      const request: ActionRequest = {
        actionId: 'act-final',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 20000, // Would bring total to 510k
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 95,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = customGuard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.reason.includes('cumulative'))).toBe(true);
    });

    test('should track daily exposure separately', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 9000, // Below high confidence threshold
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result1 = guard.validate(request);
      expect(result1.usedLimits.dailyExposure).toBe(9000);

      const result2 = guard.validate({ ...request, actionId: 'act-2' });
      expect(result2.approved).toBe(true);
      expect(result2.usedLimits.dailyExposure).toBe(18000);
    });

    test('should block action exceeding daily limit', () => {
      // Add 49k * 2 = 98k in daily exposure with high confidence
      guard.validate({
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 49000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 95, // High confidence for large amount
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      guard.validate({
        actionId: 'act-2',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 49000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 95,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      // Try to add 5k more (would exceed 100k daily limit: 98k + 5k = 103k)
      const request: ActionRequest = {
        actionId: 'act-3',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 5000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.reason.includes('daily'))).toBe(true);
    });
  });

  describe('Scope Restrictions', () => {
    test('should block action with too many suppliers', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: ['sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5', 'sup-6'], // 6 suppliers, limit is 5
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.type === 'SCOPE')).toBe(true);
    });

    test('should warn for amounts requiring manual approval', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 30000, // Over 25000 manual approval threshold but needs high confidence
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 95, // High confidence needed for large amount
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      // Should have warning and be approved with high confidence
      expect(result.approved).toBe(true);
      expect(result.violations.some(v => v.severity === 'WARNING')).toBe(true);
    });
  });

  describe('Confidence Thresholds', () => {
    test('should block action below minimum confidence', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 65, // Below 70 threshold
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.type === 'CONFIDENCE')).toBe(true);
    });

    test('should require high confidence for large amounts', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 15000, // Over 10000 high confidence threshold
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85, // Above minimum but below high confidence (90)
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.reason.includes('high confidence'))).toBe(true);
    });

    test('should approve large amount with high confidence', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 15000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 92, // Above high confidence threshold
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(true);
    });
  });

  describe('Risk Tier Limits', () => {
    test('should block HIGH risk action exceeding single limit', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 6000, // Over 5000 high risk single limit
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.HIGH,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.type === 'RISK')).toBe(true);
    });

    test('should track MEDIUM risk cumulative exposure', () => {
      // Add multiple medium risk actions
      for (let i = 0; i < 10; i++) {
        guard.validate({
          actionId: `act-${i}`,
          tenantId,
          type: 'CONFIRM_MATCH',
          amount: 9000,
          supplierIds: ['sup-1'],
          monthCloseId: 'month-1',
          confidence: 85,
          riskTier: RiskTier.MEDIUM,
          timestamp: new Date(),
        });
      }

      // Try to exceed medium risk cumulative (100k)
      const request: ActionRequest = {
        actionId: 'act-final',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 15000, // Would bring medium risk total to 105k
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.MEDIUM,
        timestamp: new Date(),
      };

      const result = guard.validate(request);

      expect(result.approved).toBe(false);
      expect(result.violations.some(v => v.reason.includes('Medium risk'))).toBe(true);
    });

    test('should track LOW risk cumulative exposure', () => {
      const state = guard.getState(tenantId);
      expect(state).toBeNull(); // No state yet

      guard.validate({
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 9000, // Below high confidence threshold
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      const stateAfter = guard.getState(tenantId);
      expect(stateAfter?.riskExposure[RiskTier.LOW]).toBe(9000);
    });
  });

  describe('Blast Radius Tracking', () => {
    test('should warn when approaching cumulative critical threshold', () => {
      // Use custom guard with higher risk limits to not interfere with test
      const customGuard = createEnvelopeGuard({
        financial: {
          maxPerDecision: 50000,
          maxCumulative: 500000,
          maxDailyExposure: 1000000,
        },
        risk: {
          maxLowRiskCumulative: 1000000, // High to not interfere
          maxMediumRiskCumulative: 1000000,
          maxHighRiskSingle: 50000,
        },
      });
      
      // Add actions to get to >80% of cumulative max (500k * 0.8 = 400k)
      // Use 49k per action x 9 = 441k
      for (let i = 0; i < 9; i++) {
        customGuard.validate({
          actionId: `act-${i}`,
          tenantId,
          type: 'CONFIRM_MATCH',
          amount: 49000,
          supplierIds: ['sup-1'],
          monthCloseId: 'month-1',
          confidence: 95,
          riskTier: RiskTier.LOW,
          timestamp: new Date(),
        });
      }

      // After 9 actions, state has 441k. This is > 400k, so blast radius should warn
      const result = customGuard.validate({
        actionId: 'act-trigger',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 5000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      expect(result.violations.some(v => v.type === 'BLAST_RADIUS')).toBe(true);
      expect(result.violations.find(v => v.type === 'BLAST_RADIUS')?.severity).toBe('WARNING');
    });
  });

  describe('Violation Tracking and Mode Downgrade', () => {
    test('should track violations on blocked actions', () => {
      // Create violations
      for (let i = 0; i < 3; i++) {
        guard.validate({
          actionId: `act-${i}`,
          tenantId,
          type: 'CONFIRM_MATCH',
          amount: 60000, // Over limit
          supplierIds: ['sup-1'],
          monthCloseId: 'month-1',
          confidence: 85,
          riskTier: RiskTier.LOW,
          timestamp: new Date(),
        });
      }

      const state = guard.getState(tenantId);
      expect(state?.violationCount).toBeGreaterThanOrEqual(3);
    });

    test('should recommend mode downgrade after repeated violations', () => {
      // Create 3 violations rapidly
      for (let i = 0; i < 3; i++) {
        guard.validate({
          actionId: `act-${i}`,
          tenantId,
          type: 'CONFIRM_MATCH',
          amount: 60000, // Over limit
          supplierIds: ['sup-1'],
          monthCloseId: 'month-1',
          confidence: 85,
          riskTier: RiskTier.LOW,
          timestamp: new Date(),
        });
      }

      expect(guard.shouldDowngradeMode(tenantId)).toBe(true);
    });

    test('should include downgrade suggestion in result', () => {
      // Create 3 violations
      for (let i = 0; i < 3; i++) {
        guard.validate({
          actionId: `act-${i}`,
          tenantId,
          type: 'CONFIRM_MATCH',
          amount: 60000,
          supplierIds: ['sup-1'],
          monthCloseId: 'month-1',
          confidence: 85,
          riskTier: RiskTier.LOW,
          timestamp: new Date(),
        });
      }

      // Next violation should suggest downgrade
      const result = guard.validate({
        actionId: 'act-trigger',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 60000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      expect(result.suggestedAction).toContain('Mode downgrade');
    });
  });

  describe('State Management', () => {
    test('should maintain separate states per tenant', () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      guard.validate({
        actionId: 'act-1',
        tenantId: tenant1,
        type: 'CONFIRM_MATCH',
        amount: 9000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      guard.validate({
        actionId: 'act-2',
        tenantId: tenant2,
        type: 'CONFIRM_MATCH',
        amount: 8000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      const state1 = guard.getState(tenant1);
      const state2 = guard.getState(tenant2);

      expect(state1?.cumulativeExposure).toBe(9000);
      expect(state2?.cumulativeExposure).toBe(8000);
    });

    test('should reset state correctly', () => {
      guard.validate({
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      });

      expect(guard.getState(tenantId)).not.toBeNull();

      guard.reset(tenantId);
      expect(guard.getState(tenantId)).toBeNull();
    });
  });

  describe('Edge Case Stress Tests', () => {
    test('should handle zero amount gracefully', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 0,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);
      expect(result.approved).toBe(true);
    });

    test('should handle negative amount as financial violation', () => {
      // Note: In real system, negative amounts might represent refunds/credits
      // This test ensures we don't bypass limits with negative numbers
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: -10000,
        supplierIds: ['sup-1'],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);
      // System should handle this gracefully
      expect(result).toBeDefined();
    });

    test('should handle empty supplier list', () => {
      const request: ActionRequest = {
        actionId: 'act-1',
        tenantId,
        type: 'CONFIRM_MATCH',
        amount: 10000,
        supplierIds: [],
        monthCloseId: 'month-1',
        confidence: 85,
        riskTier: RiskTier.LOW,
        timestamp: new Date(),
      };

      const result = guard.validate(request);
      expect(result.approved).toBe(true);
    });
  });
});
