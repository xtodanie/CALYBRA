/**
 * Server module - Business Logic Layer
 * 
 * This module contains all server-side business logic for Calybra.
 * 
 * Architecture:
 * 
 * /domain     - Pure value objects and entities (no IO, no side effects)
 *   /money    - Currency, amounts, VAT calculations
 *   /dates    - Calendar months, date periods
 *   /ledger   - Transactions, invoices, matches
 * 
 * /state      - Status machines and transition logic
 *   - Status enums and valid transitions
 *   - Business invariants enforcement
 * 
 * /persistence - Firestore read/write operations
 *   - Document shapes and queries
 *   - WriteContext for deterministic timestamps
 * 
 * /logic      - Pure business logic functions
 *   /parsing   - File parsing, data extraction
 *   /matching  - Scoring, candidate selection
 *   /accounting - Balances, aggregates, reconciliation
 * 
 * /workflows  - Orchestration of business operations
 *   - Combines persistence + logic
 *   - Enforces state transitions
 *   - Idempotent operations
 * 
 * /tests      - Unit tests for all modules
 *   /logic      - Purity + determinism tests
 *   /workflows  - Orchestration + idempotency tests
 *   /accounting - Recomputability tests
 * 
 * Key invariants:
 * - No Date.now() or Math.random() in /domain or /logic
 * - IO only in /persistence, called only from /workflows
 * - All monetary calculations use cents (integers)
 * - Status transitions validated before persistence
 * 
 * USAGE:
 * Import from specific submodules:
 *   import { Amount, amountFromCents } from "./server/domain/money";
 *   import { MatchStatus, MATCH_STATUSES } from "./server/state/statusMachine";
 *   import { matchAllTransactions } from "./server/logic/matching";
 *   import { parseFileWorkflow } from "./server/workflows";
 * 
 * Or import from top-level with caution about naming conflicts:
 *   import * as server from "./server";
 */

// Domain layer: Pure value objects and entities
export * from "./domain/money";
export * from "./domain/dates";
// Note: Ledger exports exclude MatchStatus to avoid conflict with state module
export {
  // Transaction
  type Transaction,
  type TransactionInput,
  createTransaction,
  computeFingerprint,
  isDebit,
  isCredit,
  // Invoice
  type InvoiceInput,
  type Invoice,
  REVIEW_THRESHOLD,
  createInvoice,
  getInvoiceNet,
  // Match
  type Match,
  type MatchInput,
  type MatchType,
  MATCH_TYPES,
  createMatch,
  MATCH_SCORE_THRESHOLDS,
  isMatchHighConfidence,
  isExactMatch,
  doAmountsMatch,
} from "./domain/ledger";

// State layer: Status machines (canonical source for all status enums)
export * from "./state";

// Logic layer: Pure business logic
export * from "./logic";

// Workflow layer: Orchestration (calls persistence + logic)
export * from "./workflows";

// Note: Persistence module not exported from main index
// Import directly when needed: import { ... } from "./server/persistence"
