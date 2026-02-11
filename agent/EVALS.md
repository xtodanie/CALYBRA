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
