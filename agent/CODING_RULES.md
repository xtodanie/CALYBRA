# agent/CODING_RULES.md

## Purpose
These rules exist to keep Calybra production-grade and to keep agent-driven development safe, deterministic, and reviewable.

## Non-Negotiable
Any change that violates these rules is invalid and must be redone.

---

## 0) Mandatory Process Gates
Every task MUST:
1) Complete `agent/PREFLIGHT.md`
2) Follow `agent/EVIDENCE_FORMAT.md` output
3) Run and PASS:
   - `node scripts/truth.mjs`
   - `node scripts/consistency.mjs`
4) Execute proof commands (not “next steps”) before claiming done.

If proofs are not executed:
- Update `agent/TASKS.md` only
- Do NOT update `agent/RELEASE.md`

---

## 1) Scope Discipline (Small Diffs Only)
- Max 2 surfaces per SSI (e.g., Rules+Tests, UI+Domain).
- Max 20 files changed per SSI unless explicitly justified.
- No refactors during feature work.
- No renames/restructures unless required for correctness.

If a task requires more:
- Split into multiple SSIs with separate proofs.

---

## 2) Source of Truth Hierarchy
Primary truth is the repo itself:
1) `firestore.rules`
2) `storage.rules`
3) `tests/**`
4) `firebase.json` / `.firebaserc`

Secondary artifacts must match primary:
- `agent/**`
- `contracts/**`
- `seed/**`
- `src/domain/schemas/**`

Agents are not allowed to “choose” architecture. They must align to truth.

---

## 3) Security Rules (Firestore/Storage)
### Default Deny
- Never remove a default deny pattern.

### Tenant Isolation
- Tenant-owned docs must always be isolated by tenant.
- No cross-tenant reads/writes. No exceptions.

### RBAC
- Use a single canonical role set (exact strings).
- Enforce role gates at the rule level for privileged writes and transitions.

### Rules Changes Require Tests
- Any change to rules MUST include corresponding rules tests.
- If tests are missing, add them first.

---

## 4) Data Model Discipline
### Contracts Are Canonical for Dev (But Must Match Truth)
- `contracts/firestore.schema.md` describes the current schema.
- `contracts/status-machines.md` describes status transitions.
- `contracts/firestore.examples.json` provides canonical examples.

Rules:
- If the schema changes, update contracts + seed + runtime schemas + migration notes.

### Server-Authoritative Fields
Clients must not set:
- privileged statuses
- verification results
- timestamps intended to be server-owned
- derived totals or internal flags

Enforce in:
- runtime validation (schemas)
- Firestore rules (field allowlists)
- invariant tests

---

## 5) TypeScript / Next.js
- No `any` unless justified in code comment.
- Do not silence errors by widening types without a contract reference.
- Prefer narrow types with explicit parsing/validation at boundaries.
- Keep business logic out of React components:
  - domain logic in `src/domain/**`
  - UI components do rendering + calls domain functions.

---

## 6) Build Hygiene
- Fix the root cause, not the symptom.
- Avoid “hack fixes” (e.g., disabling lint rules globally).
- Pin toolchain versions when required for stability (document in ADR).

---

## 7) Testing Rules
### Minimum Proof Set for Any Change
- `npm run lint`
- `npm run typecheck`
- `firebase emulators:exec --only firestore "npm test"`

### Additional Proofs
- If functions affected: build/test functions
- If storage affected: storage emulator tests (if present)
- If status machine affected: invariant tests must cover transitions

### No “Proof Pending”
- “Proof pending” is not allowed in RELEASE.
- If proofs can’t run due to environment blockers, open a task and stop.

---

## 8) CI Is The Boss
- CI must run truth + consistency + proofs.
- If CI fails, the work is not done.

---

## 9) Logging / Observability
- Do not log secrets or raw sensitive payloads.
- Log enough to debug: tenantId, uid, operation, outcome.
- Critical transitions must be traceable (who/when).

---

## 10) Release Discipline
- Only the QA/EVALS agent writes `agent/RELEASE.md` and only after PASS proofs.
- Each release entry must include:
  - summary
  - commands executed
  - results
  - rollback reference
