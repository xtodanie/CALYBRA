# agent/DEFINITION_OF_DONE.md

## Purpose
Definition of Done (DoD) is the hard gate that prevents “almost done” and “works on my machine”. A task is NOT done unless it meets every applicable gate below with executed proof.

## Global Rule
- If a gate is applicable and not satisfied, the work is NOT done.
- If proof commands were not executed, the work is NOT done.
- If the repo truth model (paths/roles/status) is unclear, STOP and run Truth Lock.

---

## 0) Mandatory Process Gates (Always)
### 0.1 Preflight Completed
- `agent/PREFLIGHT.md` completed and included in the task output.

### 0.2 Evidence-First Output
- Output follows `agent/EVIDENCE_FORMAT.md`:
  - Facts with file/line pointers
  - Minimal plan
  - Patch
  - Proof results (executed)
  - Rollback steps

### 0.3 Truth Lock Pass (No Drift)
Executed and PASS:
- `node scripts/truth.mjs`
- `node scripts/consistency.mjs`

If either fails:
- The work is not done. Fix drift first.

---

## 1) Correctness Gates (Always)
### 1.1 Acceptance Criteria Met (Binary)
- All acceptance criteria are met exactly as written.
- No partial completion.

### 1.2 No Behavior Regressions
- If the SSI claims “no runtime behavior change”, you must prove it:
  - The change is strictly typing/build/tooling (or equivalent).
  - No business logic altered.
  - Relevant tests still pass.

### 1.3 Deterministic Reproduction
- The issue/failure that prompted the change is:
  - reproduced deterministically (before)
  - eliminated deterministically (after)
- The exact commands and before/after outcomes are recorded.

---

## 2) Security Gates (Required for P0/P1)
Applies if the change touches any of:
- Firestore rules
- Storage rules
- RBAC
- tenant isolation logic
- status transitions
- any server-authoritative boundary
- anything dealing with money math or verification

### 2.1 Tenant Isolation Proven
Proof exists (tests) that:
- Unauthenticated access is denied.
- Cross-tenant reads/writes are denied for all relevant collections.

### 2.2 RBAC Proven
Proof exists (tests) that:
- VIEWER (if present in truth) cannot write.
- Role-based permissions match truth for creates/updates/transitions.

### 2.3 Forbidden Client Fields Blocked
Proof exists (tests or invariants) that client cannot set:
- privileged statuses
- verification flags
- server timestamps/actors
- derived totals/internal flags

---

## 3) Data Integrity Gates (Required for P1)
Applies if changes touch:
- invoices/bankTx/matches/monthCloses/fileAssets
- status machines
- calculations/totals
- reference integrity (match linking invoice+tx)

### 3.1 Status Transitions Proven
- Allowed transitions succeed.
- Disallowed transitions are denied.
- Finalized states are immutable if truth indicates immutability (e.g., monthCloses FINALIZED).

### 3.2 Reference Integrity
- Any linking doc (e.g., match) cannot reference cross-tenant resources.
- Tests or invariants prove it.

### 3.3 Migration Discipline (If Schema Changes)
If schema/contract changed:
- `contracts/*` updated
- `seed/*` updated and consistent
- `migrations/*` updated (new migration note if non-trivial)
- `scripts/consistency.mjs` passes

---

## 4) UX / Product Gates (Required for UI Work)
Applies if UI changed or feature is user-facing.

### 4.1 UI Completeness
- Loading state exists
- Empty state exists
- Error state exists (including permission errors)
- No silent failures

### 4.2 Real Data Wiring
- UI reads/writes real Firestore data (not mock state), unless explicitly labeled non-shipping.
- Requests comply with rules (no console permission errors in expected flows).

### 4.3 Golden Path Verified (Manual or Automated)
At least one of:
- Follow the relevant file in `agent/GOLDEN_PATHS/*` and record PASS notes, OR
- Provide automated test evidence where feasible

---

## 5) Observability Gates (Required for Server Work)
Applies if functions/server-authoritative operations were modified.

- Logs include: tenantId, uid (if available), operation name, outcome.
- No sensitive raw payloads are logged.
- Failure paths are logged.

---

## 6) Build and Quality Gates (Always)
Executed and PASS:
- `npm run lint` (if exists)
- `npm run typecheck` (if exists)
- `firebase emulators:exec --only firestore "npm test"`
Additional builds/tests for relevant packages:
- `npm --prefix functions run build` (if functions package exists)
- `npm --prefix calybra-database run build` (if exists and relevant)

If any FAIL:
- Work is not done.
- Create/update tasks and stop.

---

## 7) Release Gates (Only When Shipping)
### 7.1 Release Log Entry Requires Proof
- `agent/RELEASE.md` updated only after proofs pass.
- Entry includes:
  - summary
  - commands executed
  - PASS results summary
  - rollback reference

### 7.2 Rollback Verified
- Rollback steps are concrete and correct for touched surfaces.
- If rules: redeploy rules only.
- If functions: redeploy functions only.
- If hosting: redeploy hosting only.

---

## 8) Regression Capture (When a Failure Mode Was Found)
If the work fixed a real regression or avoided repeating a past failure:
- Create or update a regression entry:
  - `agent/REGRESSIONS/R-xxxx-...md`
- Include detection command and prevention step (test/gate).

---

## “Done” Declaration Format (Mandatory)
To claim DONE, output:
- Gates satisfied list
- Proof commands + PASS results summary
- Files changed list
- Rollback steps
- (If shipping) RELEASE entry reference
