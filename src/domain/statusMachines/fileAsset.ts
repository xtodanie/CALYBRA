export enum Status {
  PENDING_UPLOAD = "PENDING_UPLOAD",
  UPLOADED = "UPLOADED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  DELETED = "DELETED",
}

export const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  [Status.PENDING_UPLOAD]: [Status.UPLOADED, Status.DELETED],
  [Status.UPLOADED]: [Status.VERIFIED, Status.REJECTED, Status.DELETED],
  [Status.VERIFIED]: [Status.DELETED],
  [Status.REJECTED]: [Status.DELETED],
  [Status.DELETED]: [],
} as const;

export const TERMINAL_STATES: readonly Status[] = [Status.DELETED] as const;

export function isTransitionAllowed(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransitionAllowed(from: Status, to: Status): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Illegal transition: FileAsset status '${from}' -> '${to}'. Allowed: [${ALLOWED_TRANSITIONS[from].join(", ")}]`
    );
  }
}
