import { AIResponse, validateAIIsolationBoundary } from "../contracts/ai-response";

export interface AIGateContext {
  readonly tenantId: string;
  readonly actorRole: string;
  readonly policyPath: string;
  readonly stateLocked: boolean;
  readonly conflictDetected: boolean;
}

export interface AIGateResult {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

const ALLOWED_ROLES = new Set(["owner", "admin", "auditor", "controller"]);

export function evaluateAIGate(params: {
  readonly response: AIResponse;
  readonly context: AIGateContext;
}): AIGateResult {
  const reasons: string[] = [];

  const boundary = validateAIIsolationBoundary(params.response);
  if (!boundary.accepted) {
    reasons.push(...boundary.reasons);
  }

  if (params.response.tenantId !== params.context.tenantId) {
    reasons.push("tenant mismatch");
  }

  if (!ALLOWED_ROLES.has(params.context.actorRole)) {
    reasons.push("actor role is not allowed for AI suggestion intake");
  }

  if (params.context.stateLocked) {
    reasons.push("state is locked");
  }

  if (params.context.conflictDetected) {
    reasons.push("conflict detected");
  }

  if (!params.context.policyPath.includes("read-only")) {
    reasons.push("policyPath must enforce read-only boundary");
  }

  return {
    accepted: reasons.length === 0,
    reasons,
  };
}
