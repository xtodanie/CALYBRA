/**
 * ZEREBROX CALYBRA OS - Mode Manager Tests
 * Tests for state machine transitions, logging, and validation
 */

import {
  ModeManager,
  SystemMode,
  ModeContext,
  createModeManager,
} from '../../src/lib/autopilot/modeManager';

describe('ModeManager', () => {
  let manager: ModeManager;
  const tenantId = 'tenant-123';

  beforeEach(() => {
    manager = createModeManager();
  });

  describe('Initialization', () => {
    test('should initialize with OBSERVE mode by default', () => {
      const mode = manager.getCurrentMode(tenantId);
      expect(mode).toBe(SystemMode.OBSERVE);
    });

    test('should initialize state on first access', () => {
      const mode = manager.getCurrentMode(tenantId);
      const state = manager.getState(tenantId);

      expect(state).not.toBeNull();
      expect(state!.currentMode).toBe(SystemMode.OBSERVE);
      expect(state!.tenantId).toBe(tenantId);
      expect(state!.transitionHistory).toEqual([]);
    });
  });

  describe('Valid Transitions', () => {
    test('should allow OBSERVE → ADVISE transition', () => {
      const context: ModeContext = { tenantId };
      const log = manager.transition(
        tenantId,
        SystemMode.ADVISE,
        context,
        'Manual upgrade to advise mode'
      );

      expect(log.approved).toBe(true);
      expect(log.previousState).toBe(SystemMode.OBSERVE);
      expect(log.nextState).toBe(SystemMode.ADVISE);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);
    });

    test('should allow ADVISE → CONSTRAINED_ACT with proper conditions', () => {
      // First transition to ADVISE
      manager.transition(
        tenantId,
        SystemMode.ADVISE,
        { tenantId },
        'Setup'
      );

      // Then to CONSTRAINED_ACT with valid conditions
      const context: ModeContext = {
        tenantId,
        confidenceScore: 90,
        envelopeApproved: true,
        scoringStable: true,
      };
      const log = manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        context,
        'All conditions met for autonomous action'
      );

      expect(log.approved).toBe(true);
      expect(log.nextState).toBe(SystemMode.CONSTRAINED_ACT);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.CONSTRAINED_ACT);
    });

    test('should block ADVISE → CONSTRAINED_ACT without proper conditions', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');

      // Try without confidence
      const context1: ModeContext = {
        tenantId,
        confidenceScore: 70, // Below threshold
        envelopeApproved: true,
        scoringStable: true,
      };
      const log1 = manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        context1,
        'Attempt with low confidence'
      );

      expect(log1.approved).toBe(false);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);

      // Try without envelope approval
      const context2: ModeContext = {
        tenantId,
        confidenceScore: 90,
        envelopeApproved: false,
        scoringStable: true,
      };
      const log2 = manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        context2,
        'Attempt without envelope'
      );

      expect(log2.approved).toBe(false);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);
    });

    test('should allow safe downgrades (ADVISE → OBSERVE)', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');

      const log = manager.transition(
        tenantId,
        SystemMode.OBSERVE,
        { tenantId },
        'Downgrade to observe'
      );

      expect(log.approved).toBe(true);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.OBSERVE);
    });

    test('should auto-downgrade CONSTRAINED_ACT on low confidence', () => {
      // Setup CONSTRAINED_ACT mode
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');
      manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        {
          tenantId,
          confidenceScore: 90,
          envelopeApproved: true,
          scoringStable: true,
        },
        'Setup'
      );

      // Trigger downgrade
      const context: ModeContext = {
        tenantId,
        confidenceScore: 70, // Below threshold
        envelopeApproved: true,
        scoringStable: true,
      };
      const log = manager.transition(
        tenantId,
        SystemMode.ADVISE,
        context,
        'Confidence dropped'
      );

      expect(log.approved).toBe(true);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);
    });
  });

  describe('HOLD Mode Transitions', () => {
    test('should transition to HOLD on repeated violations', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');

      const context: ModeContext = {
        tenantId,
        violationCount: 3,
        lastViolationAt: new Date(),
      };
      const log = manager.transition(
        tenantId,
        SystemMode.HOLD,
        context,
        'Repeated violations detected'
      );

      expect(log.approved).toBe(true);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.HOLD);
    });

    test('should not transition to HOLD without sufficient violations', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');

      const context: ModeContext = {
        tenantId,
        violationCount: 2, // Below threshold
        lastViolationAt: new Date(),
      };
      const log = manager.transition(
        tenantId,
        SystemMode.HOLD,
        context,
        'Attempted with insufficient violations'
      );

      expect(log.approved).toBe(false);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);
    });

    test('should not consider old violations', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');

      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 2); // 2 hours ago

      const context: ModeContext = {
        tenantId,
        violationCount: 3,
        lastViolationAt: oldDate, // Outside window
      };
      const log = manager.transition(
        tenantId,
        SystemMode.HOLD,
        context,
        'Old violations'
      );

      expect(log.approved).toBe(false);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);
    });

    test('should allow HOLD → OBSERVE recovery', () => {
      // Setup HOLD
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');
      manager.transition(
        tenantId,
        SystemMode.HOLD,
        {
          tenantId,
          violationCount: 3,
          lastViolationAt: new Date(),
        },
        'Violations'
      );

      // Recover
      const context: ModeContext = {
        tenantId,
        violationCount: 0,
      };
      const log = manager.transition(
        tenantId,
        SystemMode.OBSERVE,
        context,
        'Manual recovery'
      );

      expect(log.approved).toBe(true);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.OBSERVE);
    });
  });

  describe('LOCKDOWN Mode', () => {
    test('should allow emergency transition to LOCKDOWN from any mode', () => {
      const modes = [
        SystemMode.OBSERVE,
        SystemMode.ADVISE,
        SystemMode.CONSTRAINED_ACT,
        SystemMode.HOLD,
      ];

      modes.forEach(mode => {
        const testTenantId = `tenant-${mode}`;
        if (mode !== SystemMode.OBSERVE) {
          manager.transition(testTenantId, mode, { tenantId: testTenantId }, 'Setup');
        }

        const log = manager.lockdown(testTenantId, 'Critical security event');

        expect(log.approved).toBe(true);
        expect(log.nextState).toBe(SystemMode.LOCKDOWN);
        expect(manager.getCurrentMode(testTenantId)).toBe(SystemMode.LOCKDOWN);
      });
    });

    test('LOCKDOWN should override all actions', () => {
      manager.lockdown(tenantId, 'Emergency');

      expect(manager.canExecuteAction(tenantId)).toBe(false);
      expect(manager.canUseAI(tenantId)).toBe(false);
    });

    test('should allow LOCKDOWN → HOLD recovery', () => {
      manager.lockdown(tenantId, 'Emergency');

      const context: ModeContext = {
        tenantId,
        emergencyFlag: false,
      };
      const log = manager.transition(
        tenantId,
        SystemMode.HOLD,
        context,
        'Emergency cleared'
      );

      expect(log.approved).toBe(true);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.HOLD);
    });
  });

  describe('Invalid Transitions', () => {
    test('should block direct OBSERVE → CONSTRAINED_ACT', () => {
      const context: ModeContext = {
        tenantId,
        confidenceScore: 90,
        envelopeApproved: true,
        scoringStable: true,
      };
      const log = manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        context,
        'Invalid direct jump'
      );

      expect(log.approved).toBe(false);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.OBSERVE);
    });

    test('should block CONSTRAINED_ACT → OBSERVE direct jump', () => {
      // Setup CONSTRAINED_ACT
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Setup');
      manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        {
          tenantId,
          confidenceScore: 90,
          envelopeApproved: true,
          scoringStable: true,
        },
        'Setup'
      );

      // Try invalid direct transition
      const log = manager.transition(
        tenantId,
        SystemMode.OBSERVE,
        { tenantId },
        'Invalid direct jump'
      );

      expect(log.approved).toBe(false);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.CONSTRAINED_ACT);
    });
  });

  describe('Logging and History', () => {
    test('should log all transition attempts', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Step 1');
      manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        {
          tenantId,
          confidenceScore: 90,
          envelopeApproved: true,
          scoringStable: true,
        },
        'Step 2'
      );
      manager.transition(
        tenantId,
        SystemMode.OBSERVE,
        { tenantId },
        'Invalid step'
      ); // Should fail

      const history = manager.getTransitionHistory(tenantId);

      expect(history.length).toBe(2); // Only successful transitions
      expect(history[0].triggerReason).toBe('Step 1');
      expect(history[1].triggerReason).toBe('Step 2');
    });

    test('should include all required fields in logs', () => {
      const context: ModeContext = {
        tenantId,
        confidenceScore: 85,
      };
      const log = manager.transition(
        tenantId,
        SystemMode.ADVISE,
        context,
        'Test transition'
      );

      expect(log.previousState).toBeDefined();
      expect(log.nextState).toBeDefined();
      expect(log.triggerReason).toBeDefined();
      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.tenantId).toBe(tenantId);
      expect(log.context).toBeDefined();
      expect(log.approved).toBeDefined();
    });

    test('should limit history to last 100 transitions', () => {
      // Create 150 transitions
      for (let i = 0; i < 150; i++) {
        manager.transition(
          tenantId,
          i % 2 === 0 ? SystemMode.ADVISE : SystemMode.OBSERVE,
          { tenantId },
          `Transition ${i}`
        );
      }

      const history = manager.getTransitionHistory(tenantId);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Action Permissions', () => {
    test('canExecuteAction should only allow in CONSTRAINED_ACT', () => {
      expect(manager.canExecuteAction(tenantId)).toBe(false); // OBSERVE

      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Test');
      expect(manager.canExecuteAction(tenantId)).toBe(false); // ADVISE

      manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        {
          tenantId,
          confidenceScore: 90,
          envelopeApproved: true,
          scoringStable: true,
        },
        'Test'
      );
      expect(manager.canExecuteAction(tenantId)).toBe(true); // CONSTRAINED_ACT
    });

    test('canUseAI should allow in ADVISE and CONSTRAINED_ACT', () => {
      expect(manager.canUseAI(tenantId)).toBe(false); // OBSERVE

      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Test');
      expect(manager.canUseAI(tenantId)).toBe(true); // ADVISE

      manager.transition(
        tenantId,
        SystemMode.CONSTRAINED_ACT,
        {
          tenantId,
          confidenceScore: 90,
          envelopeApproved: true,
          scoringStable: true,
        },
        'Test'
      );
      expect(manager.canUseAI(tenantId)).toBe(true); // CONSTRAINED_ACT
    });
  });

  describe('State Validation', () => {
    test('should validate correct state', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Test');
      expect(manager.validate(tenantId)).toBe(true);
    });

    test('should handle missing state gracefully', () => {
      expect(manager.validate('non-existent-tenant')).toBe(true);
    });
  });

  describe('Tenant Isolation', () => {
    test('should maintain separate states per tenant', () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      manager.transition(tenant1, SystemMode.ADVISE, { tenantId: tenant1 }, 'Test');
      // tenant2 stays in OBSERVE

      expect(manager.getCurrentMode(tenant1)).toBe(SystemMode.ADVISE);
      expect(manager.getCurrentMode(tenant2)).toBe(SystemMode.OBSERVE);
    });

    test('should not leak history between tenants', () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      manager.transition(tenant1, SystemMode.ADVISE, { tenantId: tenant1 }, 'T1 Move');
      manager.transition(tenant2, SystemMode.ADVISE, { tenantId: tenant2 }, 'T2 Move');

      const history1 = manager.getTransitionHistory(tenant1);
      const history2 = manager.getTransitionHistory(tenant2);

      expect(history1.length).toBe(1);
      expect(history2.length).toBe(1);
      expect(history1[0].tenantId).toBe(tenant1);
      expect(history2[0].tenantId).toBe(tenant2);
    });
  });

  describe('Reset Functionality', () => {
    test('should reset tenant state', () => {
      manager.transition(tenantId, SystemMode.ADVISE, { tenantId }, 'Test');
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.ADVISE);

      manager.reset(tenantId);
      expect(manager.getCurrentMode(tenantId)).toBe(SystemMode.OBSERVE);
      expect(manager.getTransitionHistory(tenantId)).toEqual([]);
    });
  });
});
