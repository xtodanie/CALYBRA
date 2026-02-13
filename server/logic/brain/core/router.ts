import { AIResponse, validateAIIsolationBoundary } from "../contracts/ai-response";
import { CanonicalEventEnvelope, toEventHashMaterial } from "../contracts/event-envelope";
import { stableSha256Hex } from "./hash";

export type BrainIntent = "observe" | "analyze" | "suggest" | "escalate" | "block";

export interface RouterRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly role: string;
  readonly policyPath: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly aiResponse?: AIResponse;
}

export interface RouterResult {
  readonly intent: BrainIntent;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly event: CanonicalEventEnvelope;
}

function classifyIntent(request: RouterRequest): BrainIntent {
  if (request.aiResponse && request.aiResponse.suggestions.length > 0) {
    return "suggest";
  }
  if (request.input["forceEscalation"] === true) {
    return "escalate";
  }
  if (request.input["block"] === true) {
    return "block";
  }
  if (request.input["analyze"] === true) {
    return "analyze";
  }
  return "observe";
}

export function routeDeterministic(request: RouterRequest): RouterResult {
  const intent = classifyIntent(request);
  const reasons: string[] = [];
  let accepted = true;

  if (request.aiResponse) {
    const boundary = validateAIIsolationBoundary(request.aiResponse);
    if (!boundary.accepted) {
      accepted = false;
      reasons.push(...boundary.reasons);
    }
  }

  if (intent === "block") {
    accepted = false;
    reasons.push("blocked by deterministic router policy");
  }

  const payload = {
    requestId: request.id,
    intent,
    accepted,
    reasons,
    input: request.input,
    aiSuggestionCount: request.aiResponse?.suggestions.length ?? 0,
  };

  const eventMaterial = {
    id: `router:${request.id}`,
    type: "brain.router",
    actor: {
      tenantId: request.tenantId,
      actorId: request.actorId,
      actorType: request.aiResponse ? "ai" : "service",
      role: request.role,
    } as const,
    context: {
      tenantId: request.tenantId,
      traceId: request.traceId,
      policyPath: request.policyPath,
      readOnly: true,
    } as const,
    payload,
    timestamp: request.timestamp,
    parent_id: undefined,
  };

  const event: CanonicalEventEnvelope = {
    ...eventMaterial,
    hash: stableSha256Hex(toEventHashMaterial(eventMaterial)),
  };

  return { intent, accepted, reasons, event };
}
