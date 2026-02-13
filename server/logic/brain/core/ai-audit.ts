import { AIResponse } from "../contracts/ai-response";
import { stableSha256Hex } from "./hash";

export interface AIAuditRecord {
  readonly auditId: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly promptHash: string;
  readonly contextHash: string;
  readonly tokenUsage: {
    readonly input: number;
    readonly output: number;
    readonly total: number;
  };
  readonly model: string;
  readonly responseHash: string;
  readonly decisionMap: Readonly<Record<string, string>>;
  readonly atIso: string;
}

export function buildAIAuditRecord(params: {
  readonly tenantId: string;
  readonly traceId: string;
  readonly prompt: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly tokenUsage: { readonly input: number; readonly output: number };
  readonly response: AIResponse;
  readonly decisionMap: Readonly<Record<string, string>>;
  readonly atIso: string;
}): AIAuditRecord {
  const tokenTotal = params.tokenUsage.input + params.tokenUsage.output;
  const promptHash = stableSha256Hex(params.prompt);
  const contextHash = stableSha256Hex(params.context);
  const responseHash = stableSha256Hex(params.response);
  const auditId = `audit:${stableSha256Hex({
    tenantId: params.tenantId,
    traceId: params.traceId,
    promptHash,
    contextHash,
    responseHash,
    atIso: params.atIso,
  }).slice(0, 24)}`;

  return {
    auditId,
    tenantId: params.tenantId,
    traceId: params.traceId,
    promptHash,
    contextHash,
    tokenUsage: {
      input: params.tokenUsage.input,
      output: params.tokenUsage.output,
      total: tokenTotal,
    },
    model: params.response.model,
    responseHash,
    decisionMap: params.decisionMap,
    atIso: params.atIso,
  };
}
