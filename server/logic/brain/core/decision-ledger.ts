export interface DecisionLedgerEntry {
  readonly decisionType: string;
  readonly roi: number;
  readonly success: boolean;
  readonly aiSuggested: boolean;
  readonly overridden: boolean;
}

export interface DecisionLedgerSummary {
  readonly successRate: number;
  readonly falsePositiveRate: number;
  readonly avgRoi: number;
  readonly aiSuggestionAccuracy: number;
  readonly humanOverrideFrequency: number;
}

export function summarizeDecisionLedger(entries: readonly DecisionLedgerEntry[]): DecisionLedgerSummary {
  const count = Math.max(1, entries.length);
  const successCount = entries.filter((entry) => entry.success).length;
  const falsePositiveCount = entries.filter((entry) => !entry.success).length;
  const avgRoi = entries.reduce((sum, entry) => sum + entry.roi, 0) / count;
  const aiEntries = entries.filter((entry) => entry.aiSuggested);
  const aiSuccess = aiEntries.filter((entry) => entry.success).length;
  const overrideCount = entries.filter((entry) => entry.overridden).length;
  return {
    successRate: Number((successCount / count).toFixed(4)),
    falsePositiveRate: Number((falsePositiveCount / count).toFixed(4)),
    avgRoi: Number(avgRoi.toFixed(4)),
    aiSuggestionAccuracy: Number((aiEntries.length === 0 ? 0 : aiSuccess / aiEntries.length).toFixed(4)),
    humanOverrideFrequency: Number((overrideCount / count).toFixed(4)),
  };
}
