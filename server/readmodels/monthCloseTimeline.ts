/**
 * Month Close Timeline - read model
 * Pure projection logic. No IO, no randomness, no time.
 */

import { CounterfactualTimelineEntry } from "../logic/counterfactual/counterfactualClose";

export interface MonthCloseTimelineReadModel {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly periodEnd: string; // YYYY-MM-DD
  readonly asOfDays: readonly number[];
  readonly entries: readonly CounterfactualTimelineEntry[];
  readonly insights: readonly string[];
  readonly generatedAt: string; // ISO timestamp
  readonly periodLockHash: string;
  readonly schemaVersion: 1;
}

export function buildMonthCloseTimelineReadModel(input: {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly periodEnd: string;
  readonly asOfDays: readonly number[];
  readonly entries: readonly CounterfactualTimelineEntry[];
  readonly insights: readonly string[];
  readonly generatedAt: string;
  readonly periodLockHash: string;
}): MonthCloseTimelineReadModel {
  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    periodEnd: input.periodEnd,
    asOfDays: [...input.asOfDays],
    entries: [...input.entries],
    insights: [...input.insights],
    generatedAt: input.generatedAt,
    periodLockHash: input.periodLockHash,
    schemaVersion: 1,
  };
}
