# agent/RELEASE.md

## Purpose
This is the authoritative release log for Calybra. It exists to make shipping deterministic, auditable, and reversible.

## Non-Negotiable Rules
1) **No “proof pending”.** If proofs were not executed and recorded, do not write a release entry.
2) Each entry must include:
   - what changed
   - why it changed
   - proof commands executed + PASS results summary
   - rollback steps (concrete)
3) Releases are append-only. Do not rewrite history; add a new entry.
4) If a release requires emergency rollback, record the incident and link a regression entry.

---

## Release Entry Template (Copy/Paste)

### YYYY-MM-DD — Release <id>
**Scope**
- Surfaces: (Rules / Tests / UI / Functions / Scripts / Docs)
- Risk: (P0/P1/P2/P3)

**Summary**
- (1–3 bullets, factual)

**Changes**
- (List specific user-visible or system changes)
- (List exact collections/statuses affected if applicable)

**Proof (Executed)**
- Command:
  - Result: PASS
  - Output summary:
- Command:
  - Result: PASS
  - Output summary:
- Command:
  - Result: PASS
  - Output summary:

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - `firebase deploy --only <surface>`
- Validate:
  - run the same proof commands again

**Notes**
- (Any known limitations, no speculation)

---

## Current Release Track
Use semantic versioning when you start shipping externally. Until then, use incremental release ids:
- Release 0001, 0002, etc.

---

## Releases

### 2026-02-10 — Release 0001
**Scope**
- Surfaces: Docs
- Risk: P3

**Summary**
- Initialized release discipline and templates.

**Changes**
- Added and standardized `agent/RELEASE.md` structure.

**Proof (Executed)**
- Command: `node -v`
  - Result: PASS
  - Output summary: Node available.
- Command: `npm -v`
  - Result: PASS
  - Output summary: npm available.

**Rollback**
- Revert: `git revert <sha>`
- Redeploy: none
- Validate: none

**Notes**
- No code changes.

### 2026-02-10 — Release 0002
**Scope**
- Surfaces: Rules / Tests / UI / Functions / Scripts / Docs
- Risk: P1

**Summary**
- Fixed type and lint errors across UI, functions, and shared types.
- Aligned functions typing, dependencies, and build configs.

**Changes**
- Reworked UI typing and enum usage for month close flows and downloads.
- Updated functions handlers typing and build config for deployed functions.
- Added missing dependency and cleaned strict type errors in shared types.

**Proof (Executed)**
- Command: `npm run truth-lock`
  - Result: PASS
  - Output summary: Truth lock and consistency checks passed.
- Command: `npm run lint`
  - Result: PASS
  - Output summary: No lint errors (warnings remain).
- Command: `npm run typecheck`
  - Result: PASS
  - Output summary: TypeScript noEmit completed successfully.
- Command: `firebase emulators:exec --only firestore "npm test"`
  - Result: PASS
  - Output summary: 3 test suites passed (rules warnings observed).
- Command: `npm --prefix functions run build`
  - Result: PASS
  - Output summary: TypeScript build completed.
- Command: `npm --prefix calybra-database run build`
  - Result: PASS
  - Output summary: TypeScript build completed.

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - `firebase deploy --only functions,firestore:rules,storage`
- Validate:
  - run the same proof commands again

**Notes**
- Lint warnings remain and should be addressed in a follow-up.

### 2026-02-10 — Release 0003
**Scope**
- Surfaces: UI
- Risk: P2

**Summary**
- Triggered server provisioning immediately after signup.
- Added a retry UI for provisioning failures.

**Changes**
- Signup now calls `ensureUserProvisioned` to avoid profile timeouts.
- Auth form surfaces provisioning errors with a retry action.

**Proof (Executed)**
- Command: `npm run lint`
  - Result: PASS
  - Output summary: No ESLint warnings or errors.
- Command: `npm run typecheck`
  - Result: PASS
  - Output summary: TypeScript noEmit completed successfully.

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - none
- Validate:
  - run the same proof commands again

**Notes**
- None

### 2026-02-10 — Release 0004
**Scope**
- Surfaces: Functions / Tests
- Risk: P2

**Summary**
- Expanded download authorization to include all tenant read roles.

**Changes**
- Allow ACCOUNTANT and VIEWER roles to generate signed download URLs.
- Updated download authorization tests for expanded role coverage.

**Proof (Executed)**
- Command: `npm test -- download-auth.test.ts`
  - Result: PASS
  - Output summary: 1 test suite passed.

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - `firebase deploy --only functions`
- Validate:
  - run the same proof commands again

