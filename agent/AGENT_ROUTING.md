# agent/AGENT_ROUTING.md

## Purpose

This document defines how work is routed between Calybra agents. It prevents “one agent doing everything” and enforces specialization, proof loops, and safety gates.

This is an execution contract. If reality differs, update this file immediately.

---

## Non-Negotiable Gates

All agents MUST follow:

- `agent/PREFLIGHT.md` (must be completed before any patch)
- `agent/EVIDENCE_FORMAT.md` (mandatory output structure)
- `agent/MEMORY.md` (memory system: read learnings before work, write learnings after)
- `agent/SELF_IMPROVEMENT.md` (self-improvement loop: observe, measure, analyze, adapt)
- `node scripts/truth.mjs` **and** `node scripts/consistency.mjs` must PASS **before** planning changes

If any of the above fails: **STOP**.

---

## Self-Improvement Operations (Required)

Every agent MUST engage with the self-improvement system:

### Before Starting Work (OBSERVE + PREPARE)
1. **Context**: Check `agent/LEARNINGS/_SESSION.md` for current context
2. **Patterns**: Search `agent/PATTERNS.md` for applicable solutions
3. **Failures**: Check `agent/FAILURE_MODES.md` for related failure classes
4. **Regressions**: Check `agent/REGRESSIONS/R-*.md` for specific instances
5. **Skills**: Check `agent/SKILLS.md` for relevant capability levels
6. **Tools**: Consult `agent/TOOL_PRIORS.md` for optimal tool selection
7. **Dependencies**: Check `agent/DEPENDENCY_MAP.md` for blast radius
8. **Estimate**: Record prediction in `agent/ESTIMATION.md`
9. **Confidence**: Log confidence level in `agent/CONFIDENCE_LOG.md`

### During Work (MEASURE + TRACK)
1. Note discoveries in `_SESSION.md` under "Recent Discoveries"
2. Track hypotheses being tested
3. Log tool usage and outcomes
4. Capture confidence predictions for interim decisions

### After Work (ANALYZE + ADAPT)
1. **Self-Eval**: Complete `agent/SELF_EVAL.md` entry (mandatory for non-trivial tasks)
2. **Metrics**: Update `agent/METRICS.md` with task data
3. **Estimation**: Record actual vs predicted in `agent/ESTIMATION.md`
4. **Confidence**: Update `agent/CONFIDENCE_LOG.md` with outcomes
5. **Learnings**: Promote reusable discoveries to `L-NNNN` entries
6. **Patterns**: Extract generalizable patterns to `agent/PATTERNS.md`
7. **Failures**: If failure occurred, add to `agent/FAILURE_MODES.md`
8. **Regressions**: If specific regression, add `R-NNNN` entry
9. **Skills**: Update skill evidence if demonstrated
10. **Feedback**: Log any user corrections to `agent/FEEDBACK_LOG.md`
11. **Session**: Update `_SESSION.md` for next session

Hard rule: Debug cycle >5 minutes MUST produce a learning, pattern, or failure mode entry.

---

## Lead-Agent Rule (Hard)

Every task has **exactly one** lead agent.

- The lead agent is accountable for final output quality, correctness, and proofs.
- Other agents may be consulted, but do not “co-lead”.
- If a change crosses multiple surfaces, split into multiple SSIs and route each.

---

## Canonical Agents

- **CALYBRA_PRODUCT_MANAGER**
  - Converts outcomes into SSI scope, acceptance criteria, and tasks.
  - Owns: product constraints, acceptance criteria, migration notes.
  - Does **not** land large code patches.

- **CALYBRA_SECURITY_ENGINEER**
  - Owns: Firestore/Storage rules and rules tests.
  - Owns: tenant isolation invariants and RBAC enforcement.
  - Does **not** do UI work.

- **CALYBRA_IMPLEMENTATION_ENGINEER**
  - Owns: app code (UI/domain/functions/scripts/tooling) within stated constraints.
  - Does **not** weaken rules.

- **CALYBRA_QA_EVALS**
  - Owns: proof execution, invariant checks, release readiness.
  - Owns: updating `agent/RELEASE.md` **only after** PASS proofs.
  - Owns: regression capture and prevention gates.

