/**
 * ZEREBROX CALYBRA OS - Mode Manager
 * 
 * Purpose: Controls system autonomy level using an explicit state machine.
 * All transitions are rule-based and logged. No direct jumps allowed.
 */

export enum SystemMode {
  OBSERVE = "OBSERVE",
  ADVISE = "ADVISE",
  CONSTRAINED_ACT = "CONSTRAINED_ACT",
  HOLD = "HOLD",
  LOCKDOWN = "LOCKDOWN",
}

export interface ModeTransitionRule {
  from: SystemMode;
  to: SystemMode;
  condition: (context: ModeContext) => boolean;
  requiresApproval?: boolean;
}

export interface ModeContext {
  tenantId: string;
  confidenceScore?: number;
  envelopeApproved?: boolean;
  scoringStable?: boolean;
  violationCount?: number;
  lastViolationAt?: Date;
  emergencyFlag?: boolean;
}

export interface ModeTransitionLog {
  previousState: SystemMode;
  nextState: SystemMode;
  triggerReason: string;
  timestamp: Date;
  tenantId: string;
  context: ModeContext;
  approved: boolean;
}

export interface ModeState {
  currentMode: SystemMode;
  tenantId: string;
  lastTransitionAt: Date;
  transitionHistory: ModeTransitionLog[];
}

/**
 * Mode Manager - Deterministic finite state machine for system autonomy control
 */
export class ModeManager {
  private states: Map<string, ModeState> = new Map();
  private transitionRules: ModeTransitionRule[] = [];
  private readonly DEFAULT_MODE = SystemMode.OBSERVE;

  // Configuration thresholds
  private readonly CONFIDENCE_THRESHOLD = 85;
  private readonly VIOLATION_THRESHOLD = 3;
  private readonly VIOLATION_WINDOW_MS = 3600000; // 1 hour

  constructor() {
    this.initializeTransitionRules();
  }

  /**
   * Initialize all valid state transitions
   */
  private initializeTransitionRules(): void {
    // OBSERVE → ADVISE (safe progression)
    this.transitionRules.push({
      from: SystemMode.OBSERVE,
      to: SystemMode.ADVISE,
      condition: (ctx) => true, // Always allowed
    });

    // ADVISE → CONSTRAINED_ACT (requires validation)
    this.transitionRules.push({
      from: SystemMode.ADVISE,
      to: SystemMode.CONSTRAINED_ACT,
      condition: (ctx) =>
        (ctx.confidenceScore ?? 0) >= this.CONFIDENCE_THRESHOLD &&
        ctx.envelopeApproved === true &&
        ctx.scoringStable === true,
      requiresApproval: true,
    });

    // ADVISE → OBSERVE (safe downgrade)
    this.transitionRules.push({
      from: SystemMode.ADVISE,
      to: SystemMode.OBSERVE,
      condition: (ctx) => true,
    });

    // CONSTRAINED_ACT → ADVISE (on issues)
    this.transitionRules.push({
      from: SystemMode.CONSTRAINED_ACT,
      to: SystemMode.ADVISE,
      condition: (ctx) =>
        (ctx.confidenceScore ?? 0) < this.CONFIDENCE_THRESHOLD ||
        ctx.envelopeApproved === false ||
        ctx.scoringStable === false,
    });

    // CONSTRAINED_ACT → HOLD (on repeated violations)
    this.transitionRules.push({
      from: SystemMode.CONSTRAINED_ACT,
      to: SystemMode.HOLD,
      condition: (ctx) => this.hasRepeatedViolations(ctx),
    });

    // Any mode → HOLD (on disagreement/escalation)
    [SystemMode.OBSERVE, SystemMode.ADVISE, SystemMode.CONSTRAINED_ACT].forEach(from => {
      this.transitionRules.push({
        from,
        to: SystemMode.HOLD,
        condition: (ctx) => this.hasRepeatedViolations(ctx),
      });
    });

    // Any mode → LOCKDOWN (emergency)
    Object.values(SystemMode)
      .filter(mode => mode !== SystemMode.LOCKDOWN)
      .forEach(from => {
        this.transitionRules.push({
          from: from as SystemMode,
          to: SystemMode.LOCKDOWN,
          condition: (ctx) => ctx.emergencyFlag === true,
          requiresApproval: false, // Emergency override
        });
      });

    // HOLD → OBSERVE (manual recovery)
    this.transitionRules.push({
      from: SystemMode.HOLD,
      to: SystemMode.OBSERVE,
      condition: (ctx) => !this.hasRepeatedViolations(ctx),
      requiresApproval: true,
    });

    // LOCKDOWN → HOLD (manual recovery start)
    this.transitionRules.push({
      from: SystemMode.LOCKDOWN,
      to: SystemMode.HOLD,
      condition: (ctx) => ctx.emergencyFlag === false,
      requiresApproval: true,
    });
  }

