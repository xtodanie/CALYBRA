import { sha256Hex } from "./deterministic";

export interface BaselineSnapshot {
  readonly baselineId: string;
  readonly tenantId: string;
  readonly domain: "finance" | "ops" | "staff" | "supplier";
  readonly values: Readonly<Record<string, number>>;
  readonly capturedAt: string;
  readonly hash: string;
}

export function createBaselineSnapshot(params: {
  baselineId: string;
  tenantId: string;
  domain: "finance" | "ops" | "staff" | "supplier";
  values: Record<string, number>;
  capturedAt: string;
}): BaselineSnapshot {
  const values = Object.freeze({ ...params.values });
  const hash = sha256Hex({
    baselineId: params.baselineId,
    tenantId: params.tenantId,
    domain: params.domain,
    values,
    capturedAt: params.capturedAt,
  });
  return Object.freeze({
    baselineId: params.baselineId,
    tenantId: params.tenantId,
    domain: params.domain,
    values,
    capturedAt: params.capturedAt,
    hash,
  });
}
