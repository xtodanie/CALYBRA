export type PatternCategory = "financial" | "behavioral" | "operational" | "risk";
export type Comparator = ">" | ">=" | "<" | "<=" | "=";

export interface DslCondition {
  readonly metric: string;
  readonly comparator: Comparator;
  readonly threshold: number | boolean;
  readonly overPeriods: number;
}

export interface PatternDsl {
  readonly id: string;
  readonly category: PatternCategory;
  readonly when: readonly DslCondition[];
  readonly thenEmit: string;
  readonly minEvidenceCount: number;
  readonly enabled: true;
}

export type ReplayMetricSeries = Record<string, readonly number[]>;

function evaluateComparator(left: number | boolean, comparator: Comparator, right: number | boolean) {
  if (typeof left === "boolean" || typeof right === "boolean") {
    return comparator === "=" && left === right;
  }
  if (comparator === ">") return left > right;
  if (comparator === ">=") return left >= right;
  if (comparator === "<") return left < right;
  if (comparator === "<=") return left <= right;
  return left === right;
}

export function evaluatePatternDsl(dsl: PatternDsl, metrics: ReplayMetricSeries): {
  readonly matched: boolean;
  readonly evidenceCount: number;
} {
  let evidenceCount = 0;
  for (const condition of dsl.when) {
    const series = metrics[condition.metric] ?? [];
    const slice = series.slice(Math.max(0, series.length - condition.overPeriods));
    if (slice.length === 0) {
      return { matched: false, evidenceCount };
    }
    const latest = slice[slice.length - 1] ?? 0;
    const ok = evaluateComparator(latest, condition.comparator, condition.threshold);
    if (!ok) {
      return { matched: false, evidenceCount };
    }
    evidenceCount += slice.length;
  }
  return { matched: evidenceCount >= dsl.minEvidenceCount, evidenceCount };
}