  /**
   * Check if there are repeated violations within time window
   */
  private hasRepeatedViolations(context: ModeContext): boolean {
    if (!context.violationCount || !context.lastViolationAt) {
      return false;
    }

    const timeSinceViolation = Date.now() - context.lastViolationAt.getTime();
    return (
      context.violationCount >= this.VIOLATION_THRESHOLD &&
      timeSinceViolation < this.VIOLATION_WINDOW_MS
    );
  }

  /**
   * Get current mode for a tenant (initializes to OBSERVE if not set)
   */
  getCurrentMode(tenantId: string): SystemMode {
    const state = this.states.get(tenantId);
    if (!state) {
      // Initialize default state
      this.states.set(tenantId, {
        currentMode: this.DEFAULT_MODE,
        tenantId,
        lastTransitionAt: new Date(),
        transitionHistory: [],
      });
      return this.DEFAULT_MODE;
    }
    return state.currentMode;
  }

  /**
   * Attempt to transition to a new mode
   * Returns true if transition successful, false otherwise
   */
  transition(
    tenantId: string,
    targetMode: SystemMode,
    context: ModeContext,
    triggerReason: string
  ): ModeTransitionLog {
    const currentMode = this.getCurrentMode(tenantId);

    // Check if transition is to same state (no-op)
    if (currentMode === targetMode) {
      return this.createTransitionLog(
        currentMode,
        currentMode,
        'No transition needed (already in target state)',
        tenantId,
        context,
        true
      );
    }

    // Find applicable rule
    const rule = this.transitionRules.find(
      r => r.from === currentMode && r.to === targetMode
    );

    if (!rule) {
      return this.createTransitionLog(
        currentMode,
        currentMode,
        `Invalid transition: No rule from ${currentMode} to ${targetMode}`,
        tenantId,
        context,
        false
      );
    }

    // Evaluate condition
    const conditionMet = rule.condition(context);
    if (!conditionMet) {
      return this.createTransitionLog(
        currentMode,
        currentMode,
        `Transition blocked: Condition not met for ${currentMode} → ${targetMode}`,
        tenantId,
        context,
        false
      );
    }

    // Execute transition
    const log = this.createTransitionLog(
      currentMode,
      targetMode,
      triggerReason,
      tenantId,
      context,
      true
    );

    // Update state
    const state = this.states.get(tenantId)!;
    state.currentMode = targetMode;
    state.lastTransitionAt = log.timestamp;
    state.transitionHistory.push(log);

    // Keep only last 100 transitions
    if (state.transitionHistory.length > 100) {
      state.transitionHistory = state.transitionHistory.slice(-100);
    }

    return log;
  }

  /**
   * Create transition log entry
   */
  private createTransitionLog(
    from: SystemMode,
    to: SystemMode,
    reason: string,
    tenantId: string,
    context: ModeContext,
    approved: boolean
  ): ModeTransitionLog {
    return {
      previousState: from,
      nextState: to,
      triggerReason: reason,
      timestamp: new Date(),
      tenantId,
      context: { ...context },
      approved,
    };
  }

  /**
   * Force transition to LOCKDOWN (emergency override)
   */
  lockdown(tenantId: string, reason: string): ModeTransitionLog {
    const context: ModeContext = {
      tenantId,
      emergencyFlag: true,
    };
    return this.transition(tenantId, SystemMode.LOCKDOWN, context, reason);
  }

  /**
   * Check if action is allowed in current mode
   */
  canExecuteAction(tenantId: string): boolean {
    const mode = this.getCurrentMode(tenantId);
    return mode === SystemMode.CONSTRAINED_ACT;
  }

  /**
   * Check if AI recommendations are allowed in current mode
   */
  canUseAI(tenantId: string): boolean {
    const mode = this.getCurrentMode(tenantId);
    return [SystemMode.ADVISE, SystemMode.CONSTRAINED_ACT].includes(mode);
  }

  /**
   * Get transition history for a tenant
   */
  getTransitionHistory(tenantId: string): ModeTransitionLog[] {
    const state = this.states.get(tenantId);
    return state ? [...state.transitionHistory] : [];
  }

  /**
   * Get full state for a tenant
   */
  getState(tenantId: string): ModeState | null {
    const state = this.states.get(tenantId);
    return state ? { ...state } : null;
  }

  /**
   * Reset mode to default (for testing/recovery)
   */
  reset(tenantId: string): void {
    this.states.delete(tenantId);
  }

  /**
   * Validate mode state consistency
   */
  validate(tenantId: string): boolean {
    const state = this.states.get(tenantId);
    if (!state) return true; // No state yet is valid

    return (
      Object.values(SystemMode).includes(state.currentMode) &&
      state.tenantId === tenantId &&
      state.lastTransitionAt instanceof Date &&
      Array.isArray(state.transitionHistory)
    );
  }
}

/**
 * Factory function for creating mode manager
 */
export function createModeManager(): ModeManager {
  return new ModeManager();
}
