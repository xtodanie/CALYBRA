import { z } from "zod";

export const aiSuggestionSchema = z.object({
  suggestionId: z.string().min(1),
  code: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string().min(1)).default([]),
});

export const aiResponseSchema = z.object({
  tenantId: z.string().min(1),
  contextHash: z.string().min(1),
  model: z.string().min(1),
  generatedAt: z.string().min(1),
  suggestions: z.array(aiSuggestionSchema),
  mutationIntent: z.literal("none"),
  allowedActions: z.array(z.enum(["suggest", "explain", "escalate"]))
    .default(["suggest", "explain", "escalate"]),
});

export type AISuggestion = z.infer<typeof aiSuggestionSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>;

export interface AIBoundaryValidation {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

export function validateAIIsolationBoundary(input: unknown): AIBoundaryValidation {
  const parsed = aiResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      accepted: false,
      reasons: parsed.error.errors.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`),
    };
  }
  if (parsed.data.mutationIntent !== "none") {
    return { accepted: false, reasons: ["mutationIntent must be none"] };
  }
  return { accepted: true, reasons: [] };
}
