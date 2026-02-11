export enum Status {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  FINALIZED = "FINALIZED",
}

export const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  [Status.DRAFT]: [Status.IN_REVIEW],
  [Status.IN_REVIEW]: [Status.DRAFT, Status.FINALIZED],
  [Status.FINALIZED]: [],
} as const;

export const TERMINAL_STATES: readonly Status[] = [Status.FINALIZED] as const;

export function isTransitionAllowed(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransitionAllowed(from: Status, to: Status): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Illegal transition: MonthClose status '${from}' -> '${to}'. Allowed: [${ALLOWED_TRANSITIONS[from].join(", ")}]`
    );
  }
}
