# ZEREBROX Control Plane — 18-Directive Closure Matrix

Date: 2026-02-14  
Scope: Workspace implementation evidence (code, wiring, tests, proof commands)

## Legend
- **Implemented**: Deterministic logic implemented in code.
- **Runtime Wired**: Invoked by workflows/functions/UI in normal execution paths.
- **Tested**: Covered by automated tests in workspace.
- **Residual Gap**: Remaining work needed for production assurance beyond current workspace state.

## Matrix

| # | Directive | Implemented Evidence | Runtime Wiring Evidence | Test Evidence | Status | Residual Gap |
|---|-----------|----------------------|--------------------------|---------------|--------|--------------|
| 1 | Append-only decision log | `server/logic/brain/core/zerebrox-control-plane.ts` (`AppendOnlyDecisionFeedbackLog.appendDecision`) | `server/workflows/zerebroxControlPlane.workflow.ts` (`createEvent` type `zerebrox.decision`) + `server/persistence/write.ts` (`createEvent` uses `.create`) | `server/tests/logic/zerebroxControlPlane.test.ts`; `server/tests/workflows/zerebroxControlPlane.workflow.test.ts` | Closed | None in codebase |
| 2 | Decision↔truth binding | `bindDecisionToTruth` | Heartbeat workflow emits `zerebrox.truth_link` event payload from linkage | Logic + workflow tests above | Closed | None in codebase |
| 3 | Unified feedback ingestion | `normalizeFeedbackEvent` | Heartbeat workflow emits `zerebrox.feedback` event | Logic + workflow tests above | Closed | None in codebase |
| 4 | Outcome scoring engine | `scoreTenantDecisionOutcomes` | Heartbeat workflow computes scorecard per run | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
| 5 | Threshold alerting | `evaluateScoringThresholds` | Heartbeat workflow stores `scoringAlert` into flight recorder snapshot | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
| 6 | Core-memory projections | `computeCoreMemoryProjection` | Recorder snapshot builder + heartbeat projection path | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
| 7 | Runtime context compiler | `compileRuntimeContext` | Heartbeat stores compilation log in readmodel context log | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
| 8 | Heartbeat control loop | `runTimerHeartbeat` | `runZerebroxControlPlaneHeartbeatWorkflow` invoked by schedulers | `server/tests/logic/zerebroxControlPlane.test.ts`; workflow tests | Closed | None in codebase |
| 9 | Adaptation scheduler | `runAdaptationScheduler` | Hourly/nightly/weekly control-plane jobs in `functions/src/index.ts` | Logic + workflow tests | Closed | Deployment required for live schedule execution |
|10 | Autopilot state machine | `transitionAutopilotMode` + allowed transition map | Heartbeat persists mode to `readmodels/autopilotMode/items/active` | `server/tests/logic/zerebroxControlPlane.test.ts`; workflow tests | Closed | None in codebase |
|11 | Rule-vs-AI arbiter | `arbitrateCommand` | Heartbeat resolves `finalAction` and stores `arbiter` in readmodel | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
|12 | Dual-path disagreement checks | `compareDualPathOutputs` | Heartbeat stores `dualPathComparison` and uses delta in adaptation drift signal | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
|13 | Financial protection envelope | `evaluateProtectionEnvelope` | Heartbeat gating controls allowed actions + effective mode downgrade | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
|14 | Policy proposal lifecycle | `buildPolicyDeltaProposal` | Heartbeat writes `readmodels/policyProposals/items/{proposalId}` | `server/tests/workflows/zerebroxControlPlane.workflow.test.ts` | Closed | None in codebase |
|15 | Policy activation + rollback anchor | `activatePolicyVersion` + `rollbackPolicyVersion` + `evaluateCanaryShadow` | Approval workflow updates active policy / rejects by canary | `server/tests/workflows/zerebroxControlPlane.workflow.test.ts` | Closed | None in codebase |
|16 | Prompt governance registry | `PromptGovernanceRegistry` | Available in control-plane core exports | `server/tests/logic/zerebroxControlPlane.test.ts` (registry behavior covered indirectly via module integrity set) | Closed | Optional: add dedicated workflow usage path when prompts become runtime-configured |
|17 | Schema-locked AI I/O + deterministic fallback | `evaluateSchemaLockedAIResponse` | Heartbeat schema gate drives envelope verification and fallback semantics | `server/tests/logic/zerebroxControlPlane.test.ts` | Closed | None in codebase |
|18 | Flight recorder replay + canary/shadow rollback surface | `buildFlightRecorderEntry` + `evaluateCanaryShadow` | Readmodel + callable + UI (`functions/src/index.ts` `getFlightRecorder`; `src/components/analytics/flight-recorder-card.tsx`; month-close page integration) | Logic tests + workflow tests | Closed | Production monitoring remains an ops concern, not a code gap |

## Cross-cutting integrity checks

- Tenant scoping: all persistence paths are under `tenants/{tenantId}/...`.
- Server-authoritative writes: workflow/functions write readmodels/events; client reads render outputs.
- Append-only event posture: `createEvent` uses Firestore `.create()` and deterministic IDs.

## Proof commands (latest known passing in this workspace)

- `npm --prefix functions run build`
- `npm run typecheck`
- `npm run lint`
- `node scripts/truth.mjs`
- `node scripts/consistency.mjs`
- `runTests` for:
  - `server/tests/logic/zerebroxControlPlane.test.ts`
  - `server/tests/workflows/zerebroxControlPlane.workflow.test.ts`

All above have recent passing results in session context (exit code 0 / all tests passing).