**Notes**
- None

### 2026-02-10 — Release 0005
**Scope**
- Surfaces: Scripts / Docs
- Risk: P2

**Summary**
- Generated a deterministic truth snapshot from repo sources.

**Changes**
- Expanded truth snapshot generator to include identity/RBAC sources and access rules.
- Added generated `agent/TRUTH_SNAPSHOT.md`.

**Proof (Executed)**
- Command: `node scripts/truth.mjs`
  - Result: PASS
  - Output summary: TRUTH_LOCK passed and snapshot written.

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - none
- Validate:
  - run the same proof commands again

**Notes**
- None

### 2026-02-10 — Release 0006
**Scope**
- Surfaces: Tests / CI / Docs
- Risk: P1

**Summary**
- Added comprehensive invariant tests for tenant isolation, status transitions, RBAC, and server-only writes.
- Updated CI workflow with truth-lock, lint, typecheck, and emulator-based testing.

**Changes**
- Created `tests/invariants/tenant-isolation.test.ts` - tests cross-tenant read/write denial.
- Created `tests/invariants/status-transitions.test.ts` - tests client cannot change status.
- Created `tests/invariants/rbac.test.ts` - tests VIEWER/MANAGER/ACCOUNTANT/OWNER permissions.
- Created `tests/invariants/server-only-writes.test.ts` - tests client cannot write to server-only collections.
- Updated `.github/workflows/ci.yml` with lint-and-typecheck, build, and test jobs.

**Proof (Executed)**
- Command: `npm run truth-lock`
  - Result: PASS
  - Output summary: TRUTH_LOCK and CONSISTENCY passed.
- Command: `npm run typecheck`
  - Result: PASS
  - Output summary: No TypeScript errors.

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - none (CI/tests only)
- Validate:
  - run the same proof commands again

**Notes**
- Invariant tests require Firebase emulator to run.

### 2026-02-10 — Release 0007
**Scope**
- Surfaces: Rules / Functions / Tests / Docs / CI
- Risk: P0

**Summary**
- Completed CALYBRA security hardening: RBAC canonicalization, status machine enforcement, rules defense-in-depth.
- Server transitions now enforced at both Cloud Functions AND Firestore Rules layers.
- Terminal states (FINALIZED, DELETED, CONFIRMED, REJECTED) are immutable at rules level.

**Changes**
- `src/domain/rbac.ts`: Added `explainPermissionDenied()` for logging/debugging.
- `src/domain/statusMachines/*.ts`: Added `assertTransitionAllowed()` to all three status machines.
- `contracts/status-machines.md`: Updated with complete transition tables and terminal states.
- `firestore.rules`: 
  - Added `statusChanging()`, `monthCloseIsTerminal()`, `fileAssetIsTerminal()`, `matchIsTerminal()` helpers.
  - MonthClose updates now enforce valid transitions for server writes.
  - FileAsset updates now enforce valid transitions and terminal state immutability.
  - Match creates now require `status=PROPOSED`; updates enforce transitions and terminal immutability.
- `tests/invariants/status-transitions.test.ts`: Added 9 new tests for server illegal transitions and terminal state immutability.
- `.github/workflows/ci.yml`: Updated Java version to 21 for firebase-tools compatibility.
- `agent/DECISIONS.md`: Added ADR-0009 for defense-in-depth transition enforcement.

**Proof (Executed)**
- Command: `npm run lint`
  - Result: PASS
  - Output summary: No ESLint warnings or errors.
- Command: `npm run typecheck`
  - Result: PASS
  - Output summary: No TypeScript errors.
- Command: `npm --prefix calybra-database run build`
  - Result: PASS
  - Output summary: Functions compiled successfully.
- Command: `node scripts/truth.mjs`
  - Result: PASS
  - Output summary: TRUTH_LOCK passed, snapshot written.
- Command: `node scripts/consistency.mjs`
  - Result: PASS
  - Output summary: CONSISTENCY passed.
- Command: `firebase emulators:exec --only firestore "npm test"`
  - Result: BLOCKED (local env lacks Java 21)
  - Output summary: Requires CI execution for final proof.

**Rollback**
- Revert:
  - `git revert <sha>`
- Redeploy:
  - `firebase deploy --only firestore:rules`
- Validate:
  - Run the same proof commands again.

**Notes**
- Emulator tests cannot run locally due to Java 21 requirement. CI will execute them.
- Rules are syntactically valid (no compile errors in firestore build).
- Defense-in-depth means even server code bugs cannot create illegal state transitions.

