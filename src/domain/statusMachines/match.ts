export enum Status {
  PROPOSED = "PROPOSED",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

export const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  [Status.PROPOSED]: [Status.CONFIRMED, Status.REJECTED],
  [Status.CONFIRMED]: [],
  [Status.REJECTED]: [],
} as const;

export const TERMINAL_STATES: readonly Status[] = [
  Status.CONFIRMED,
  Status.REJECTED,
] as const;

export function isTransitionAllowed(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransitionAllowed(from: Status, to: Status): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Illegal transition: Match status '${from}' -> '${to}'. Allowed: [${ALLOWED_TRANSITIONS[from].join(", ")}]`
    );
  }
}
