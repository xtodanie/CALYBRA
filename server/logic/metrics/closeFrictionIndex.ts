/**
 * Close Friction Index - derived metrics
 * Pure logic. No IO, no randomness, no time.
 */

import { Event, dateKeyFromIso, addDaysToDateKey } from "../../domain/events";
import { CounterfactualTimelineEntry } from "../counterfactual/counterfactualClose";
import { bankersRound } from "../../domain/money/rounding";

export interface CloseFrictionInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly periodEnd: string; // YYYY-MM-DD
  readonly asOfDays: readonly number[];
  readonly dayForLateArrival: number;
  readonly events: readonly Event[];
  readonly timeline: readonly CounterfactualTimelineEntry[];
}

export interface CloseFrictionResult {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly lateArrivalPercent: number;
  readonly adjustmentAfterClosePercent: number;
  readonly reconciliationHalfLifeDays: number;
  readonly closeFrictionScore: number;
}

export function computeCloseFrictionIndex(
  input: CloseFrictionInput
): CloseFrictionResult {
  const monthEvents = input.events.filter(
    (event) => event.monthKey === input.monthKey
  );

  const totalEventCount = monthEvents.length;
  const lateArrivalCutoff = addDaysToDateKey(
    input.periodEnd,
    input.dayForLateArrival
  );

  const lateArrivalCount = monthEvents.filter(
    (event) => dateKeyFromIso(event.recordedAt) > lateArrivalCutoff
  ).length;

  const adjustments = monthEvents.filter(
    (event) => event.type === "ADJUSTMENT_POSTED"
  );
  const adjustmentsAfterClose = adjustments.filter(
    (event) => dateKeyFromIso(event.occurredAt) > input.periodEnd
  ).length;

  const lateArrivalPercent = totalEventCount === 0
    ? 0
    : bankersRound((lateArrivalCount / totalEventCount) * 100);

  const adjustmentAfterClosePercent = adjustments.length === 0
    ? 0
    : bankersRound((adjustmentsAfterClose / adjustments.length) * 100);

  const reconciliationHalfLifeDays = computeHalfLifeDays(
    input.timeline,
    input.asOfDays
  );

  const closeFrictionScore = clamp(
    0,
    100,
    100 -
      bankersRound(
        lateArrivalPercent * 0.5 +
          adjustmentAfterClosePercent * 0.3 +
          reconciliationHalfLifeDays * 2
      )
  );

  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    lateArrivalPercent,
    adjustmentAfterClosePercent,
    reconciliationHalfLifeDays,
    closeFrictionScore,
  };
}

function computeHalfLifeDays(
  timeline: readonly CounterfactualTimelineEntry[],
  asOfDays: readonly number[]
): number {
  if (timeline.length === 0) return 0;
  const finalEntry = timeline[timeline.length - 1];
  const baseline = timeline[0];
  const initialVariance = calculateVariance(baseline, finalEntry);
  if (initialVariance === 0) return 0;

  const threshold = initialVariance * 0.1;
  for (let i = 0; i < timeline.length; i += 1) {
    const entry = timeline[i];
    const variance = calculateVariance(entry, finalEntry);
    if (variance <= threshold) {
      if (entry.asOfDay === null) {
        return asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
      }
      return entry.asOfDay;
    }
  }

  return asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
}

function calculateVariance(
  entry: CounterfactualTimelineEntry,
  finalEntry: CounterfactualTimelineEntry
): number {
  return (
    Math.abs(entry.revenueCents - finalEntry.revenueCents) +
    Math.abs(entry.expenseCents - finalEntry.expenseCents) +
    Math.abs(entry.vatCents - finalEntry.vatCents) +
    Math.abs(entry.unmatchedTotalCount - finalEntry.unmatchedTotalCount)
  );
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}
