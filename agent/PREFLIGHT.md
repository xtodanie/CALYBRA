# agent/PREFLIGHT.md

## Purpose
This checklist is mandatory for every task. If any item is UNKNOWN, STOP and resolve it before making changes.

## Rule: No Preflight, No Work
A change is invalid unless the completed Preflight is included in the task output and all required proofs are executed.

---

## 0) Task Declaration
- Task name:
- Requested outcome:
- Surfaces expected to change (select):
  - [ ] Firestore rules
  - [ ] Storage rules
  - [ ] Tests
  - [ ] Functions
  - [ ] Web/UI
  - [ ] Contracts
  - [ ] Schemas
  - [ ] Scripts/CI
  - [ ] Docs only

---

## 1) Repo Truth Lock (MUST PASS)
Run and record results:
- [ ] `node scripts/truth.mjs` (generates/updates `agent/TRUTH_SNAPSHOT.md`)
- [ ] `node scripts/consistency.mjs` (fails on drift)

Record:
- Truth Snapshot updated at:
- Consistency gate result: PASS / FAIL
- If FAIL: list drift items and STOP.

---

## 2) Risk Classification (FAIL FAST)
Select exactly one:
- [ ] P0 Security / Isolation / RBAC / Rules
- [ ] P1 Data Integrity / Status Machines / Money Math
- [ ] P2 UX / UI Wiring / Non-sensitive behavior
- [ ] P3 Docs-only

Rules:
- If P0: must include rules tests changes (or new tests) proving the fix.
- If P1: must include at least one automated test or invariant check.
- If P2: must include UI verification steps + at least one automated proof (lint/typecheck/test).
- If P3: no code changes allowed.

---

## 3) Scope Limits (Prevents Mega-Diffs)
Hard limits (unless explicitly justified in DECISIONS.md):
- [ ] Max 2 surfaces touched for a single SSI (e.g., Rules + Tests, UI + Domain).
- [ ] Max 20 files changed.
- [ ] No refactors during feature work.
- [ ] No dependency changes unless ADR created first.

If any limit must be exceeded:
- Justification:
- ADR required? YES / NO (If YES, create ADR first.)

---

## 4) Minimal Spec Check
Before implementation, confirm that these are aligned with repo truth:
- [ ] Paths match rules (tenant subcollections vs top-level).
- [ ] Roles match rules/tests (exact strings).
- [ ] Status values match rules/tests (exact strings).
- [ ] Authority map matches rules (client-limited vs server-only).

If any mismatch exists:
- STOP. Repair truth alignment first. No new features.

---

## 5) Proof Plan (Commands and Expected Result)
List the exact commands that will be executed and what “PASS” means.

Minimum baseline proofs:
- [ ] `npm run lint` -> PASS
- [ ] `npm run typecheck` -> PASS
- [ ] `firebase emulators:exec --only firestore "npm test"` -> PASS

If Functions are involved:
- [ ] `npm --prefix functions run build` (or equivalent) -> PASS
If calybra-database is involved:
- [ ] `npm --prefix calybra-database run build` -> PASS

Record expected outputs:
- Lint: 0 errors
- Typecheck: 0 errors
- Tests: 0 failing tests

---

## 6) Rollback Plan (Mandatory)
Define rollback in one of these forms:
- [ ] `git revert <commit>` and redeploy specific surface
- [ ] restore previous rule file and redeploy rules only
- [ ] revert schema change and re-run migration rollback steps

Rollback steps must be concrete:
- What to revert:
- Deploy steps:
- Validation steps:

---

## 7) Release Discipline
Rules:
- Do NOT write to `agent/RELEASE.md` unless proofs were executed and results recorded.
- If proofs are not executed yet:
  - put progress in `agent/TASKS.md` only.

Checklist:
- [ ] TASKS updated (SSI tracked)
- [ ] RELEASE updated only after PASS proofs (include commands + summarized results)

---

## 8) Final Preflight Gate (Before Any Patch)
Answer all with concrete evidence:
- What files will change, exactly?
- What is the smallest diff that solves the task?
- What tests prove correctness?
- What could break (failure modes) and what catches it?

If any answer is vague: STOP.
