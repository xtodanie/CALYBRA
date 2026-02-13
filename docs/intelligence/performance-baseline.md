# Phase 2 Performance Baseline (SSI-0617)

## Scope
Deterministic brain replay path executed from period finalization workflow.

## Baseline Targets
- Brain replay orchestration step: <= 150 ms local unit baseline.
- Artifact validation + append path: <= 120 ms local unit baseline.
- Integrity gate script runtime: <= 2 s local baseline.

## Deterministic Criteria
- Same input bundle must produce identical replay hash.
- Same input bundle must produce identical deterministic artifact IDs.
- Snapshot retention order is stable by timestamp.

## Gate Definition
Preflight PASS requires all commands succeed:
1. `npm run typecheck`
2. `npm run lint`
3. `npm test -- server/tests/workflows/brainReplay.workflow.test.ts server/tests/workflows/periodFinalized.workflow.test.ts server/tests/failure-sim.spec.ts`
4. `node scripts/integrity-check.mjs`
5. `node scripts/consistency.mjs`
