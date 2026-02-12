# agent/MEMORY.md

## Purpose

This document defines the **Agent Memory System** — a structured approach for agents to learn, remember, and apply knowledge across sessions.

Memory is not optional. Capturing learnings improves efficiency and prevents repeated debugging cycles.

---

## Non-Negotiable Memory Rules

1. **Learn from failures** — Every debug cycle that takes >5 minutes MUST produce a learning entry.
2. **Learn from successes** — Novel patterns that work well SHOULD be captured.
3. **Memory is append-only** — Never delete learnings; mark them obsolete if superseded.
4. **Memory is indexed** — Use consistent categories for retrieval.
5. **Memory informs action** — Agents MUST consult relevant learnings before starting work.

---

## Memory Types

### 1) LEARNINGS (Procedural Knowledge)

Location: `agent/LEARNINGS/`

Captures:
- Patterns that solved recurring problems
- Environment-specific quirks (emulator, CI, dependencies)
- Shortcuts that saved time
- Anti-patterns to avoid
- Tooling tricks

File naming: `L-NNNN-short-slug.md`

### 2) REGRESSIONS (Failure Knowledge)

Location: `agent/REGRESSIONS/`

Already established. Captures:
- Failures that occurred and their root causes
- Fixes applied with proof
- Prevention gates added

### 3) DECISIONS (Architectural Knowledge)

Location: `agent/DECISIONS.md`

Already established. Captures:
- Architectural choices and rationale
- Constraints and consequences
- Trade-offs accepted

### 4) SESSION_CONTEXT (Working Memory)

Location: `agent/LEARNINGS/_SESSION.md`

Ephemeral context for the current session:
- Current task focus
- Recent discoveries
- Pending items to capture as learnings
- Hypotheses being tested

---

## Learning Entry Format (L-NNNN)

```markdown
# L-NNNN: Short Title

## Category
[env-setup | build-tooling | firestore | auth | testing | ui | domain | performance | security | debugging]

## Tags
[comma, separated, keywords]

## Trigger
What situation activates this learning?

## Knowledge
The actual insight, pattern, or procedure.

## Evidence
How was this validated? Link to proof/regression if applicable.

## Discovered
Date and context of discovery.

## Status
[active | superseded | deprecated]
```

---

## Session Memory Format (_SESSION.md)

```markdown
# Session Memory

## Current Focus
What is the active task?

## Recent Discoveries
- [ ] Discovery 1 (pending capture as L-NNNN)
- [x] Discovery 2 (captured as L-0005)

## Hypotheses
- Hypothesis A: ... [TESTING | CONFIRMED | REJECTED]
- Hypothesis B: ... [TESTING | CONFIRMED | REJECTED]

## Quick Notes
Ephemeral observations that may or may not become learnings.

## Carryover Items
Things to remember for next session if interrupted.
```

---

## Memory Operations

### READ (Before Starting Work)

Agents MUST consult memory before starting any non-trivial task:

1. Check `agent/LEARNINGS/_SESSION.md` for current context
2. Search `agent/LEARNINGS/L-*.md` for relevant category/tags
3. Check `agent/REGRESSIONS/R-*.md` for related failure patterns
4. Check `agent/DECISIONS.md` for constraints

### ACCUMULATE (During Work)

During task execution, agents should:

1. Note discoveries in `_SESSION.md` under "Recent Discoveries"
2. Track hypotheses being tested
3. Capture quick observations

### WRITE (After Work)

After completing work (or debug cycle >5min):

1. Promote any general-purpose discovery to `L-NNNN` entry
2. If failure occurred, ensure `R-NNNN` regression exists
3. Clear captured items from `_SESSION.md`
4. Update "Current Focus" for next session

---

## Memory Maintenance

### Weekly: Consolidation

- Review recent L-entries for duplicates or patterns
- Create summary learnings if many small ones overlap
- Mark obsolete learnings as `[superseded]`

### On Architecture Change: Update

- If a learning references outdated practices, mark as `[deprecated]`
- Add superseding learning if applicable

---

## Integration with Agent Routing

All agents participate in memory:

| Agent | Memory Responsibilities |
|-------|------------------------|
| CALYBRA_PRODUCT_MANAGER | Capture domain/contract insights |
| CALYBRA_SECURITY_ENGINEER | Capture rules/auth patterns |
| CALYBRA_IMPLEMENTATION_ENGINEER | Capture build/tooling/env patterns |
| CALYBRA_QA_EVALS | Capture test/proof patterns, own regression entries |

---

## Integration with Self-Improvement System

Memory is one layer of the comprehensive self-improvement system. See `agent/SELF_IMPROVEMENT.md` for the full architecture.

### Memory → Self-Improvement Data Flow

| Memory Component | Self-Improvement Component | Relationship |
|------------------|---------------------------|--------------|
| LEARNINGS/ | PATTERNS.md | Learnings generalize into patterns |
| REGRESSIONS/ | FAILURE_MODES.md | Regressions are instances of failure modes |
| DECISIONS.md | DEPENDENCY_MAP.md | Decisions create dependencies |
| _SESSION.md | SELF_EVAL.md | Session context informs evaluation |

### Cross-References

When creating memory entries, cross-reference related self-improvement artifacts:

- L-NNNN → P-NNNN (if pattern extracted)
- R-NNNN → F-NNNN (failure mode classification)
- L-NNNN → SKILL-NNNN (if skill demonstrated)

---

## Self-Improvement Components (Quick Reference)

| Component | Purpose | Location |
|-----------|---------|----------|
| Self-Eval | Post-task reflection | `agent/SELF_EVAL.md` |
| Metrics | Quantitative tracking | `agent/METRICS.md` |
| Estimation | Complexity calibration | `agent/ESTIMATION.md` |
| Confidence | Certainty calibration | `agent/CONFIDENCE_LOG.md` |
| Patterns | Reusable solutions | `agent/PATTERNS.md` |
| Failure Modes | Failure class taxonomy | `agent/FAILURE_MODES.md` |
| Skills | Capability certification | `agent/SKILLS.md` |
| Tool Priors | Tool optimization | `agent/TOOL_PRIORS.md` |
| Dependency Map | Impact relationships | `agent/DEPENDENCY_MAP.md` |
| Feedback Log | User corrections | `agent/FEEDBACK_LOG.md` |

---

## Bootstrap Learnings

Initial learnings populated:

- L-0001: Firebase Emulator Test Execution Pattern
- L-0002: Next.js 15+ Async Params Pattern  
- L-0003: Truth and Consistency Gates First

---

## Hard Rules

1. **No "I'll remember this"** — If it's worth remembering, write it down.
2. **No duplicate debugging** — If you debug the same thing twice, you failed to capture.
3. **Learnings are searchable** — Use consistent categories and tags.
4. **Session memory survives interrupts** — Always update `_SESSION.md` before stopping.
5. **Evidence required** — Learnings without validation proof are hypotheses, not knowledge.
