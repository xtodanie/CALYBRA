export interface Phase2ClosureInput {
  readonly determinismPass: boolean;
  readonly integrityPass: boolean;
  readonly aclPass: boolean;
  readonly replayStabilityPass: boolean;
  readonly emulatorE2ePass: boolean;
  readonly preflightPass: boolean;
  readonly unresolvedCriticalDefects: number;
}

export interface Phase2ClosureResult {
  readonly closed: boolean;
  readonly blockers: readonly string[];
}

export function evaluatePhase2Closure(input: Phase2ClosureInput): Phase2ClosureResult {
  const blockers: string[] = [];
  if (!input.determinismPass) blockers.push("determinism gate failed");
  if (!input.integrityPass) blockers.push("integrity gate failed");
  if (!input.aclPass) blockers.push("acl gate failed");
  if (!input.replayStabilityPass) blockers.push("replay stability failed");
  if (!input.emulatorE2ePass) blockers.push("emulator e2e failed");
  if (!input.preflightPass) blockers.push("preflight failed");
  if (input.unresolvedCriticalDefects > 0) blockers.push("unresolved critical defects");

  return {
    closed: blockers.length === 0,
    blockers,
  };
}
