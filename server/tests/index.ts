/**
 * Server tests barrel export
 * 
 * Test categories:
 * 
 * /logic - Pure function tests validating determinism
 *   - amount.test.ts: Money arithmetic with banker's rounding
 *   - scoring.test.ts: Match scoring algorithm
 *   - extractBankTx.test.ts: CSV parsing and date/amount extraction
 *   - computeMonthClose.test.ts: Month close calculation
 * 
 * /state - State machine tests
 *   - statusMachine.test.ts: Transition validation
 *   - invariants.test.ts: Business rule enforcement
 * 
 * /workflows - Orchestration tests
 *   - workflow.contracts.test.ts: Input/output contracts and idempotency
 * 
 * /accounting - Recomputability tests
 *   - recomputability.test.ts: Delete and rebuild invariant
 * 
 * Run with: npm test -- --testPathPattern=server/tests
 */
