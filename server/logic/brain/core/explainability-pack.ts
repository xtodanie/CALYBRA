import { stableSha256Hex } from "./hash";

export interface ExplainabilityPackInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly escalationId: string;
  readonly policyPath: string;
  readonly evidenceRefs: readonly string[];
  readonly replayHash: string;
  readonly healthIndex: number;
  readonly generatedAt: string;
}

export interface ExplainabilityPack {
  readonly packId: string;
  readonly tenantId: string;
  readonly monthKey: string;
  readonly escalationId: string;
  readonly policyPath: string;
  readonly evidenceRefs: readonly string[];
  readonly replayHash: string;
  readonly healthIndex: number;
  readonly generatedAt: string;
  readonly hash: string;
}

export function buildExplainabilityPack(input: ExplainabilityPackInput): ExplainabilityPack {
  const hash = stableSha256Hex({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    escalationId: input.escalationId,
    policyPath: input.policyPath,
    evidenceRefs: [...input.evidenceRefs].sort((a, b) => a.localeCompare(b)),
    replayHash: input.replayHash,
    healthIndex: input.healthIndex,
    generatedAt: input.generatedAt,
  });

  return {
    packId: `xpk:${hash.slice(0, 24)}`,
    ...input,
    hash,
  };
}