---

## Routing Matrix (Hard)

Route to exactly one lead agent using the first matching rule.

### 1) Security / Rules / Access Control (P0)

Lead agent: **CALYBRA_SECURITY_ENGINEER**

Triggers:

- Any change to `firestore.rules` or `storage.rules`
- Any RBAC/tenant isolation change
- Any status transition enforcement in rules
- Any rules test additions/edits
- Any change to storage path authorization patterns

Required outputs:

- Evidence of current rules behavior with line pointers (rules + tests)
- Minimal patch to rules **and** tests in the same diff
- Emulator proof:
  - `firebase emulators:exec --only firestore "npm test"`
  - `firebase emulators:exec --only storage "npm test"` (if storage tests exist)

Hard rules:

- No “temporary allow” or “debug allow” rules.
- No weakening without an ADR in `agent/DECISIONS.md` and a proof update.

### 2) Data Model / Status Machines / Contracts (P0/P1)

Lead agent: **CALYBRA_PRODUCT_MANAGER** for spec alignment, then **CALYBRA_SECURITY_ENGINEER** if rules are impacted.

Triggers:

- Changes to canonical roles/status values
- Changes to collection paths
- Changes to `contracts/*`, `seed/*`, `src/domain/schemas/*`
- Any migration that changes document shape or required fields

Required outputs:

- Truth alignment proof from `agent/TRUTH_SNAPSHOT.md` (or rules/tests pointers if snapshot absent)
- Consistency gate PASS
- Migration note (what changes, what breaks, how to roll forward/back)

Hard rule:

- Schema changes must not silently bypass security assumptions (tenantId, status, server-only fields).

### 3) UI Wiring / Domain Logic (P1/P2)

Lead agent: **CALYBRA_IMPLEMENTATION_ENGINEER**

Triggers:

- Next.js UI changes
- Domain module changes
- Query/mutation wiring
- Client-side runtime validation schemas

Required outputs:

- No changes to rules unless routed to Security Engineer
- Must respect contracts/schemas/status machines
- Must include UI verification steps **and** automated proofs

Hard rule:

- Client may not write server-authoritative fields (enforce via schemas + payload shaping).

### 4) Builds / Tooling / CI / Scripts (P1)

Lead agent: **CALYBRA_IMPLEMENTATION_ENGINEER**  
Escalate to QA for proof enforcement.

Triggers:

- `scripts/*` changes
- `.github/workflows/*` changes
- build fixes, lint fixes, typecheck fixes
- emulator configuration fixes (`firebase.json`)

Required outputs:

- Demonstrate the failing command (verbatim) + environment detail (node/npm versions)
- Minimal patch to unblock
- Proof commands executed and recorded
- No “it should work” language

Hard rule:

- Any CI gating change must not reduce security proofs.

### 5) Release Readiness / Proof / Regression Capture (P0/P1)

Lead agent: **CALYBRA_QA_EVALS**

Triggers:

- Any request to “ship”, “release”, “merge-ready”
- Any change requiring release notes
- Any change after a failure/regression
- Any rules/security change prior to deploy

Required outputs:

- Run proofs (not “next steps”)
- Update `agent/RELEASE.md` only after PASS
- If FAIL: create regression entry stub in `agent/REGRESSIONS/`

Hard rule:

- Release readiness is proof-driven, not confidence-driven.

---

## Escalation and Decomposition

If a task spans more than two surfaces:

1) Split into multiple SSIs.
2) Route each SSI independently.
3) Execute in this order:
   1. Security truth (rules/tests)
   2. Data truth (contracts/schemas/seed)
   3. Implementation changes
   4. QA proofs + release artifacts

---

## “Stop and Repair” Conditions

Any agent must STOP and repair alignment before proceeding if:

- Contracts describe paths/roles/status not present in rules/tests
- Seed data does not match canonical model
- Schemas contradict rules (e.g., allowing forbidden client fields)
- Release notes exist without executed proof
- Truth/consistency scripts fail (if present in repo)

---

## Output Contract (Mandatory)

Every routed agent output MUST follow `agent/EVIDENCE_FORMAT.md`. No exceptions.
