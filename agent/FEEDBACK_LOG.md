# agent/FEEDBACK_LOG.md

## Purpose

Structured capture of user corrections. Feedback is signal; ignoring it is noise.

Every user correction is a learning opportunity. This log ensures corrections are captured, analyzed, and converted to improvements.

---

## Feedback Types

| Type | Description | Priority |
|------|-------------|----------|
| **CORRECTION** | User explicitly says output was wrong | P0 |
| **CLARIFICATION** | User provides information agent should have known | P1 |
| **PREFERENCE** | User expresses style/approach preference | P2 |
| **MISSING** | User points out something agent missed | P1 |
| **EXCESSIVE** | User says agent did too much | P2 |
| **INSUFFICIENT** | User says agent did too little | P1 |

---

## Feedback Entry Format

```markdown
## FB-YYYY-MM-DD-NNNN

### Type
[CORRECTION | CLARIFICATION | PREFERENCE | MISSING | EXCESSIVE | INSUFFICIENT]

### User Statement
> Exact quote or paraphrase of user feedback

### Context
What was the agent doing when feedback was received?

### Root Cause Analysis
Why did this feedback occur?
- [ ] Missing context
- [ ] Incorrect assumption
- [ ] Capability gap
- [ ] Communication failure
- [ ] Tool limitation
- [ ] Other: [specify]

### Corrective Action
What was done immediately to address feedback?

### Preventive Action
What should be done to prevent recurrence?
- [ ] Add to LEARNINGS/
- [ ] Add to PATTERNS/
- [ ] Update TOOL_PRIORS
- [ ] Update FAILURE_MODES
- [ ] Other: [specify]

### Status
[CAPTURED | ANALYZED | RESOLVED | INTEGRATED]
```

---

## Analysis Dimensions

### By Type Distribution
Track which feedback types occur most frequently.

### By Root Cause
Identify systemic issues (e.g., "assumptions" causing 40% of corrections).

### By Task Type
Which task types generate most feedback?

### By Resolution Time
How quickly is feedback integrated?

---

## Feedback-to-Improvement Pipeline

```
User Correction
      │
      ▼
┌─────────────┐
│   CAPTURE   │ ← Log in FEEDBACK_LOG.md
└─────────────┘
      │
      ▼
┌─────────────┐
│   ANALYZE   │ ← Root cause analysis
└─────────────┘
      │
      ▼
┌─────────────┐
│   RESOLVE   │ ← Immediate corrective action
└─────────────┘
      │
      ▼
┌─────────────┐
│  INTEGRATE  │ ← Update LEARNINGS/PATTERNS/PRIORS
└─────────────┘
      │
      ▼
┌─────────────┐
│   VERIFY    │ ← Confirm improvement in future tasks
└─────────────┘
```

---

## Current Feedback Log

<!-- Entries below this line -->

### Bootstrap Entry

```markdown
## FB-2026-02-12-0001

### Type
PREFERENCE

### User Statement
> I want to add them ALL in the most Professional and advanced way

### Context
Agent had suggested self-improvement capabilities and asked which to implement.

### Root Cause Analysis
- [x] Other: User preference for comprehensive solution rather than incremental

### Corrective Action
Implemented all suggested capabilities comprehensively.

### Preventive Action
- [x] Add to LEARNINGS/: When user shows enthusiasm, lean toward comprehensive implementation

### Status
RESOLVED
```

---

## Aggregation

### Period Summary Template
```yaml
period: "YYYY-WNN"
total_feedback: N
by_type:
  correction: N
  clarification: N
  preference: N
  missing: N
  excessive: N
  insufficient: N
top_root_causes:
  - cause: "description"
    count: N
resolution_rate: N%
integration_rate: N%
```

---

## Anti-Patterns to Avoid

1. **Defensive dismissal** — "The user was wrong" (rarely true)
2. **Surface fixes** — Fixing symptom without addressing cause
3. **Feedback hoarding** — Capturing without analyzing
4. **Analysis paralysis** — Analyzing without acting
5. **Local fixes** — Fixing one instance without generalizing

---

## Integration

- **SELF_EVAL.md**: Feedback informs evaluation scores
- **METRICS.md**: `user_corrections` field tracks feedback count
- **LEARNINGS/**: Feedback generates learning entries
- **CONFIDENCE_LOG.md**: Corrections indicate overconfidence
