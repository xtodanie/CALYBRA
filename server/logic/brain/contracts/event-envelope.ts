import { z } from "zod";

export const ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/;

export const eventActorSchema = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  actorType: z.enum(["system", "human", "service", "ai"]),
  role: z.string().min(1),
});

export const eventContextSchema = z.object({
  tenantId: z.string().min(1),
  traceId: z.string().min(1),
  policyPath: z.string().min(1),
  readOnly: z.boolean(),
});

export const eventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  actor: eventActorSchema,
  context: eventContextSchema,
  payload: z.record(z.unknown()),
  timestamp: z.string().regex(ISO_UTC_REGEX),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  parent_id: z.string().min(1).optional(),
});

export type CanonicalEventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export interface EventEnvelopeHashMaterial {
  readonly id: string;
  readonly type: string;
  readonly actor: CanonicalEventEnvelope["actor"];
  readonly context: CanonicalEventEnvelope["context"];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
  readonly parent_id?: string;
}

export function toEventHashMaterial(event: EventEnvelopeHashMaterial): EventEnvelopeHashMaterial {
  return {
    id: event.id,
    type: event.type,
    actor: event.actor,
    context: event.context,
    payload: event.payload,
    timestamp: event.timestamp,
    parent_id: event.parent_id,
  };
}

export function validateEventEnvelope(value: unknown): {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly event?: CanonicalEventEnvelope;
} {
  const parsed = eventEnvelopeSchema.safeParse(value);
  if (parsed.success) {
    return { valid: true, errors: [], event: parsed.data };
  }
  return {
    valid: false,
    errors: parsed.error.errors.map((issue) => `${issue.path.join(".") || "event"}: ${issue.message}`),
  };
}
