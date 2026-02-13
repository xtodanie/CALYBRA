export interface ReviewerCapacity {
  readonly reviewerId: string;
  readonly role: string;
  readonly availableSlots: number;
}

export interface EscalationAssignmentInput {
  readonly escalationId: string;
  readonly minRole: string;
  readonly capacities: readonly ReviewerCapacity[];
}

export interface EscalationAssignment {
  readonly escalationId: string;
  readonly reviewerId?: string;
  readonly assigned: boolean;
  readonly reason: string;
}

const ROLE_ORDER: Record<string, number> = {
  auditor: 1,
  controller: 2,
  owner: 3,
};

export function assignEscalationDeterministic(input: EscalationAssignmentInput): EscalationAssignment {
  const minRank = ROLE_ORDER[input.minRole] ?? 99;
  const eligible = [...input.capacities]
    .filter((item) => (ROLE_ORDER[item.role] ?? 0) >= minRank && item.availableSlots > 0)
    .sort((a, b) => {
      if (a.availableSlots !== b.availableSlots) {
        return b.availableSlots - a.availableSlots;
      }
      return a.reviewerId.localeCompare(b.reviewerId);
    });

  if (eligible.length === 0) {
    return {
      escalationId: input.escalationId,
      assigned: false,
      reason: "no eligible reviewer capacity",
    };
  }

  return {
    escalationId: input.escalationId,
    reviewerId: eligible[0]?.reviewerId,
    assigned: true,
    reason: "assigned deterministically",
  };
}
