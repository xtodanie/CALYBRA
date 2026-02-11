# agent/EVIDENCE_FORMAT.md

## Purpose
This is the mandatory output format for every agent deliverable. It forces evidence-first behavior, prevents guessing, and ensures production-ready proof loops.

## Rule: No Evidence, No Patch
A patch is invalid unless it is preceded by verified facts (with file pointers) and followed by executed proofs.

---

## REQUIRED OUTPUT STRUCTURE (COPY/PASTE TEMPLATE)

### 1) FACTS (Repo-Derived, With File/Line Pointers)
List only what you can prove from:
- `firestore.rules`
- `storage.rules`
- `tests/**`
- `firebase.json`
- `.firebaserc`

Format each fact:
- Fact:
- Source: `<path>:<lineStart>-<lineEnd>`
- Snippet: (max 1–2 lines)

Example:
- Fact: `monthCloses FINALIZED is immutable in rules.`
- Source: `firestore.rules:210-238`
- Snippet: `allow update: if resource.data.status != "FINALIZED";`

If anything is uncertain:
- Mark as `UNKNOWN` and STOP.

---

### 2) PROBLEM STATEMENT (Minimal, Precise)
- What is failing?
- Exact error message(s) (verbatim)
- Where it fails (command + file + line)

Example:
- Command: `npm run typecheck`
- Error: `Type '...' is not assignable to ...`
- Location: `src/i18n/types.ts:42`

---

### 3) SCOPE (What Will Change, What Will NOT Change)
- Will change (explicit file list)
- Will NOT change (explicit statement)
- Surfaces touched (max 2 unless justified)
- Risk class: P0 / P1 / P2 / P3

---

### 4) MINIMAL PLAN (SSI)
Define the Smallest Shippable Increment:
- Scope:
- Acceptance criteria (binary):
- Proof plan (commands):
- Rollback plan (commands):

No optional work. No refactors.

---

### 5) PATCH (Unified Diff or Full File Content)
Rules:
- Smallest possible diff.
- No unrelated formatting.
- No renamed files unless required.
- If changing rules: include tests in same patch.

Provide one of:
A) Unified diff blocks per file, or
B) Full file contents for each changed file.

---

### 6) PROOF (Executed, Not “Next Steps”)
You must run the proof commands and report results.
For each command:
- Command:
- Result: PASS/FAIL
- Output summary: (max 5 lines, no secrets)

Minimum:
- `npm run lint`
- `npm run typecheck`
- `firebase emulators:exec --only firestore "npm test"`

If any FAIL:
- Stop. Do not write `RELEASE.md`.
- Create a regression entry stub in `agent/REGRESSIONS/` and update TASKS with the blocker.

---

### 7) EXPECTED BEHAVIOR (Post-Change)
- What changes for users/devs?
- What does NOT change (runtime behavior guarantee if applicable)?
- Any new constraints?

---

### 8) ROLLBACK (Concrete)
- Exact revert command(s)
- Exact redeploy surface command(s)
- Validation after rollback

---

### 9) RELEASE NOTE (Only If Proof PASS)
Only after proofs pass:
- Add entry to `agent/RELEASE.md` including:
  - summary
  - commands executed
  - PASS results
  - rollback pointer

If proofs were not run: do not touch RELEASE.

---

## ENFORCEMENT
Any agent output that does not follow this structure is invalid and must be rewritten before proceeding.
