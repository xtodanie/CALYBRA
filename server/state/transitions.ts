/**
 * Transitions - Status transition results
 * Pure types. No IO, no randomness, no time.
 */

import {
  MonthCloseStatus,
  FileAssetStatus,
  MatchStatus,
  ParseStatus,
} from "./statusMachine";

/**
 * Result of a successful transition
 */
export interface TransitionResult<T extends string> {
  readonly success: true;
  readonly fromStatus: T;
  readonly toStatus: T;
  readonly entityId: string;
}

/**
 * Result of a failed transition
 */
export interface TransitionError<T extends string> {
  readonly success: false;
  readonly fromStatus: T;
  readonly toStatus: T;
  readonly entityId: string;
  readonly reason: string;
}

/**
 * Union type for transition outcomes
 */
export type TransitionOutcome<T extends string> = TransitionResult<T> | TransitionError<T>;

/**
 * Creates a successful transition result
 */
export function transitionSuccess<T extends string>(
  entityId: string,
  fromStatus: T,
  toStatus: T
): TransitionResult<T> {
  return {
    success: true,
    fromStatus,
    toStatus,
    entityId,
  };
}

/**
 * Creates a failed transition result
 */
export function transitionError<T extends string>(
  entityId: string,
  fromStatus: T,
  toStatus: T,
  reason: string
): TransitionError<T> {
  return {
    success: false,
    fromStatus,
    toStatus,
    entityId,
    reason,
  };
}

// ============================================================================
// TYPED TRANSITION OUTCOMES
// ============================================================================

export type MonthCloseTransitionOutcome = TransitionOutcome<MonthCloseStatus>;
export type FileAssetTransitionOutcome = TransitionOutcome<FileAssetStatus>;
export type MatchTransitionOutcome = TransitionOutcome<MatchStatus>;
export type ParseTransitionOutcome = TransitionOutcome<ParseStatus>;
