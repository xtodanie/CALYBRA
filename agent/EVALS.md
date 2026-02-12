# agent/EVALS.md

## Purpose
EVALS are repeatable, enforceable quality checks. They are the anti-drift system: every time you ship, you re-run the same evals and catch regressions before users do.

## Non-Negotiable
- EVALS are not “suggestions”. They are gates.
- CI must run the automated subset.
- Manual evals must be recorded when applicable (especially for UI golden paths).

---

## Eval Sets

### E0: Repo Truth & Drift (P0 Gate)
**Goal:** Prevent architecture drift.
**Automated**
- `node scripts/truth.mjs`
- `node scripts/consistency.mjs`

**Pass Criteria**
- Truth snapshot generated successfully
- Consistency gate PASS
- No mismatched path model / roles / statuses across secondary artifacts

---

### E1: Security Baseline (P0 Gate)
**Goal:** Ensure tenant isolation and auth boundaries never regress.

**Automated**
- Firestore emulator rules tests:
  - unauthenticated deny
  - cross-tenant deny
  - role-based deny/allow
  - finalized immutability (if present in truth)

Command:
- `firebase emulators:exec --only firestore "npm test"`

**Pass Criteria**
- 0 failing tests
- Must include cross-tenant denial coverage for all core collections

---

### E2: Status Machine Integrity (P0/P1 Gate)
**Goal:** Ensure status transitions remain valid and enforced.

**Automated**
- `tests/invariants/statusTransitions.test.ts` (or equivalent)
- Rules tests covering denied transitions

**Pass Criteria**
- Allowed transitions PASS
- Disallowed transitions DENIED
- FINALIZED monthCloses immutable if truth indicates it

---

### E3: Forbidden Client Fields (P0 Gate)
**Goal:** Prevent client forging server-authoritative fields.

**Automated**
- `tests/invariants/forbiddenClientFields.test.ts`

**Pass Criteria**
- Client cannot set privileged statuses, verification fields, server timestamps/actors, derived totals

---

### E4: Build & Toolchain Stability (P1 Gate)
**Goal:** Prevent “passes tests but doesn’t build”.

**Automated**
- `npm run lint`
- `npm run typecheck`
- package builds:
  - `npm --prefix functions run build` (if applicable)
  - `npm --prefix calybra-database run build` (if applicable)

**Pass Criteria**
- All PASS
- No warnings treated as errors unless explicitly configured

---

### E5: Golden Paths (P1/P2 Gate)
**Goal:** Validate end-to-end flows using deterministic seed state.

**Manual or Semi-Automated**
Run the relevant Golden Path document(s) and record:
- Seed version used
- Steps executed
- Expected DB states observed
- Any unexpected denials/errors

Targets:
- GP-01 Onboarding
- GP-02 Invoice CRUD
- GP-03 Match Workflow
- GP-04 Month Close Finalize
- GP-05 File Asset Upload/Verify

**Pass Criteria**
- Flows complete without permission errors
- DB state matches expectations

---

### E6: Performance & UX Budgets (P2 Gate, enforced for user-facing releases)
**Goal:** Prevent slow UI and query regressions.

**Budgets (Default)**
- Invoice list load: < 800ms (typical)
- Month close load: < 800ms (typical)
- No N+1 query patterns in critical screens

**Method**
- Basic measurement using browser performance panel or logging.
- Record results in release notes for major releases.

**Pass Criteria**
- Budgets met or justified with an ADR and a mitigation plan

---

### E7: Observability (P1 Gate for server changes)
**Goal:** Ensure critical operations are traceable.

**Checks**
- Functions log: operation name, tenantId, uid (if available), outcome
- No sensitive raw payloads logged

**Pass Criteria**
- Logs present for finalize, verify, ingestion, privileged transitions

---

## CI Required Subset
CI must run:
- E0, E1, E2, E3, E4
Golden paths and performance are manual gates unless automated later.

---

## Eval Record Requirement
For any release that ships user-facing changes:
- record which eval sets were run
- record PASS/FAIL and summaries
- do not write RELEASE if proof is not PASS

---

## Recent Execution Records

### 2026-02-12 — SSI: Emulator Stabilization + GP Register + App Hosting Attempt
- E0 Repo Truth & Drift: PASS
  - `npm run truth-lock` PASS (`TRUTH_LOCK: PASSED.` and `CONSISTENCY: PASSED.`)
- E1/E2/E3 Security + Status + Forbidden Fields: PASS
  - `firebase emulators:exec --only firestore "npm test"` PASS (36 suites, 570 tests passed)
  - `npx firebase emulators:exec "node scripts/step4_readmodel_audit.mjs" --project demo-calybra` PASS (7 PASS, 0 FAIL)
- Local Operational Check: PASS
  - Emulator ports listening (9099/8085/9199/5001)
  - App endpoint reachable (`http://127.0.0.1:9002` HTTP 200)
  - Auth emulator reachable (`http://127.0.0.1:9099` HTTP 200)
