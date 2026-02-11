/**
 * Performance Budget / SLO Tracking
 *
 * INVARIANT: Tracking never blocks execution
 * INVARIANT: Exceeding budgets never changes behavior
 */

export interface SloBudget {
  name: string;
  maxDurationMs: number;
  percentile?: number; // e.g. 95 for P95
}

export interface SloViolation {
  name: string;
  durationMs: number;
  budgetMs: number;
  timestamp: number;
  traceId?: string;
  workflowExecutionId?: string;
}

export interface SloStats {
  name: string;
  count: number;
  violations: number;
  violationRate: number;
  lastViolation?: SloViolation;
}

export class SloTracker {
  private budgets = new Map<string, SloBudget>();
  private stats = new Map<string, SloStats>();
  private violations: SloViolation[] = [];
  private maxViolations: number;

  constructor(options: { maxViolations?: number } = {}) {
    this.maxViolations = options.maxViolations ?? 500;
  }

  /**
   * Register a budget
   */
  registerBudget(budget: SloBudget): void {
    this.budgets.set(budget.name, budget);
    if (!this.stats.has(budget.name)) {
      this.stats.set(budget.name, {
        name: budget.name,
        count: 0,
        violations: 0,
        violationRate: 0,
      });
    }
  }

  /**
   * Record a timing against budgets
   */
  record(name: string, durationMs: number, context?: { traceId?: string; workflowExecutionId?: string }): void {
    const budget = this.budgets.get(name);
    const stat = this.stats.get(name) ?? {
      name,
      count: 0,
      violations: 0,
      violationRate: 0,
    };

    stat.count += 1;

    if (budget && durationMs > budget.maxDurationMs) {
      stat.violations += 1;
      const violation: SloViolation = {
        name,
        durationMs,
        budgetMs: budget.maxDurationMs,
        timestamp: Date.now(),
        traceId: context?.traceId,
        workflowExecutionId: context?.workflowExecutionId,
      };
      stat.lastViolation = violation;

      this.violations.push(violation);
      if (this.violations.length > this.maxViolations) {
        this.violations.shift();
      }
    }

    stat.violationRate = stat.count > 0 ? stat.violations / stat.count : 0;
    this.stats.set(name, stat);
  }

  /**
   * Get stats for a budget
   */
  getStats(name: string): SloStats | undefined {
    return this.stats.get(name);
  }

  /**
   * Get all stats
   */
  getAllStats(): SloStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get recent violations
   */
  getViolations(): readonly SloViolation[] {
    return this.violations;
  }

  /**
   * Reset all stats
   */
  reset(): void {
    this.stats.clear();
    this.violations = [];
  }
}

// Global tracker
let globalSloTracker: SloTracker | undefined;

export function getSloTracker(): SloTracker {
  if (!globalSloTracker) {
    globalSloTracker = new SloTracker();
  }
  return globalSloTracker;
}

export function setSloTracker(tracker: SloTracker): void {
  globalSloTracker = tracker;
}
