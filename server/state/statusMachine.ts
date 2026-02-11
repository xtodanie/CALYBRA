/**
 * Status Machine - Unified state transition system
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: All status changes go through this module
 * INVARIANT: Terminal states are immutable forever
 * INVARIANT: Only valid transitions are allowed
 */

// ============================================================================
// MONTH CLOSE STATUS
// ============================================================================

export const MONTH_CLOSE_STATUSES = ["DRAFT", "IN_REVIEW", "FINALIZED"] as const;
export type MonthCloseStatus = (typeof MONTH_CLOSE_STATUSES)[number];

export const MONTH_CLOSE_TRANSITIONS: Record<MonthCloseStatus, readonly MonthCloseStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["DRAFT", "FINALIZED"],
  FINALIZED: [],
} as const;

export const MONTH_CLOSE_TERMINAL: readonly MonthCloseStatus[] = ["FINALIZED"] as const;

// ============================================================================
// FILE ASSET STATUS
// ============================================================================

export const FILE_ASSET_STATUSES = ["PENDING_UPLOAD", "UPLOADED", "VERIFIED", "REJECTED", "DELETED"] as const;
export type FileAssetStatus = (typeof FILE_ASSET_STATUSES)[number];

export const FILE_ASSET_TRANSITIONS: Record<FileAssetStatus, readonly FileAssetStatus[]> = {
  PENDING_UPLOAD: ["UPLOADED", "DELETED"],
  UPLOADED: ["VERIFIED", "REJECTED", "DELETED"],
  VERIFIED: ["DELETED"],
  REJECTED: ["DELETED"],
  DELETED: [],
} as const;

export const FILE_ASSET_TERMINAL: readonly FileAssetStatus[] = ["DELETED"] as const;

// ============================================================================
// MATCH STATUS
// ============================================================================

export const MATCH_STATUSES = ["PROPOSED", "CONFIRMED", "REJECTED"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  PROPOSED: ["CONFIRMED", "REJECTED"],
  CONFIRMED: [],
  REJECTED: [],
} as const;

export const MATCH_TERMINAL: readonly MatchStatus[] = ["CONFIRMED", "REJECTED"] as const;

// ============================================================================
// FILE ASSET PARSE STATUS
// ============================================================================

export const PARSE_STATUSES = ["PENDING", "PARSED", "FAILED"] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export const PARSE_TRANSITIONS: Record<ParseStatus, readonly ParseStatus[]> = {
  PENDING: ["PARSED", "FAILED"],
  PARSED: [],
  FAILED: ["PENDING"], // Can retry
} as const;

export const PARSE_TERMINAL: readonly ParseStatus[] = ["PARSED"] as const;

// ============================================================================
// GENERIC STATUS MACHINE OPERATIONS
// ============================================================================

/**
 * Checks if a transition is valid for any status type
 */
export function isTransitionValid<T extends string>(
  from: T,
  to: T,
  transitions: Record<T, readonly T[]>
): boolean {
  const allowed = transitions[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Checks if a status is terminal
 */
export function isTerminal<T extends string>(
  status: T,
  terminalStates: readonly T[]
): boolean {
  return terminalStates.includes(status);
}

/**
 * Asserts that a transition is valid, throws if not
 */
export function assertTransitionValid<T extends string>(
  entity: string,
  from: T,
  to: T,
  transitions: Record<T, readonly T[]>
): void {
  if (!isTransitionValid(from, to, transitions)) {
    const allowed = transitions[from] ?? [];
    throw new Error(
      `Illegal ${entity} transition: '${from}' -> '${to}'. Allowed: [${allowed.join(", ")}]`
    );
  }
}

/**
 * Asserts that a status is not terminal
 */
export function assertNotTerminal<T extends string>(
  entity: string,
  status: T,
  terminalStates: readonly T[]
): void {
  if (isTerminal(status, terminalStates)) {
    throw new Error(
      `${entity} is in terminal status '${status}' and cannot be modified.`
    );
  }
}

// ============================================================================
// TYPED HELPERS FOR EACH ENTITY
// ============================================================================

/** MonthClose transition validation */
export function isMonthCloseTransitionValid(from: MonthCloseStatus, to: MonthCloseStatus): boolean {
  return isTransitionValid(from, to, MONTH_CLOSE_TRANSITIONS);
}

export function assertMonthCloseTransition(from: MonthCloseStatus, to: MonthCloseStatus): void {
  assertTransitionValid("MonthClose", from, to, MONTH_CLOSE_TRANSITIONS);
}

export function isMonthCloseTerminal(status: MonthCloseStatus): boolean {
  return isTerminal(status, MONTH_CLOSE_TERMINAL);
}

export function assertMonthCloseNotTerminal(status: MonthCloseStatus): void {
  assertNotTerminal("MonthClose", status, MONTH_CLOSE_TERMINAL);
}

/** FileAsset transition validation */
export function isFileAssetTransitionValid(from: FileAssetStatus, to: FileAssetStatus): boolean {
  return isTransitionValid(from, to, FILE_ASSET_TRANSITIONS);
}

export function assertFileAssetTransition(from: FileAssetStatus, to: FileAssetStatus): void {
  assertTransitionValid("FileAsset", from, to, FILE_ASSET_TRANSITIONS);
}

export function isFileAssetTerminal(status: FileAssetStatus): boolean {
  return isTerminal(status, FILE_ASSET_TERMINAL);
}

export function assertFileAssetNotTerminal(status: FileAssetStatus): void {
  assertNotTerminal("FileAsset", status, FILE_ASSET_TERMINAL);
}

/** Match transition validation */
export function isMatchTransitionValid(from: MatchStatus, to: MatchStatus): boolean {
  return isTransitionValid(from, to, MATCH_TRANSITIONS);
}

export function assertMatchTransition(from: MatchStatus, to: MatchStatus): void {
  assertTransitionValid("Match", from, to, MATCH_TRANSITIONS);
}

export function isMatchTerminal(status: MatchStatus): boolean {
  return isTerminal(status, MATCH_TERMINAL);
}

export function assertMatchNotTerminal(status: MatchStatus): void {
  assertNotTerminal("Match", status, MATCH_TERMINAL);
}

/** ParseStatus transition validation */
export function isParseTransitionValid(from: ParseStatus, to: ParseStatus): boolean {
  return isTransitionValid(from, to, PARSE_TRANSITIONS);
}

export function assertParseTransition(from: ParseStatus, to: ParseStatus): void {
  assertTransitionValid("ParseStatus", from, to, PARSE_TRANSITIONS);
}
