/**
 * Close Friction - read model
 * Pure projection logic. No IO, no randomness, no time.
 */

import { CloseFrictionResult } from "../logic/metrics/closeFrictionIndex";

export interface CloseFrictionReadModel extends CloseFrictionResult {
  readonly periodEnd: string; // YYYY-MM-DD
  readonly dayForLateArrival: number;
  readonly generatedAt: string; // ISO timestamp
  readonly periodLockHash: string;
  readonly schemaVersion: 1;
}

export function buildCloseFrictionReadModel(input: {
  readonly result: CloseFrictionResult;
  readonly periodEnd: string;
  readonly dayForLateArrival: number;
  readonly generatedAt: string;
  readonly periodLockHash: string;
}): CloseFrictionReadModel {
  return {
    ...input.result,
    periodEnd: input.periodEnd,
    dayForLateArrival: input.dayForLateArrival,
    generatedAt: input.generatedAt,
    periodLockHash: input.periodLockHash,
    schemaVersion: 1,
  };
}