- App Hosting Rollout: PARTIAL
  - `firebase apphosting:backends:list` PASS (backend `calybra-prod` exists)
  - `firebase apphosting:rollouts:create calybra-prod --git-branch main --force` FAIL (missing connected repository)
  - Fallback `firebase deploy` PASS (storage/firestore/functions surfaces deployed; unchanged functions skipped)
- Golden Paths Register: PARTIAL
  - `agent/GOLDEN_PATHS/INDEX.md` updated with GP-01..GP-05 run status
  - Manual UI walkthrough remains required to close E5 gate

Release gating outcome: NOT READY for full production sign-off until App Hosting repository linkage is completed and all GP manual checks are marked PASS.

### 2026-02-12 — SSI: Login Error Mapping for Firebase Invalid Credentials
- E4 Build & Toolchain Stability: PASS
  - `npm run typecheck` PASS (`tsc --noEmit` clean)
- Regression Safety Tests: PASS
  - `runTests` (mode: run) PASS (446 passed, 0 failed)

Release gating outcome: READY for this SSI.

### 2026-02-12 — SSI: Local Firestore/Auth Offline Error Guard
- E0 Repo Truth & Drift: PASS
  - `npm run truth-lock` PASS (`TRUTH_LOCK: PASSED.` and `CONSISTENCY: PASSED.`)
- E4 Build & Toolchain Stability: PASS
  - `npm run typecheck` PASS (`tsc --noEmit` clean)
- Regression Safety Tests: PASS
  - `runTests` (mode: run) PASS (446 passed, 0 failed)

Release gating outcome: READY for this SSI.

### 2026-02-12 — SSI: i18n Parity Audit + Exports/Settings UX Polish
- E0 Repo Truth & Drift: PASS
  - `node scripts/truth.mjs` PASS (`TRUTH_LOCK: PASSED.`)
  - `node scripts/consistency.mjs` PASS (`CONSISTENCY: PASSED.`)
- E4 Build & Toolchain Stability: PASS
  - `npm run lint` PASS (no warnings/errors)
  - `npm run typecheck` PASS (`tsc --noEmit` clean)
- i18n Parity Gate: PASS
  - `runTests` on `tests/i18n-parity.test.ts` PASS (1/1 test)
- E1/E2/E3 Baseline Rules/Invariant Suite: PASS
  - `firebase emulators:exec --only firestore "npm test"` PASS (36 suites, 570 tests passed)

Release gating outcome: READY for this SSI.
- SSI scope: parity fixes + targeted copy/UX polish only.
- Explicitly out of scope (follow-on SSIs): manual golden paths, broader UX harmonization, remaining non-localized runtime messaging.
- Workspace note: large unrelated pre-existing changes remain present and were not modified by this SSI.
- Recommended next SSI: app-wide hardcoded toast/error copy extraction + i18n key rollout + parity test expansion.

### 2026-02-12 — SSI: Month-Close Flow Exception Wiring + Step4 Audit Hygiene
- E0 Repo Truth & Drift: PASS
  - `node scripts/truth.mjs` PASS (`TRUTH_LOCK: PASSED.`)
  - `node scripts/consistency.mjs` PASS (`CONSISTENCY: PASSED.`)
- E1/E2/E3 Security + Status + Forbidden Fields: PASS
  - `firebase emulators:exec --only firestore "npm test"` PASS (35 suites, 569 tests passed)
- E4 Build & Toolchain Stability: PASS
  - `npm run lint` PASS (no warnings/errors)
  - `npm run typecheck` PASS (`tsc --noEmit` clean)
- Targeted Audit Proof: PASS
  - `npx firebase emulators:exec "node scripts/step4_readmodel_audit.mjs" --project demo-calybra`
  - Result: 7 PASS, 0 FAIL

Release gating outcome: READY for this SSI. Larger product-completion SSIs remain open.

### 2026-02-12 — Deploy Continuation Record
- E4 Build & Toolchain Stability: PASS
  - `npm run truth-lock` PASS
  - `npm run typecheck` PASS
  - `firebase emulators:exec --only firestore "npm test"` PASS (latest run: 569 pass, 0 fail)
- Deployment Proof (Operational): PARTIAL
  - `firebase deploy --only functions` PASS
  - App Hosting deploy via deprecated command FAIL (`apphosting:backends:deploy` not supported)
  - `apphosting:backends:create` PASS
  - `apphosting:rollouts:create` FAIL due to missing GitHub repository connection
- E5 Golden Paths: FAIL (incomplete)
  - GP-01 manual onboarding proof pending (live sign-in + tenant creation not yet executed)

Release gating outcome: NOT READY for full production sign-off until App Hosting rollout PASS and GP-01 manual proof PASS.
