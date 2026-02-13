export interface ImprovementLedgerEntry {
  readonly domain: "finance" | "ops" | "staff" | "supplier";
  readonly netImprovementPct: number;
  readonly roi: number;
  readonly success: boolean;
}

export interface ImprovementLedgerSummary {
  readonly domain: string;
  readonly netImprovementPct: number;
  readonly avgRoi: number;
  readonly successRatio: number;
  readonly count: number;
}

export function summarizeImprovementLedger(
  entries: readonly ImprovementLedgerEntry[]
): readonly ImprovementLedgerSummary[] {
  const grouped = new Map<string, ImprovementLedgerEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.domain) ?? [];
    list.push(entry);
    grouped.set(entry.domain, list);
  }
  const summaries: ImprovementLedgerSummary[] = [];
  for (const [domain, list] of grouped.entries()) {
    const count = list.length;
    const netImprovementPct = list.reduce((sum, item) => sum + item.netImprovementPct, 0) / count;
    const avgRoi = list.reduce((sum, item) => sum + item.roi, 0) / count;
    const successRatio = list.filter((item) => item.success).length / count;
    summaries.push({
      domain,
      netImprovementPct: Number(netImprovementPct.toFixed(4)),
      avgRoi: Number(avgRoi.toFixed(4)),
      successRatio: Number(successRatio.toFixed(4)),
      count,
    });
  }
  return summaries.sort((a, b) => a.domain.localeCompare(b.domain));
}
