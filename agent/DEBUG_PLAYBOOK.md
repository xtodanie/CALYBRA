# agent/DEBUG_PLAYBOOK.md

## Purpose

This playbook is a deterministic troubleshooting system.

No guessing. Every debug action must produce evidence.

---

## Mandatory Debug Loop (Hard)

1) Reproduce deterministically (exact command)
2) Capture the exact error (verbatim)
3) Locate boundary (UI vs Domain vs Rules vs Emulator vs Functions)
4) Reduce to minimal failing case
5) Fix with minimal diff
6) Prove with tests
7) Prevent regression (new test / invariant / gate)
8) Record regression if it was a real failure mode (`agent/REGRESSIONS/`)

Hard rule: if you cannot reproduce, you are not debugging yet.

---

## 0) First Command: Truth + Consistency

Before any debugging:

- `node scripts/truth.mjs`
- `node scripts/consistency.mjs`

If scripts are missing:

- STOP feature work.
- Create SSIs to add them (or explicitly remove the dependency and update docs).
- Until then, derive truth only from `firestore.rules`, `storage.rules`, and `tests/**` (read-only).

If scripts exist but fail:

- Treat as drift bug.
- Repair drift before continuing.

---

## 1) Emulator Failures

### 1.1 Firestore emulator host/port missing in tests

Symptom:

- Error says host/port must be specified, or emulator not discovered.

Checks:

- Are tests executed via:
  - `firebase emulators:exec --only firestore "npm test"` ?
- Does `firebase.json` define `emulators` ports consistently?

Fix:

- Standardize tests on `emulators:exec`.
- If a test runner requires explicit host/port, bind it to the emulator config and document it in `agent/RUNBOOK.md`.

Prevention:

- CI must run rules tests via `emulators:exec`.

---

### 1.2 Emulator not starting / port collision

Symptom:

- Emulator start fails, port already in use.

Checks:

- Inspect emulator ports in `firebase.json`.
- Check whether another emulator instance is already running.

Fix:

- Stop the conflicting process, or adjust ports in `firebase.json`.
- If changing shared ports, record ADR in `agent/DECISIONS.md`.

Prevention:

- Document emulator ports in `agent/RUNBOOK.md`.
- Provide a single startup script (`scripts/emulators.mjs`) if repo uses non-default ports.

---

## 2) Firestore Rules Failures

### 2.1 Permission denied for authenticated user

Symptom:

- “Missing or insufficient permissions” in client/test for a signed-in user.

Checks (in order):

1) Does `users/{uid}` exist in Firestore at request time?
2) Does `users/{uid}.tenantId` match the document tenant?
3) Does `users/{uid}.role` meet the rule’s required role?
4) Does the document contain required tenantId/status fields?
5) For creates: is the field allowlist satisfied?
6) For updates: is the status transition allowed and immutable constraints satisfied?

Fix:

- Seed user profiles properly (tests must create them as admin).
- Ensure tenantId and role are correct in the canonical user doc.
- Adjust rules/tests only if the behavior change is intentional (ADR required).

Prevention:

- Add invariant tests:
  - “user profile must exist for auth contexts”
  - “tenantId required on tenant-owned docs”

---

### 2.2 Cross-tenant access accidentally allowed (P0)

Symptom:

- A user from tenant A can read or write tenant B docs.

Immediate action:

- Stop all feature work.
- Fix rules and add tests proving denial across all core collections.

Fix pattern:

- Enforce tenant equality using canonical user profile.
- Deny any access where tenant does not match.
- Ensure references cannot cross tenants (matches must not link across tenants).

Prevention:

- Cross-tenant deny tests across all core collections.
- Consistency gate enforcing that contracts/schemas/seed align with rules.

---

### 2.3 Status transition blocked unexpectedly

Symptom:

- Update denied when transitioning status.

Checks:

- Compare requested transition vs `contracts/status-machines.md`.
- Check rule conditions for:
  - current status (`resource.data.status`)
  - next status (`request.resource.data.status`)
  - role checks
  - immutability constraints (e.g., `FINALIZED`)

Fix:

- Correct client payload to meet allowed transition.
- Or adjust rules + tests if transition should be allowed (ADR required).

Prevention:

- Add allow/deny transition tests for each status machine.

---

## 3) Build / Typecheck Failures

### 3.1 i18n typing mismatch

Symptom:

- en.ts and es.ts (or other locales) incompatible types.

Checks:

- Is the dictionary type too narrow (English literal union used as shape)?
- Are translations missing keys or using different structure?

Fix:

- Define a canonical dictionary shape type.
- Enforce key parity across languages.
- Do not widen types so far that missing keys pass silently.

Prevention:

- Add a type-level check ensuring all locales implement the same keys.

---

### 3.2 Module alias or import resolution failures

Symptom:

- Build errors for path aliases or firebase-functions entrypoints.

Checks:

- `tsconfig` paths vs bundler config alignment
- package.json module type and exports
- firebase-functions version compatibility

Fix:

- Align tsconfig paths and build tool config.
- Use the correct firebase-functions import style for installed version.
- Keep runtime behavior unchanged unless explicitly required.

Prevention:

- CI builds relevant packages (root + functions/database if present) consistently.

---

## 4) Storage Upload Failures

Symptom:

- Upload denied by Storage rules.

Checks:

- Is user authenticated?
- Is object path tenant-scoped?
- Is there a corresponding `fileAssets` doc in Firestore in the expected state?
- Does the rule require metadata coupling or specific path patterns?

Fix:

- Align upload path and metadata doc creation sequence.
- Ensure client cannot set privileged statuses.

Prevention:

- Add storage rules tests for:
  - wrong tenant path denied
  - missing metadata denied (if coupling is enabled)
  - allowed path + allowed metadata state succeeds

---

## 5) When To Write a Regression Entry

Write `agent/REGRESSIONS/R-xxxx-...md` when:

- a bug was real and could recur
- it involved rules/tests/build pipeline
- it caused wasted time due to missing checks or unclear runbook guidance

Each regression entry must include:

- detection command (exact)
- observed failure (verbatim)
- minimal fix (diff summary)
- prevention (new test, invariant, or gate)
