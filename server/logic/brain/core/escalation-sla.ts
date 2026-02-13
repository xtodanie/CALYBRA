export type EscalationTier = "recommended" | "required" | "critical";

export interface EscalationSlaPlan {
  readonly tier: EscalationTier;
  readonly maxResponseMinutes: number;
  readonly minReviewerRole: string;
}

const SLA_PLANS: Record<EscalationTier, EscalationSlaPlan> = {
  recommended: {
    tier: "recommended",
    maxResponseMinutes: 180,
    minReviewerRole: "auditor",
  },
  required: {
    tier: "required",
    maxResponseMinutes: 60,
    minReviewerRole: "controller",
  },
  critical: {
    tier: "critical",
    maxResponseMinutes: 15,
    minReviewerRole: "owner",
  },
};

export function planEscalationSla(tier: EscalationTier): EscalationSlaPlan {
  return SLA_PLANS[tier];
}
