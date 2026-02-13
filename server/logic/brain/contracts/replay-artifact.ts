import { z } from "zod";

export const brainArtifactTypeSchema = z.enum([
  "decision",
  "escalation",
  "health",
  "context_window",
  "snapshot",
  "gate_audit",
  "event_log",
]);

export const brainArtifactSchema = z.object({
  artifactId: z.string().min(1),
  tenantId: z.string().min(1),
  monthKey: z.string().min(1),
  type: brainArtifactTypeSchema,
  generatedAt: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  schemaVersion: z.literal(1),
  payload: z.record(z.unknown()),
});

export type BrainArtifactType = z.infer<typeof brainArtifactTypeSchema>;
export type BrainReplayArtifact = z.infer<typeof brainArtifactSchema>;

export function validateBrainReplayArtifact(input: unknown): {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly artifact?: BrainReplayArtifact;
} {
  const parsed = brainArtifactSchema.safeParse(input);
  if (parsed.success) {
    return { valid: true, errors: [], artifact: parsed.data };
  }
  return {
    valid: false,
    errors: parsed.error.errors.map((issue) => `${issue.path.join(".") || "artifact"}: ${issue.message}`),
  };
}
